import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { ModerateReportButtons } from "@/features/admin/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Moderation queue" };

export default async function ReportsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: reports } = await supabase.from("reports").select("*").eq("status", "open").order("created_at");

  const postIds = (reports ?? []).filter((r) => r.target_type === "post").map((r) => r.target_id);
  const { data: posts } = postIds.length ? await supabase.from("posts").select("id, body").in("id", postIds) : { data: [] };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Moderation queue" />
      {(reports ?? []).length === 0 ? <EmptyState title="No open reports" /> : (reports ?? []).map((r) => (
        <Card key={r.id} className="space-y-3">
          <div className="flex items-center gap-2"><Badge tone="warning">{r.reason}</Badge><Badge>{r.target_type}</Badge><span className="ml-auto text-xs text-muted">{timeAgo(r.created_at)}</span></div>
          {r.target_type === "post" ? <p className="rounded-lg bg-surface-2 p-3 text-sm">{posts?.find((p) => p.id === r.target_id)?.body ?? "(post removed or empty)"}</p> : <p className="text-xs text-muted">Target id {r.target_id}</p>}
          {r.details ? <p className="text-sm text-muted">{r.details}</p> : null}
          <ModerateReportButtons reportId={r.id} />
        </Card>
      ))}
    </div>
  );
}
