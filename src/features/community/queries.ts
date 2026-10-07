import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MediaRow, PostRow, ProfileRow, ProjectRow } from "@/types/database";

export interface FeedPost {
  post: PostRow;
  author: Pick<ProfileRow, "id" | "handle" | "display_name" | "avatar_url" | "is_official" | "is_demo">;
  media: (MediaRow & { url: string | null })[];
  project: Pick<ProjectRow, "id" | "title" | "cover_url" | "stage"> | null;
  original: FeedPost | null;
  stats: { likes: number; comments: number; reposts: number; liked: boolean; bookmarked: boolean; reposted: boolean };
}

type Client = Awaited<ReturnType<typeof createClient>>;

const AUTHOR_COLUMNS = "id, handle, display_name, avatar_url, is_official, is_demo";

/** Hydrates posts with author, media (signed URLs), attached project, repost source and viewer-specific stats. */
export async function hydratePosts(supabase: Client, posts: PostRow[], depth = 0): Promise<FeedPost[]> {
  if (posts.length === 0) return [];
  const ids = posts.map((p) => p.id);
  const authorIds = [...new Set(posts.map((p) => p.author_id))];
  const projectIds = [...new Set(posts.flatMap((p) => (p.project_id ? [p.project_id] : [])))];
  const originalIds = [...new Set(posts.flatMap((p) => (p.repost_of ? [p.repost_of] : [])))];

  const [{ data: authors }, { data: media }, { data: stats }, { data: projects }, { data: originals }] = await Promise.all([
    supabase.from("profiles").select(AUTHOR_COLUMNS).in("id", authorIds),
    supabase.from("media").select("*").in("post_id", ids),
    supabase.rpc("post_stats", { p_ids: ids }),
    projectIds.length ? supabase.from("projects").select("id, title, cover_url, stage").in("id", projectIds) : Promise.resolve({ data: [] }),
    originalIds.length && depth === 0 ? supabase.from("posts").select("*").in("id", originalIds).is("deleted_at", null) : Promise.resolve({ data: [] }),
  ]);

  const paths = (media ?? []).map((m) => m.storage_path);
  const signed = paths.length ? await supabase.storage.from("media").createSignedUrls(paths, 3600) : { data: [] };
  const urlByPath = new Map((signed.data ?? []).map((s) => [s.path ?? "", s.signedUrl]));
  const hydratedOriginals = await hydratePosts(supabase, originals ?? [], depth + 1);

  return posts.flatMap((post) => {
    const author = authors?.find((a) => a.id === post.author_id);
    if (!author) return [];
    const s = stats?.find((x) => x.post_id === post.id);
    return [
      {
        post,
        author,
        media: (media ?? []).filter((m) => m.post_id === post.id).map((m) => ({ ...m, url: urlByPath.get(m.storage_path) ?? null })),
        project: projects?.find((p) => p.id === post.project_id) ?? null,
        original: post.repost_of ? (hydratedOriginals.find((o) => o.post.id === post.repost_of) ?? null) : null,
        stats: {
          likes: Number(s?.likes ?? 0), comments: Number(s?.comments ?? 0), reposts: Number(s?.reposts ?? 0),
          liked: s?.liked ?? false, bookmarked: s?.bookmarked ?? false, reposted: s?.reposted ?? false,
        },
      },
    ];
  });
}

export async function loadFeed(supabase: Client, viewerId: string, tab: "discover" | "following" | "bookmarks"): Promise<FeedPost[]> {
  const { data: mutes } = await supabase.from("mutes").select("muted_id").eq("muter_id", viewerId);
  const mutedIds = (mutes ?? []).map((m) => m.muted_id);

  let query = supabase.from("posts").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(40);

  if (tab === "following") {
    const { data: follows } = await supabase.from("follows").select("followee_id").eq("follower_id", viewerId);
    const ids = [viewerId, ...(follows ?? []).map((f) => f.followee_id)];
    query = query.in("author_id", ids);
  } else if (tab === "bookmarks") {
    const { data: marks } = await supabase.from("bookmarks").select("post_id").eq("user_id", viewerId);
    const ids = (marks ?? []).map((m) => m.post_id);
    if (ids.length === 0) return [];
    query = query.in("id", ids);
  }
  const { data: posts } = await query;
  const filtered = (posts ?? []).filter((p) => !mutedIds.includes(p.author_id));
  return hydratePosts(supabase, filtered);
}
