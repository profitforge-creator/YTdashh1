import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { TIER_PERKS } from "./perks";
import { computeRank, deriveSpecialties, TIERS, type RankTier } from "./score";

const TIER_ORDER = TIERS.map((t) => t.tier);

/** Rebuilds one user's snapshot from their recorded events and grants any newly earned tier perks. */
export async function recomputeRank(userId: string): Promise<void> {
  const admin = createAdminClient();
  const [{ data: events }, { data: profile }] = await Promise.all([
    admin.from("rank_events").select("component, points, created_at").eq("user_id", userId),
    admin.from("profiles").select("roles, skills").eq("id", userId).single(),
  ]);
  if (!profile) return;

  const { data: previous } = await admin.from("rank_snapshots").select("tier").eq("user_id", userId).maybeSingle();
  const result = computeRank((events ?? []).map((e) => ({ component: e.component, points: Number(e.points), created_at: e.created_at })));
  await admin.from("rank_snapshots").upsert({
    user_id: userId,
    score: result.score,
    tier: result.tier,
    components: result.components as unknown as Json,
    specialties: deriveSpecialties(profile.roles, profile.skills, result.tier),
    computed_at: new Date().toISOString(),
  });

  const reached = TIER_ORDER.slice(0, TIER_ORDER.indexOf(result.tier) + 1);
  for (const tier of reached) await grantTierPerks(userId, tier);

  if (previous && TIER_ORDER.indexOf(result.tier) > TIER_ORDER.indexOf(previous.tier as RankTier)) {
    const label = TIERS.find((t) => t.tier === result.tier)?.label ?? result.tier;
    await admin.rpc("notify", {
      p_user: userId, p_kind: "rank", p_title: `You reached ${label}`, p_body: "New perks are waiting on your profile.",
      p_href: "/profile", p_immediate: false, p_group: null,
    });
  }
}

const SNAPSHOT_TTL_MS = 5 * 60_000;

/** Page-view helper: recompute only when the snapshot is missing or older than five minutes. */
export async function recomputeRankIfStale(userId: string): Promise<void> {
  const { data } = await createAdminClient().from("rank_snapshots").select("computed_at").eq("user_id", userId).maybeSingle();
  if (!data || Date.now() - Date.parse(data.computed_at) > SNAPSHOT_TTL_MS) await recomputeRank(userId);
}

async function grantTierPerks(userId: string, tier: RankTier): Promise<void> {
  const admin = createAdminClient();
  for (const perk of TIER_PERKS[tier]) {
    const dedupe = `tier:${userId}:${tier}:${perk.label}`;
    const { data, error } = await admin
      .from("perks")
      .upsert(
        { user_id: userId, kind: perk.kind, label: perk.label, meta: (perk.meta ?? {}) as Json, dedupe_key: dedupe },
        { onConflict: "dedupe_key", ignoreDuplicates: true },
      )
      .select("id");
    // ignoreDuplicates returns no row for an existing perk, so credits are granted exactly once.
    if (error || !data || data.length === 0) continue;

    if (perk.kind === "credits" && perk.meta && typeof perk.meta["category"] === "string" && typeof perk.meta["amount"] === "number") {
      const category = perk.meta["category"] as "research" | "blueprints" | "scripts" | "images" | "studio";
      const amount = perk.meta["amount"];
      const { data: wallet } = await admin.from("credit_wallets").select("purchased_balance").eq("user_id", userId).eq("category", category).single();
      if (wallet) {
        await admin.from("credit_wallets").update({ purchased_balance: wallet.purchased_balance + amount }).eq("user_id", userId).eq("category", category);
        await admin.from("credit_transactions").insert({ user_id: userId, category, delta: amount, bucket: "purchased", reason: `rank_perk:${tier}` });
      }
    }
  }
}

const STALE_MS = 5 * 60_000;

/** Refreshes snapshots that are missing or stale so the leaderboard reflects recent activity. */
export async function refreshStaleSnapshots(limit = 200): Promise<void> {
  const admin = createAdminClient();
  const [{ data: profiles }, { data: snaps }] = await Promise.all([
    admin.from("profiles").select("id").limit(limit),
    admin.from("rank_snapshots").select("user_id, computed_at"),
  ]);
  const computed = new Map((snaps ?? []).map((s) => [s.user_id, Date.parse(s.computed_at)]));
  const stale = (profiles ?? []).filter((p) => Date.now() - (computed.get(p.id) ?? 0) > STALE_MS);
  for (const p of stale) await recomputeRank(p.id);
}
