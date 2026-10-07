import "server-only";
import { generateConcepts } from "@/lib/ai/gateway";
import { confidenceFor, explainScore, opportunityScore } from "@/lib/ai/opportunity";
import type { Answers, Route } from "@/lib/interview/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

interface JobParams {
  revision_note?: string;
  combine_ids?: string[];
}

function asParams(raw: Json): JobParams {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const note = raw["revision_note"];
    const ids = raw["combine_ids"];
    return {
      ...(typeof note === "string" ? { revision_note: note } : {}),
      ...(Array.isArray(ids) ? { combine_ids: ids.filter((x): x is string => typeof x === "string") } : {}),
    };
  }
  return {};
}

/**
 * Executes a queued concepts job. Runs after the response is sent (see startConceptsJob), so every
 * outcome — including failure — must land in the database for the client to see.
 */
export async function runConceptsJob(jobId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: job } = await admin.from("generation_jobs").select("*").eq("id", jobId).single();
  if (!job || job.status !== "queued") return;

  await admin.from("generation_jobs").update({ status: "running" }).eq("id", jobId);

  try {
    const [{ data: project }, { data: interview }] = await Promise.all([
      admin.from("projects").select("route, owner_id").eq("id", job.project_id).single(),
      admin.from("project_interviews").select("answers").eq("project_id", job.project_id).single(),
    ]);
    if (!project || !interview) throw new Error("Project data is missing");

    const params = asParams(job.params);
    const answers = interview.answers as Answers;
    let note = params.revision_note ?? null;
    if (params.combine_ids && params.combine_ids.length > 1) {
      const { data: toCombine } = await admin.from("concepts").select("title, hook").in("id", params.combine_ids);
      const list = (toCombine ?? []).map((c) => `"${c.title}" (${c.hook})`).join(" + ");
      note = `Combine the best parts of these concepts into new directions: ${list}. ${note ?? ""}`.trim();
    }

    const { draft, isFixture } = await generateConcepts(job.provider, project.route as Route, answers, note);
    const now = Date.now();

    const rows = draft.concepts.map((c, position) => {
      const score = opportunityScore(c.sub_scores);
      const confidence = confidenceFor(c.sources, now);
      return {
        project_id: job.project_id,
        job_id: job.id,
        position,
        title: c.title,
        hook: c.hook,
        target_player: c.target_player,
        core_loop: c.core_loop,
        progression: c.progression,
        original_angle: c.original_angle,
        comparable_games: c.comparable_games as Json,
        difficulty: c.difficulty,
        scope: c.scope,
        monetization: c.monetization as Json,
        risks: c.risks as Json,
        opportunity_score: score,
        score_breakdown: c.sub_scores as Json,
        confidence,
        score_explanation: explainScore(c.sub_scores, score, confidence, c.score_rationale),
        is_fixture: isFixture,
      };
    });

    // Older proposals are superseded only once the new set is safely stored.
    const { data: inserted, error: insertError } = await admin.from("concepts").insert(rows).select("id, position");
    if (insertError || !inserted) throw new Error("Could not store concepts");

    const sources = inserted.flatMap((row) => {
      const concept = draft.concepts[row.position];
      return (concept?.sources ?? []).map((s) => ({
        concept_id: row.id,
        claim: s.claim,
        url: s.url,
        title: s.title,
        publisher: s.publisher,
        source_date: s.date,
      }));
    });
    const { error: sourceError } = await admin.from("concept_sources").insert(sources);
    if (sourceError) throw new Error("Could not store sources");

    const newIds = inserted.map((r) => r.id);
    await admin
      .from("concepts")
      .update({ status: "superseded" })
      .eq("project_id", job.project_id)
      .in("status", ["proposed", "revision_requested"])
      .not("id", "in", `(${newIds.join(",")})`);
    if (params.combine_ids?.length) {
      await admin.from("concepts").update({ status: "combined" }).in("id", params.combine_ids);
    }

    await admin.from("projects").update({ stage: "concept", progress: 30 }).eq("id", job.project_id);
    await admin.from("generation_jobs").update({ status: "succeeded", finished_at: new Date().toISOString() }).eq("id", jobId);
    await admin.rpc("notify", {
      p_user: job.user_id,
      p_kind: "build_complete",
      p_title: "Your concepts are ready",
      p_body: "Three researched concepts are waiting for your approval.",
      p_href: `/build/${job.project_id}`,
      p_immediate: false,
      p_group: null,
    });
    await admin.from("rank_events").insert({
      user_id: job.user_id,
      component: "generation",
      kind: "concepts_generated",
      points: 1,
      ref_id: job.id,
      dedupe_key: `generation:${job.id}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    await admin.from("generation_jobs").update({ status: "failed", error: message.slice(0, 300), finished_at: new Date().toISOString() }).eq("id", jobId);
    // Failed research must never cost the user credits.
    await admin.rpc("refund_credits", { p_user: job.user_id, p_category: job.credit_category, p_job: job.id });
  }
}
