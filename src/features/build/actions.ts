"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { dbErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { generateFollowUp } from "@/lib/ai/gateway";
import { getViewer } from "@/lib/auth";
import { CREDIT_COSTS } from "@/lib/config/plans";
import {
  isAnswered, questionsForRoute, type Answers, type Route,
} from "@/lib/interview/schema";
import { allow } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { answerSchema, confirmSchema, createProjectSchema } from "@/lib/validation/build";
import type { AiProvider, Json } from "@/types/database";
import { runConceptsJob } from "./run-concepts-job";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function requireEditor(supabase: Supabase, projectId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role === "owner" || data?.role === "editor";
}

function questionIntro(route: Route): string {
  const base = "I'll ask a handful of questions so the research fits your game. Tap an option or type your own answer.";
  return route === "discover"
    ? `Let's find you a strong opportunity. ${base}`
    : route === "idea"
      ? `Let's pressure-test your idea. ${base}`
      : `Let's find what's holding your game back. ${base}`;
}

export async function createProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) return fail("Pick a starting route.");

  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      owner_id: viewer.id,
      route: parsed.data.route,
      title: parsed.data.title || "Untitled project",
      ai_provider: parsed.data.provider,
    })
    .select("id")
    .single();
  if (error || !project) return fail("Couldn't create the project.");

  const { error: interviewError } = await supabase.from("project_interviews").insert({ project_id: project.id, answers: {} });
  if (interviewError) return fail("Couldn't start the interview.");

  const admin = createAdminClient();
  const first = questionsForRoute(parsed.data.route)[0];
  await admin.from("project_messages").insert([
    { project_id: project.id, role: "assistant", content: questionIntro(parsed.data.route) },
    ...(first ? [{ project_id: project.id, role: "assistant" as const, content: first.prompt }] : []),
  ]);
  await supabase.from("build_tasks").insert({
    project_id: project.id,
    title: "Finish the project interview",
    detail: "Answer the interview so DevMint can research your concept.",
    position: 0,
  });

  revalidatePath("/build");
  revalidatePath("/home");
  return ok({ id: project.id });
}

export async function submitAnswer(input: unknown): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return fail("That answer isn't valid.");
  const { projectId, questionId, value, skip } = parsed.data;

  const supabase = await createClient();
  if (!(await requireEditor(supabase, projectId, viewer.id))) return fail("You can't edit this project.");

  const [{ data: project }, { data: interview }] = await Promise.all([
    supabase.from("projects").select("route, ai_provider, stage").eq("id", projectId).single(),
    supabase.from("project_interviews").select("answers, confirmed_at").eq("project_id", projectId).single(),
  ]);
  if (!project || !interview) return fail("Project not found.");
  if (interview.confirmed_at) return fail("The interview is already confirmed. Edit the summary instead.");

  const route = project.route as Route;
  const question = questionsForRoute(route).find((q) => q.id === questionId);
  if (!question) return fail("Unknown question.");

  const answers: Answers = { ...(interview.answers as Answers) };
  const skipped = new Set(Array.isArray(answers["_skipped"]) ? (answers["_skipped"] as string[]) : []);
  let display: string;
  if (skip) {
    if (!question.optional) return fail("This question can't be skipped.");
    skipped.add(question.id);
    display = "Skip";
  } else {
    if (value === undefined || (Array.isArray(value) ? value.length === 0 : value.trim() === "")) {
      return fail("Add an answer first.");
    }
    answers[question.id] = Array.isArray(value) ? value : value.trim();
    display = Array.isArray(value) ? value.join(", ") : value.trim();
  }
  answers["_skipped"] = [...skipped];
  delete answers["_pending_followup"];

  const { error: saveError } = await supabase
    .from("project_interviews")
    .update({ answers: answers as Json, current_step: Object.keys(answers).length })
    .eq("project_id", projectId);
  if (saveError) return fail("Couldn't save your answer.");
  await supabase.from("project_messages").insert({ project_id: projectId, role: "user", content: display });

  const admin = createAdminClient();
  const questions = questionsForRoute(route);
  const nextQuestion = questions.find((q) => !isAnswered(q, answers) && !skipped.has(q.id));

  // One AI follow-up per project, offered only after the free-text answers that benefit most from it.
  const followups = answers["followups"];
  const noFollowupYet = !Array.isArray(followups) || followups.length === 0;
  if (!skip && noFollowupYet && ["idea", "core_loop", "problems"].includes(question.id)) {
    if (await allow(`followup:${viewer.id}`, 20, 3600)) {
      try {
        const followUp = await generateFollowUp(project.ai_provider, route, answers);
        if (followUp) {
          answers["_pending_followup"] = followUp;
          await supabase.from("project_interviews").update({ answers: answers as Json }).eq("project_id", projectId);
          await admin.from("project_messages").insert({ project_id: projectId, role: "assistant", content: followUp });
          revalidatePath(`/build/${projectId}`);
          return ok();
        }
      } catch {
        // A failed follow-up is non-critical; continue the structured interview.
      }
    }
  }

  await admin.from("project_messages").insert({
    project_id: projectId,
    role: "assistant",
    content: nextQuestion ? nextQuestion.prompt : "That's everything I need. Review the summary, edit anything, then confirm to start research.",
  });
  revalidatePath(`/build/${projectId}`);
  return ok();
}

export async function answerFollowUp(input: { projectId: string; value: string }): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const value = input.value?.trim();
  if (!value || value.length > 2000) return fail("Add an answer first.");

  const supabase = await createClient();
  if (!(await requireEditor(supabase, input.projectId, viewer.id))) return fail("You can't edit this project.");
  const { data: interview } = await supabase.from("project_interviews").select("answers, confirmed_at").eq("project_id", input.projectId).single();
  if (!interview || interview.confirmed_at) return fail("The interview is already confirmed.");

  const answers = { ...(interview.answers as Answers) };
  const pending = answers["_pending_followup"];
  if (typeof pending !== "string") return fail("There's no follow-up to answer.");
  const existing = Array.isArray(answers["followups"]) ? (answers["followups"] as string[]) : [];
  answers["followups"] = [...existing, `${pending} — ${value}`];
  delete answers["_pending_followup"];

  await supabase.from("project_interviews").update({ answers: answers as Json }).eq("project_id", input.projectId);
  await supabase.from("project_messages").insert({ project_id: input.projectId, role: "user", content: value });

  const { data: project } = await supabase.from("projects").select("route").eq("id", input.projectId).single();
  const route = (project?.route ?? "idea") as Route;
  const skipped = Array.isArray(answers["_skipped"]) ? (answers["_skipped"] as string[]) : [];
  const next = questionsForRoute(route).find((q) => !isAnswered(q, answers) && !skipped.includes(q.id));
  await createAdminClient().from("project_messages").insert({
    project_id: input.projectId,
    role: "assistant",
    content: next ? next.prompt : "That's everything I need. Review the summary, edit anything, then confirm to start research.",
  });
  revalidatePath(`/build/${input.projectId}`);
  return ok();
}

export async function setProvider(projectId: string, provider: AiProvider): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  if (!["claude", "chatgpt", "gemini"].includes(provider)) return fail("Unknown AI provider.");
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ ai_provider: provider }).eq("id", projectId);
  if (error) return fail("Couldn't switch provider.");
  revalidatePath(`/build/${projectId}`);
  return ok();
}

interface JobOptions {
  revisionNote?: string;
  combineIds?: string[];
}

/** Debits credits, records the job, then runs generation after the response is sent. */
async function enqueueConceptsJob(projectId: string, userId: string, provider: AiProvider, options: JobOptions = {}): Promise<ActionResult<{ jobId: string }>> {
  if (!(await allow(`concepts:${userId}`, 6, 3600))) return fail("You're generating too fast. Try again in a little while.");

  const admin = createAdminClient();
  const { data: running } = await admin
    .from("generation_jobs")
    .select("id")
    .eq("project_id", projectId)
    .in("status", ["queued", "running"])
    .limit(1);
  if (running && running.length > 0) return fail("Research is already running for this project.");

  await admin.rpc("grant_monthly_credits", { p_user: userId });
  const cost = CREDIT_COSTS.concepts;
  const { data: job, error: jobError } = await admin
    .from("generation_jobs")
    .insert({
      project_id: projectId,
      user_id: userId,
      kind: "concepts",
      provider,
      credit_category: cost.category,
      credits_charged: cost.amount,
      params: { revision_note: options.revisionNote ?? null, combine_ids: options.combineIds ?? [] } as Json,
    })
    .select("id")
    .single();
  if (jobError || !job) return fail("Couldn't start research.");

  const { error: debitError } = await admin.rpc("debit_credits", {
    p_user: userId,
    p_category: cost.category,
    p_amount: cost.amount,
    p_reason: "concept_research",
    p_job: job.id,
  });
  if (debitError) {
    await admin.from("generation_jobs").delete().eq("id", job.id);
    return fail(dbErrorMessage(debitError, "Couldn't charge credits."));
  }

  await admin.from("projects").update({ stage: "research", progress: 20 }).eq("id", projectId);
  after(() => runConceptsJob(job.id));
  revalidatePath(`/build/${projectId}`);
  return ok({ jobId: job.id });
}

export async function confirmSummaryAndResearch(input: unknown): Promise<ActionResult<{ jobId: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return fail("Check the summary and try again.");

  const supabase = await createClient();
  if (!(await requireEditor(supabase, parsed.data.projectId, viewer.id))) return fail("You can't edit this project.");
  const { data: project } = await supabase.from("projects").select("ai_provider, stage").eq("id", parsed.data.projectId).single();
  if (!project) return fail("Project not found.");
  if (project.stage !== "interview") return fail("Research has already started for this project.");

  // The user's edits to the summary become the source of truth for research.
  const { data: interview } = await supabase.from("project_interviews").select("answers").eq("project_id", parsed.data.projectId).single();
  const answers = { ...((interview?.answers ?? {}) as Answers) };
  for (const item of parsed.data.items) {
    if (!item.id.startsWith("followup_") && item.id in answers) {
      answers[item.id] = Array.isArray(answers[item.id]) ? item.value.split(",").map((s) => s.trim()).filter(Boolean) : item.value;
    }
  }
  await supabase
    .from("project_interviews")
    .update({ answers: answers as Json, completed_at: new Date().toISOString(), confirmed_at: new Date().toISOString() })
    .eq("project_id", parsed.data.projectId);
  await supabase.from("projects").update({ summary: parsed.data.items as unknown as Json }).eq("id", parsed.data.projectId);

  const result = await enqueueConceptsJob(parsed.data.projectId, viewer.id, project.ai_provider);
  if (!result.ok) {
    // Allow the user to retry after e.g. topping up credits.
    await supabase.from("project_interviews").update({ confirmed_at: null }).eq("project_id", parsed.data.projectId);
  } else {
    await supabase.from("build_tasks").update({ completed_at: new Date().toISOString() }).eq("project_id", parsed.data.projectId).eq("title", "Finish the project interview");
    await supabase.from("build_tasks").insert({
      project_id: parsed.data.projectId,
      title: "Review your three concepts and approve one",
      detail: "Open each concept, check the sources, and approve, revise or combine.",
      position: 1,
    });
  }
  return result;
}

export async function approveConcept(conceptId: string, note?: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const supabase = await createClient();
  const { data: concept } = await supabase.from("concepts").select("project_id").eq("id", conceptId).single();
  const { error } = await supabase.rpc("approve_concept", { p_concept: conceptId, p_note: note ?? null });
  if (error) return fail(dbErrorMessage(error, "Couldn't approve this concept."));
  if (concept) {
    await supabase.from("build_tasks").update({ completed_at: new Date().toISOString() }).eq("project_id", concept.project_id).like("title", "Review your three concepts%");
    revalidatePath(`/build/${concept.project_id}`);
  }
  revalidatePath("/home");
  return ok();
}

export async function reviseConcept(conceptId: string, note: string): Promise<ActionResult<{ jobId: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const trimmed = note.trim();
  if (trimmed.length < 5 || trimmed.length > 1000) return fail("Describe what to change in 5–1000 characters.");
  const supabase = await createClient();
  const { data: concept } = await supabase.from("concepts").select("project_id").eq("id", conceptId).single();
  if (!concept) return fail("Concept not found.");
  const { data: project } = await supabase.from("projects").select("ai_provider").eq("id", concept.project_id).single();
  if (!project) return fail("Project not found.");

  const { error } = await supabase.rpc("request_concept_revision", { p_concept: conceptId, p_note: trimmed });
  if (error) return fail(dbErrorMessage(error));
  return enqueueConceptsJob(concept.project_id, viewer.id, project.ai_provider, { revisionNote: trimmed });
}

export async function combineConcepts(projectId: string, conceptIds: string[]): Promise<ActionResult<{ jobId: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  if (conceptIds.length < 2 || conceptIds.length > 3) return fail("Pick two or three concepts to combine.");
  const supabase = await createClient();
  if (!(await requireEditor(supabase, projectId, viewer.id))) return fail("You can't edit this project.");
  const { data: concepts } = await supabase.from("concepts").select("id").eq("project_id", projectId).eq("status", "proposed").in("id", conceptIds);
  if (!concepts || concepts.length !== conceptIds.length) return fail("Those concepts can't be combined.");
  const { data: project } = await supabase.from("projects").select("ai_provider").eq("id", projectId).single();
  if (!project) return fail("Project not found.");
  return enqueueConceptsJob(projectId, viewer.id, project.ai_provider, { combineIds: conceptIds });
}

/** Returns to the interview so the user can change answers before re-running research. */
export async function returnToInterview(projectId: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const supabase = await createClient();
  if (!(await requireEditor(supabase, projectId, viewer.id))) return fail("You can't edit this project.");
  const { data: project } = await supabase.from("projects").select("stage, approved_concept_id").eq("id", projectId).single();
  if (!project || project.approved_concept_id) return fail("An approved concept can't return to the interview.");
  await supabase.from("project_interviews").update({ confirmed_at: null }).eq("project_id", projectId);
  await supabase.from("projects").update({ stage: "interview", progress: 10 }).eq("id", projectId);
  revalidatePath(`/build/${projectId}`);
  return ok();
}

export async function completeTask(taskId: string, done: boolean): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("build_tasks")
    .update({ completed_at: done ? new Date().toISOString() : null })
    .eq("id", taskId);
  if (error) return fail("Couldn't update the task.");
  revalidatePath("/home");
  return ok();
}
