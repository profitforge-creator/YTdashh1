import Link from "next/link";
import { Briefcase } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PriorityMetrics } from "@/features/analytics/analytics-overview";
import { BalanceCard } from "@/features/home/balance-card";
import { CreditsCard } from "@/features/home/credits-card";
import { CurrentProjectCard } from "@/features/home/current-project-card";
import { NextTaskCard } from "@/features/home/next-task-card";
import { RankCard } from "@/features/home/rank-card";
import { requireViewer } from "@/lib/auth";
import { JOB_CATEGORIES } from "@/lib/constants";
import { recomputeRank } from "@/lib/rank/recompute";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCents, timeAgo } from "@/lib/utils";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const viewer = await requireViewer();
  const supabase = await createClient();

  // Monthly credit allowance is granted lazily on first visit of the month.
  await createAdminClient().rpc("grant_monthly_credits", { p_user: viewer.id });

  const { data: memberships } = await supabase.from("project_members").select("project_id").eq("user_id", viewer.id);
  const projectIds = (memberships ?? []).map((m) => m.project_id);
  const { data: projectList } = projectIds.length
    ? await supabase.from("projects").select("*").in("id", projectIds).eq("status", "active").order("updated_at", { ascending: false }).limit(1)
    : { data: [] };
  const project = projectList?.[0] ?? null;
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const [
    { data: metrics }, { data: tasks }, { data: wallets }, { data: subscription }, { data: balance },
    { data: jobs }, { data: notifications }, { data: posts },
  ] = await Promise.all([
    project ? supabase.from("metric_snapshots").select("*").eq("project_id", project.id).gte("captured_on", since).order("captured_on") : Promise.resolve({ data: [] }),
    project ? supabase.from("build_tasks").select("*").eq("project_id", project.id).is("completed_at", null).order("position").limit(1) : Promise.resolve({ data: [] }),
    supabase.from("credit_wallets").select("*").eq("user_id", viewer.id),
    supabase.from("subscriptions").select("plan").eq("user_id", viewer.id).single(),
    supabase.from("balances").select("*").eq("user_id", viewer.id).maybeSingle(),
    supabase.from("jobs").select("id, title, category, payment_cents").eq("status", "open").neq("owner_id", viewer.id).order("created_at", { ascending: false }).limit(3),
    supabase.from("notifications").select("*").eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(3),
    supabase.from("posts").select("id, body, created_at, author_id").is("deleted_at", null).order("created_at", { ascending: false }).limit(3),
  ]);

  // Rank is derived from recorded events; recompute on visit so the card is never stale.
  await recomputeRank(viewer.id);
  const admin = createAdminClient();
  const [{ data: snap }, { data: allSnaps }] = await Promise.all([
    admin.from("rank_snapshots").select("score").eq("user_id", viewer.id).single(),
    admin.from("rank_snapshots").select("user_id, score").order("score", { ascending: false }),
  ]);
  const position = allSnaps ? allSnaps.findIndex((s) => s.user_id === viewer.id) + 1 : 0;

  const authorIds = [...new Set((posts ?? []).map((p) => p.author_id))];
  const { data: authors } = authorIds.length ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", authorIds) : { data: [] };

  return (
    <div className="space-y-5">
      <PageHeader title={`Hey, ${viewer.profile.display_name.split(" ")[0] ?? "builder"}`} subtitle="Here's where your game stands." />

      <div className="grid gap-4 lg:grid-cols-2">
        <CurrentProjectCard project={project} />
        <NextTaskCard task={tasks?.[0] ?? null} projectId={project?.id ?? null} />
      </div>

      <section aria-label="Game analytics" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">Game analytics · 30 days</h2>
          <Link href={project ? `/analytics?project=${project.id}` : "/analytics"} className="text-xs text-brand-hover hover:underline">Open analytics</Link>
        </div>
        {project ? <PriorityMetrics rows={metrics ?? []} /> : <Card><p className="text-sm text-muted">Metrics appear here once you create a project and add data.</p></Card>}
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <RankCard score={Number(snap?.score ?? 0)} position={position || null} total={allSnaps?.length ?? 0} />
        <BalanceCard balance={balance ?? null} />
        <CreditsCard wallets={wallets ?? []} plan={subscription?.plan ?? "free"} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Open jobs" action={<Link href="/work" className="text-xs text-brand-hover hover:underline">Browse all</Link>} />
          {(jobs ?? []).length === 0 ? (
            <p className="text-sm text-muted">No open jobs right now.</p>
          ) : (
            <ul className="space-y-2">
              {(jobs ?? []).map((j) => (
                <li key={j.id}>
                  <Link href={`/work/${j.id}`} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3 transition-colors hover:bg-surface-3">
                    <Briefcase className="h-4 w-4 shrink-0 text-faint" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm">{j.title}</span>
                    <span className="text-xs text-muted">{JOB_CATEGORIES.find((c) => c.value === j.category)?.label}</span>
                    <span className="text-sm font-medium tabular-nums">{formatCents(j.payment_cents)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Community" action={<Link href="/feed" className="text-xs text-brand-hover hover:underline">Open feed</Link>} />
          {(posts ?? []).length === 0 ? (
            <p className="text-sm text-muted">Nothing posted yet. Be the first.</p>
          ) : (
            <ul className="space-y-3">
              {(posts ?? []).map((p) => {
                const a = authors?.find((x) => x.id === p.author_id);
                return (
                  <li key={p.id} className="flex gap-3">
                    <Avatar name={a?.display_name ?? "?"} src={a?.avatar_url} size={32} />
                    <div className="min-w-0">
                      <p className="text-xs text-muted">{a?.display_name ?? "Creator"} · {timeAgo(p.created_at)}</p>
                      <p className="line-clamp-2 text-sm">{p.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Notifications" action={<Link href="/notifications" className="text-xs text-brand-hover hover:underline">See all</Link>} />
        {(notifications ?? []).length === 0 ? (
          <p className="text-sm text-muted">You're all caught up.</p>
        ) : (
          <ul className="space-y-2">
            {(notifications ?? []).map((n) => (
              <li key={n.id}>
                <Link href={n.href ?? "/notifications"} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3 text-sm hover:bg-surface-3">
                  <span className={n.read_at ? "text-muted" : ""}>{n.title}</span>
                  <span className="text-xs text-faint">{timeAgo(n.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
