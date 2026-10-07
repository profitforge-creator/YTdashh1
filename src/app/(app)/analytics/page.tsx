import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PriorityMetrics } from "@/features/analytics/analytics-overview";
import { CsvImport } from "@/features/analytics/csv-import";
import { SnapshotForm } from "@/features/analytics/snapshot-form";
import { SnapshotTable } from "@/features/analytics/snapshot-table";
import { requireViewer } from "@/lib/auth";
import { buildInsights } from "@/lib/analytics/insights";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project: projectParam } = await searchParams;
  const viewer = await requireViewer();
  const supabase = await createClient();

  const { data: memberships } = await supabase.from("project_members").select("project_id, role").eq("user_id", viewer.id);
  const ids = (memberships ?? []).map((m) => m.project_id);
  const { data: projects } = ids.length
    ? await supabase.from("projects").select("id, title").in("id", ids).eq("status", "active").order("updated_at", { ascending: false })
    : { data: [] };

  if (!projects || projects.length === 0) {
    return (
      <div>
        <PageHeader title="Analytics" />
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" aria-hidden />}
          title="No project to analyze yet"
          body="Create a project in the Build Center, then add metrics here by hand or by CSV."
          action={<Link href="/build" className="text-sm text-brand-hover underline underline-offset-4">Go to Build Center</Link>}
        />
      </div>
    );
  }

  const current = projects.find((p) => p.id === projectParam) ?? projects[0]!;
  const canEdit = (memberships ?? []).some((m) => m.project_id === current.id && (m.role === "owner" || m.role === "editor"));
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const { data: rows } = await supabase
    .from("metric_snapshots")
    .select("*")
    .eq("project_id", current.id)
    .gte("captured_on", since)
    .order("captured_on", { ascending: true });
  const snapshots = rows ?? [];
  const insights = buildInsights(snapshots);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Private to project members. Manual and CSV data for the beta." />
      {projects.length > 1 ? (
        <nav aria-label="Project" className="scroll-thin flex gap-2 overflow-x-auto">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/analytics?project=${p.id}`}
              aria-current={p.id === current.id ? "page" : undefined}
              className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", p.id === current.id ? "border-brand bg-brand-soft" : "text-muted")}
            >
              {p.title}
            </Link>
          ))}
        </nav>
      ) : null}

      <PriorityMetrics rows={snapshots} />

      {insights.length > 0 ? (
        <Card>
          <CardHeader title="Insights" />
          <ul className="space-y-2">
            {insights.map((i) => (
              <li key={i.id} className={cn("rounded-lg px-3 py-2 text-sm", i.tone === "warning" ? "bg-warning/10" : i.tone === "positive" ? "bg-positive/10" : "bg-surface-2")}>
                {i.text}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {canEdit ? (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader title="Add a snapshot" />
            <SnapshotForm projectId={current.id} />
          </Card>
          <Card>
            <CardHeader title="Import" />
            <CsvImport projectId={current.id} />
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader title="Recent snapshots" />
        <SnapshotTable rows={[...snapshots].reverse().slice(0, 30)} canEdit={canEdit} />
      </Card>
    </div>
  );
}
