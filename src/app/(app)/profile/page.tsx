import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PostCard } from "@/features/community/post-card";
import { hydratePosts } from "@/features/community/queries";
import { ProfileForm } from "@/features/profile/profile-form";
import { ProfileHeader } from "@/features/profile/profile-header";
import { loadProfileMeta } from "@/features/profile/profile-data";
import { SignOutButton } from "@/features/profile/sign-out-button";
import { requireViewer } from "@/lib/auth";
import { recomputeRankIfStale } from "@/lib/rank/recompute";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Profile" };

const COMPONENT_LABELS: Record<string, string> = {
  game_performance: "Verified game performance · 30%",
  projects: "Projects and milestones · 25%",
  paid_work: "Paid work and reviews · 20%",
  community: "Community contributions · 15%",
  activity: "Building activity · 10%",
};

export default async function OwnProfilePage() {
  const viewer = await requireViewer();
  await recomputeRankIfStale(viewer.id);
  const supabase = await createClient();
  const [meta, { data: posts }] = await Promise.all([
    loadProfileMeta(supabase, viewer.id),
    supabase.from("posts").select("*").eq("author_id", viewer.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(10),
  ]);
  const feed = await hydratePosts(supabase, posts ?? []);
  const components = (meta.rank?.components ?? {}) as Record<string, number>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <ProfileHeader profile={viewer.profile} {...meta}>
        <div className="flex flex-wrap gap-2">
          <Link href="/plans" className="rounded-xl border px-3 py-2 text-sm hover:bg-surface-2">Plans &amp; credits</Link>
          <Link href="/work/balance" className="rounded-xl border px-3 py-2 text-sm hover:bg-surface-2">DevMint balance</Link>
          <Link href="/settings" className="rounded-xl border px-3 py-2 text-sm hover:bg-surface-2">Settings</Link>
          <Link href="/leaderboard" className="rounded-xl border px-3 py-2 text-sm hover:bg-surface-2">Leaderboard</Link>
          {viewer.profile.is_admin ? (
            <>
              <Link href="/admin/disputes" className="rounded-xl border px-3 py-2 text-sm hover:bg-surface-2">Dispute queue</Link>
              <Link href="/admin/reports" className="rounded-xl border px-3 py-2 text-sm hover:bg-surface-2">Moderation queue</Link>
            </>
          ) : null}
          <SignOutButton />
        </div>
      </ProfileHeader>

      <Card>
        <CardHeader title="Rank breakdown" />
        <ul className="space-y-3">
          {Object.entries(COMPONENT_LABELS).map(([key, label]) => (
            <li key={key}>
              <div className="mb-1 flex justify-between text-xs"><span className="text-muted">{label}</span><span className="tabular-nums">{(components[key] ?? 0).toFixed(1)}</span></div>
              <Progress value={components[key] ?? 0} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-faint">Rank is computed from recorded events with a half-life of 90 days. Raw AI generation volume is capped so unfinished output can&apos;t climb the board.</p>
      </Card>

      <Card>
        <CardHeader title="Perks" />
        {meta.perks.length === 0 ? <p className="text-sm text-muted">Reach the Builder tier to unlock your first perks.</p> : (
          <ul className="grid gap-2 sm:grid-cols-2">{meta.perks.map((p) => <li key={p.id} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">{p.label}</li>)}</ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Edit profile" />
        <ProfileForm initial={{ display_name: viewer.profile.display_name, handle: viewer.profile.handle, bio: viewer.profile.bio, dm_policy: viewer.profile.dm_policy }} />
      </Card>

      <section aria-label="Your posts" className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">Your posts</h2>
        {feed.length === 0 ? <p className="text-sm text-muted">You haven&apos;t posted yet.</p> : feed.map((item) => <PostCard key={item.post.id} item={item} viewerId={viewer.id} />)}
      </section>
    </div>
  );
}
