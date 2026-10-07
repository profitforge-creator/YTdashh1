import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CREDIT_CATEGORIES, planByTier } from "@/lib/config/plans";
import type { CreditWalletRow, PlanTier } from "@/types/database";

export function CreditsCard({ wallets, plan }: { wallets: CreditWalletRow[]; plan: PlanTier }) {
  const info = planByTier(plan);
  return (
    <Card>
      <CardHeader title="Generation credits" action={<Link href="/plans" className="text-xs text-brand-hover hover:underline">{info.name} plan</Link>} />
      <ul className="space-y-3">
        {CREDIT_CATEGORIES.map((c) => {
          const w = wallets.find((x) => x.category === c.value);
          const total = (w?.subscription_balance ?? 0) + (w?.purchased_balance ?? 0);
          const allowance = info.allowances[c.value];
          const pct = allowance > 0 ? Math.min(100, (total / allowance) * 100) : total > 0 ? 100 : 0;
          return (
            <li key={c.value}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted">{c.label}</span>
                <span className="tabular-nums">{total}{allowance > 0 ? ` / ${allowance} monthly` : ""}</span>
              </div>
              <Progress value={pct} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
