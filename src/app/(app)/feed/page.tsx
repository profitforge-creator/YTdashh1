import Link from "next/link";
import { Newspaper } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Composer } from "@/features/community/composer";
import { PostCard } from "@/features/community/post-card";
import { loadFeed } from "@/features/community/queries";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Feed" };

const TABS = [
  { id: "discover", label: "Discover" },
  { id: "following", label: "Following" },
  { id: "bookmarks", label: "Saved" },
] as const;

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const tab = TABS.find((t) => t.id === tabParam)?.id ?? "discover";
  const viewer = await requireViewer();
  const supabase = await createClient();

  const [feed, { data: memberships }] = await Promise.all([
    loadFeed(supabase, viewer.id, tab),
    supabase.from("project_members").select("project_id").eq("user_id", viewer.id).eq("role", "owner"),
  ]);
  const ids = (memberships ?? []).map((m) => m.project_id);
  const { data: projects } = ids.length ? await supabase.from("projects").select("id, title").in("id", ids).eq("status", "active") : { data: [] };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Feed" subtitle="Progress, clips and feedback from Roblox creators." />
      <Composer userId={viewer.id} projects={projects ?? []} />
      <nav aria-label="Feed tabs" className="grid grid-cols-3 rounded-xl border p-1">
        {TABS.map((t) => (
          <Link key={t.id} href={`/feed?tab=${t.id}`} aria-current={t.id === tab ? "page" : undefined} className={cn("rounded-lg py-1.5 text-center text-sm transition-colors", t.id === tab ? "bg-surface-3 text-fg" : "text-muted hover:text-fg")}>
            {t.label}
          </Link>
        ))}
      </nav>
      {feed.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="h-6 w-6" aria-hidden />}
          title={tab === "following" ? "Nothing from people you follow yet" : tab === "bookmarks" ? "No saved posts" : "No posts yet"}
          body={tab === "following" ? "Follow creators from Discover to fill this tab." : "Be the first to post."}
        />
      ) : (
        <div className="space-y-3">{feed.map((item) => <PostCard key={item.post.id} item={item} viewerId={viewer.id} />)}</div>
      )}
    </div>
  );
}
