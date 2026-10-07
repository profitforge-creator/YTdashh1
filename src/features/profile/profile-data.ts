import "server-only";
import { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export async function loadProfileMeta(supabase: Client, userId: string) {
  const [{ data: rank }, { data: perks }, followers, following, { data: reviews }] = await Promise.all([
    supabase.from("rank_snapshots").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("perks").select("*").eq("user_id", userId).order("granted_at"),
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", userId),
    supabase.from("follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", userId),
    supabase.from("reviews").select("rating").eq("reviewee_id", userId),
  ]);
  const ratings = (reviews ?? []).map((r) => r.rating);
  return {
    rank: rank ?? null,
    perks: perks ?? [],
    followers: followers.count ?? 0,
    following: following.count ?? 0,
    rating: ratings.length ? { avg: ratings.reduce((a, b) => a + b, 0) / ratings.length, count: ratings.length } : null,
  };
}
