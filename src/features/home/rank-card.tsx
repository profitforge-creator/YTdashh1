import Link from "next/link";
import { Trophy } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TIERS, tierProgress } from "@/lib/rank/score";

export function RankCard({ score, position, total }: { score: number; position: number | null; total: number }) {
  const p = tierProgress(score);
  const label = (t: string) => TIERS.find((x) => x.tier === t)?.label ?? t;
  return (
    <Card>
      <CardHeader title="Developer rank" action={<Link href="/leaderboard" className="text-xs text-brand-hover hover:underline">Leaderboard</Link>} />
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-[#ff8da1]"><Trophy className="h-5 w-5" aria-hidden /></span>
        <div>
          <p className="text-lg font-semibold">{label(p.current)} · {score.toFixed(1)}</p>
          <p className="text-xs text-muted">{position ? `#${position} of ${total}` : "Unranked"}</p>
        </div>
      </div>
      <div className="mt-4">
        <Progress value={p.pct} />
        <p className="mt-1.5 text-xs text-muted">
          {p.next ? `${p.pointsToNext.toFixed(1)} points to ${label(p.next)}` : "Top tier reached"}
        </p>
      </div>
    </Card>
  );
}
