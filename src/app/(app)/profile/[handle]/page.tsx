import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { FollowButton } from "@/features/community/follow-button";
import { PostCard } from "@/features/community/post-card";
import { hydratePosts } from "@/features/community/queries";
import { ProfileSafety } from "@/features/community/profile-safety";
import { StartConversation } from "@/features/messages/start-conversation";
import { ProfileHeader } from "@/features/profile/profile-header";
import { loadProfileMeta } from "@/features/profile/profile-data";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Profile" };

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").ilike("handle", handle).maybeSingle();
  if (!profile) notFound();
  if (profile.id === viewer.id) redirect("/profile");

  const [meta, { data: posts }, { data: follow }, { data: block }, { data: mute }, { data: blockedBy }] = await Promise.all([
    loadProfileMeta(supabase, profile.id),
    supabase.from("posts").select("*").eq("author_id", profile.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(10),
    supabase.from("follows").select("follower_id").eq("follower_id", viewer.id).eq("followee_id", profile.id).maybeSingle(),
    supabase.from("blocks").select("blocker_id").eq("blocker_id", viewer.id).eq("blocked_id", profile.id).maybeSingle(),
    supabase.from("mutes").select("muter_id").eq("muter_id", viewer.id).eq("muted_id", profile.id).maybeSingle(),
    supabase.from("blocks").select("blocker_id").eq("blocker_id", profile.id).eq("blocked_id", viewer.id).maybeSingle(),
  ]);
  const feed = await hydratePosts(supabase, posts ?? []);
  const canContact = !block && !blockedBy;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <ProfileHeader profile={profile} {...meta}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {canContact ? <FollowButton userId={profile.id} initialFollowing={Boolean(follow)} /> : null}
            <ProfileSafety userId={profile.id} blocked={Boolean(block)} muted={Boolean(mute)} />
          </div>
          {canContact ? <StartConversation recipientId={profile.id} open={profile.dm_policy === "open"} /> : null}
        </div>
      </ProfileHeader>
      <section aria-label="Posts" className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">Posts</h2>
        {feed.length === 0 ? <Card><p className="text-sm text-muted">No posts yet.</p></Card> : feed.map((item) => <PostCard key={item.post.id} item={item} viewerId={viewer.id} />)}
      </section>
    </div>
  );
}
