import Link from "next/link";
import { Compass, Lightbulb, Wrench } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { NewProjectButtons } from "@/features/build/new-project-buttons";
import { STAGE_LABELS } from "@/lib/constants";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Build Center" };

export default async function BuildPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: memberships } = await supabase.from("project_members").select("project_id").eq("user_id", viewer.id);
  const ids = (memberships ?? []).map((m) => m.project_id);
  const { data: projects } = ids.length
    ? await supabase.from("projects").select("*").in("id", ids).eq("status", "active").order("updated_at", { ascending: false })
    : { data: [] };
  const list = projects ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Build Center" subtitle="Interview, research, concept, blueprint." />
      <Card>
        <CardHeader title="Start a new project" />
        <NewProjectButtons
          defaultProvider={viewer.prefs.preferred_ai}
          routes={[
            { route: "discover", title: "Discover a game", body: "AI finds a balanced trend and originality opportunity.", icon: <Compass className="h-5 w-5" aria-hidden /> },
            { route: "idea", title: "Develop my idea", body: "Explain your idea; AI researches where it stands.", icon: <Lightbulb className="h-5 w-5" aria-hidden /> },
            { route: "improve", title: "Improve my game", body: "Bring your metrics and problems; get new directions.", icon: <Wrench className="h-5 w-5" aria-hidden /> },
          ]}
        />
      </Card>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted">Your projects</h2>
        {list.length === 0 ? (
          <EmptyState title="No projects yet" body="Pick a starting route above. The interview takes about five minutes." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.map((p) => (
              <li key={p.id}>
                <Link href={`/build/${p.id}`} className="block rounded-[var(--radius-card)] border bg-surface p-4 transition-colors hover:border-border-strong">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{p.title}</p>
                    <Badge tone="brand">{STAGE_LABELS[p.stage]}</Badge>
                  </div>
                  <Progress value={p.progress} className="my-3" />
                  <p className="text-xs text-muted">Updated {timeAgo(p.updated_at)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
