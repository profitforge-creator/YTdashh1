import { notFound } from "next/navigation";
import { ProviderSelect } from "@/features/build/provider-select";
import { BlueprintPanel } from "@/features/build/blueprint-panel";
import { ChatPanel } from "@/features/build/chat-panel";
import { ConceptsPanel } from "@/features/build/concepts-panel";
import { ResearchStatus } from "@/features/build/research-status";
import { StageBar } from "@/features/build/stage-bar";
import { SummaryEditor } from "@/features/build/summary-editor";
import type { ConceptView } from "@/features/build/types";
import { WorkspaceShell } from "@/features/build/workspace-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requireViewer } from "@/lib/auth";
import type { Answers, Route } from "@/lib/interview/schema";
import { createClient } from "@/lib/supabase/server";

// Research jobs run after the response; give the server action room to finish on Vercel.
export const maxDuration = 300;

export const metadata = { title: "Build Center" };

export default async function BuildWorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const viewer = await requireViewer();
  const supabase = await createClient();

  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) notFound();

  const [
    { data: interview }, { data: messages }, { data: jobs }, { data: conceptRows },
    { data: member }, { data: wallet },
  ] = await Promise.all([
    supabase.from("project_interviews").select("*").eq("project_id", projectId).maybeSingle(),
    supabase.from("project_messages").select("*").eq("project_id", projectId).order("created_at"),
    supabase.from("generation_jobs").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1),
    supabase.from("concepts").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).order("position"),
    supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", viewer.id).maybeSingle(),
    supabase.from("credit_wallets").select("subscription_balance, purchased_balance").eq("user_id", viewer.id).eq("category", "research").maybeSingle(),
  ]);

  const conceptIds = (conceptRows ?? []).map((c) => c.id);
  const { data: sourceRows } = conceptIds.length
    ? await supabase.from("concept_sources").select("*").in("concept_id", conceptIds).order("source_date", { ascending: false })
    : { data: [] };

  const concepts: ConceptView[] = (conceptRows ?? []).map((c) => ({
    ...c,
    sources: (sourceRows ?? []).filter((s) => s.concept_id === c.id),
  }));

  const answers = (interview?.answers ?? {}) as Answers;
  const confirmed = Boolean(interview?.confirmed_at);
  const canEdit = member?.role === "owner" || member?.role === "editor";
  const latestJob = jobs?.[0] ?? null;
  const researchCredits = (wallet?.subscription_balance ?? 0) + (wallet?.purchased_balance ?? 0);
  const approved = concepts.find((c) => c.id === project.approved_concept_id);
  const route = project.route as Route;

  let output: React.ReactNode;
  if (approved) {
    output = (
      <div className="space-y-4">
        <BlueprintPanel approvedTitle={approved.title} />
        <ConceptsPanel projectId={projectId} concepts={[approved]} canEdit={false} researchCredits={researchCredits} hasApproval />
      </div>
    );
  } else if (project.stage === "research") {
    output = <ResearchStatus job={latestJob} projectId={projectId} canEdit={canEdit} />;
  } else if (project.stage === "concept") {
    output = <ConceptsPanel projectId={projectId} concepts={concepts} canEdit={canEdit} researchCredits={researchCredits} hasApproval={false} />;
  } else {
    output = <SummaryEditor projectId={projectId} route={route} answers={answers} canEdit={canEdit} researchCredits={researchCredits} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={project.title}
        subtitle={`${route === "discover" ? "Discover a game" : route === "idea" ? "Develop my idea" : "Improve an existing game"}`}
        action={canEdit && !approved ? <ProviderSelect projectId={projectId} value={project.ai_provider} /> : undefined}
      />
      <StageBar stage={project.stage} approved={Boolean(approved)} />
      <WorkspaceShell
        chat={
          <ChatPanel
            projectId={projectId}
            route={route}
            messages={messages ?? []}
            answers={answers}
            confirmed={confirmed}
            canEdit={canEdit}
          />
        }
        output={output}
      />
    </div>
  );
}
