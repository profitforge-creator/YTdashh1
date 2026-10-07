import { ShieldCheck, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCents, timeAgo } from "@/lib/utils";

export const metadata = { title: "DevMint balance" };

const STATES = [
  { key: "pending_cents", label: "Pending", tone: "warning", hint: "Protected until the buyer approves or the 7-day window ends." },
  { key: "available_cents", label: "Available", tone: "positive", hint: "Approved and ready to withdraw once payouts open." },
  { key: "processing_cents", label: "Processing", tone: "active", hint: "Payouts in flight." },
  { key: "paid_out_cents", label: "Paid out", tone: "neutral", hint: "Sent to your bank." },
  { key: "refunded_cents", label: "Refunded", tone: "active", hint: "Returned to you after a dispute." },
  { key: "disputed_cents", label: "Disputed", tone: "danger", hint: "Frozen during a dispute review." },
] as const;

const KIND_LABELS: Record<string, string> = {
  escrow_funded: "Job funded", release: "Payment released", dispute_opened: "Dispute opened",
  dispute_release: "Dispute: paid to you", dispute_forfeit: "Dispute: not awarded", dispute_refund: "Dispute refund",
};

export default async function BalancePage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const [{ data: balance }, { data: txs }, { data: verified }] = await Promise.all([
    supabase.from("balances").select("*").eq("user_id", viewer.id).maybeSingle(),
    supabase.from("balance_transactions").select("*").eq("user_id", viewer.id).order("id", { ascending: false }).limit(30),
    supabase.rpc("verify_ledger", { p_user: viewer.id }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="DevMint balance" subtitle="An interface over the marketplace payment provider, not a bank account." />
      <Card className="bg-surface-2 text-sm text-muted">
        Beta payments run in <b className="text-fg">test mode</b>: no card is charged and no real money moves. Withdrawals activate after payment-provider onboarding and identity verification.
      </Card>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {STATES.map((s) => (
          <Card key={s.key}>
            <div className="flex items-center justify-between"><p className="text-xs text-muted">{s.label}</p><Badge tone={s.tone}>{s.label}</Badge></div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCents(Number(balance?.[s.key] ?? 0))}</p>
            <p className="mt-1 text-[11px] text-faint">{s.hint}</p>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader title="Ledger" action={
          verified ? <span className="inline-flex items-center gap-1 text-xs text-positive"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Hash chain verified</span>
                   : <span className="inline-flex items-center gap-1 text-xs text-danger"><ShieldAlert className="h-3.5 w-3.5" aria-hidden /> Verification failed</span>
        } />
        {(txs ?? []).length === 0 ? <p className="text-sm text-muted">No transactions yet.</p> : (
          <ul className="divide-y">
            {(txs ?? []).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0"><p>{KIND_LABELS[t.kind] ?? t.kind}</p><p className="text-xs text-faint">{t.from_state ?? "outside"} → {t.to_state ?? "outside"} · {timeAgo(t.created_at)}{t.contract_id ? <> · <Link href={`/work/contracts/${t.contract_id}`} className="underline">job</Link></> : null}</p></div>
                <span className="tabular-nums">{formatCents(t.amount_cents)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-faint">Each entry is chained to the previous one by a SHA-256 hash and the table is append-only, so edits are detectable.</p>
      </Card>
    </div>
  );
}
