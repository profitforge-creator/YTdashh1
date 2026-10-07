import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ResolveDisputeForm } from "@/features/admin/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCents, timeAgo } from "@/lib/utils";

export const metadata = { title: "Dispute queue" };

export default async function DisputesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: disputes } = await supabase.from("disputes").select("*").eq("status", "open").order("created_at");
  const ids = (disputes ?? []).map((d) => d.contract_id);
  const { data: contracts } = ids.length ? await supabase.from("contracts").select("*").in("id", ids) : { data: [] };
  const { data: subs } = ids.length ? await supabase.from("submissions").select("contract_id, note, created_at").in("contract_id", ids) : { data: [] };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Dispute queue" subtitle="Review the agreement, submissions and evidence before deciding." />
      {(disputes ?? []).length === 0 ? <EmptyState title="No open disputes" /> : (disputes ?? []).map((d) => {
        const c = contracts?.find((x) => x.id === d.contract_id);
        return (
          <Card key={d.id} className="space-y-3">
            <div className="flex items-center justify-between text-sm"><Link href={`/work/contracts/${d.contract_id}`} className="underline underline-offset-4">Open contract</Link><span className="text-xs text-muted">{timeAgo(d.created_at)}</span></div>
            <p className="text-sm"><b>Reason:</b> {d.reason}</p>
            <p className="text-xs text-muted">Amount {formatCents(c?.amount_cents ?? 0)} · {(subs ?? []).filter((s) => s.contract_id === d.contract_id).length} submission(s)</p>
            <ResolveDisputeForm disputeId={d.id} amountDollars={(c?.amount_cents ?? 0) / 100} />
          </Card>
        );
      })}
    </div>
  );
}
