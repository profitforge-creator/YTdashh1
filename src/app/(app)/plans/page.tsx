import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CreditsCard } from "@/features/home/credits-card";
import { requireViewer } from "@/lib/auth";
import { CREDIT_CATEGORIES, PLANS, ROLLOVER_MONTHS } from "@/lib/config/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Plans & credits" };

export default async function PlansPage() {
  const viewer = await requireViewer();
  await createAdminClient().rpc("grant_monthly_credits", { p_user: viewer.id });
  const supabase = await createClient();
  const [{ data: wallets }, { data: sub }, { data: txs }] = await Promise.all([
    supabase.from("credit_wallets").select("*").eq("user_id", viewer.id),
    supabase.from("subscriptions").select("plan").eq("user_id", viewer.id).single(),
    supabase.from("credit_transactions").select("*").eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const current = sub?.plan ?? "free";

  return (
    <div className="space-y-5">
      <PageHeader title="Plans & credits" subtitle="No unlimited plan. Annual billing is 10% off." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => (
          <Card key={p.tier} className={cn("flex flex-col", p.tier === current && "border-brand")}>
            <div className="flex items-center justify-between"><h2 className="text-base font-semibold">{p.name}</h2>{p.tier === current ? <Badge tone="brand">Current</Badge> : null}</div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">${p.monthlyUsd}<span className="text-sm font-normal text-muted">/mo</span></p>
            <p className="text-xs text-muted">{p.annualUsd > 0 ? `$${p.annualUsd.toLocaleString()}/year` : "Free forever"}</p>
            <p className="mt-3 text-sm text-muted">{p.tagline}</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />{f}</li>)}
            </ul>
            <dl className="mt-4 space-y-1 border-t pt-3 text-xs">
              {CREDIT_CATEGORIES.map((c) => <div key={c.value} className="flex justify-between"><dt className="text-muted">{c.label}</dt><dd className="tabular-nums">{p.allowances[c.value]}/mo</dd></div>)}
            </dl>
          </Card>
        ))}
      </div>
      <Card className="bg-surface-2">
        <p className="text-sm">Paid checkout opens after the closed beta; every account is on Free for now. Paid monthly credits roll forward up to {ROLLOVER_MONTHS} months of allowance, purchased packs never expire, and free credits reset monthly.</p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <CreditsCard wallets={wallets ?? []} plan={current} />
        <Card>
          <CardHeader title="Recent credit activity" />
          {(txs ?? []).length === 0 ? <p className="text-sm text-muted">No activity yet.</p> : (
            <ul className="space-y-2 text-sm">
              {(txs ?? []).map((t) => (
                <li key={t.id} className="flex justify-between gap-3"><span className="text-muted">{t.reason.replaceAll("_", " ")} · {t.category}</span><span className={cn("tabular-nums", t.delta > 0 ? "text-positive" : "")}>{t.delta > 0 ? "+" : ""}{t.delta}</span></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
