import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { formatCents } from "@/lib/utils";
import type { BalanceRow } from "@/types/database";

export function BalanceCard({ balance }: { balance: BalanceRow | null }) {
  return (
    <Card>
      <CardHeader title="DevMint balance" action={<Link href="/work/balance" className="text-xs text-brand-hover hover:underline">Details</Link>} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted">Available</p>
          <p className="text-xl font-semibold tabular-nums text-positive">{formatCents(balance?.available_cents ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Pending</p>
          <p className="text-xl font-semibold tabular-nums">{formatCents(balance?.pending_cents ?? 0)}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-faint">Test mode: no real money moves during the beta.</p>
    </Card>
  );
}
