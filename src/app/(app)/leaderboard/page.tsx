import Link from "next/link";
import { Trophy } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireViewer } from "@/lib/auth";
import { LEADERBOARD_FILTERS, TIERS, type LeaderboardFilter } from "@/lib/rank/score";
import { refreshStaleSnapshots } from "@/lib/rank/recompute";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Leaderboard" };

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter: param } = await searchParams;
  const filter = (LEADERBOARD_FILTERS as readonly string[]).includes(param ?? "") ? (param as LeaderboardFilter) : "all";
  const viewer = await requireViewer();
  await refreshStaleSnapshots();
  const supabase = await createClient();

  let query = supabase.from("rank_snapshots").select("*").order("score", { ascending: false }).limit(100);
  if (filter !== "all") query = query.contains("specialties", [filter]);
  const { data: snaps } = await query;
  const ids = (snaps ?? []).map((s) => s.user_id);
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, display_name, handle, avatar_url, is_demo, is_official").in("id", ids) : { data: [] };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Leaderboard" subtitle="One board for everyone. Scores come from recorded events, not generation volume." />
      <nav aria-label="Specialty filter" className="scroll-thin flex gap-2 overflow-x-auto">
        {LEADERBOARD_FILTERS.map((f) => (
          <Link key={f} href={`/leaderboard?filter=${f}`} aria-current={f === filter ? "page" : undefined} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm capitalize", f === filter ? "border-brand bg-brand-soft" : "text-muted hover:text-fg")}>{f}</Link>
        ))}
      </nav>
      {(snaps ?? []).length === 0 ? <EmptyState icon={<Trophy className="h-6 w-6" aria-hidden />} title="No one ranked here yet" body="Complete work, ship milestones and contribute to the community to appear." /> : (
        <ol className="space-y-2">
          {(snaps ?? []).map((s, i) => {
            const p = people?.find((x) => x.id === s.user_id);
            if (!p) return null;
            const me = s.user_id === viewer.id;
            return (
              <li key={s.user_id}>
                <Link href={me ? "/profile" : `/profile/${p.handle}`} className={cn("flex items-center gap-3 rounded-xl border bg-surface p-3 hover:border-border-strong", me && "border-brand")}>
                  <span className={cn("w-7 text-center text-sm font-semibold tabular-nums", i < 3 ? "text-warning" : "text-muted")}>{i + 1}</span>
                  <Avatar name={p.display_name} src={p.avatar_url} size={36} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.display_name}{me ? " (you)" : ""}</p><p className="truncate text-xs text-muted">@{p.handle}{p.is_demo ? " · demo" : ""}</p></div>
                  <Badge tone="brand">{TIERS.find((t) => t.tier === s.tier)?.label ?? s.tier}</Badge>
                  <span className="w-12 text-right text-sm font-semibold tabular-nums">{Number(s.score).toFixed(1)}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
