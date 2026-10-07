import type { RankTier } from "./score";

export interface TierPerk {
  kind: "credits" | "profile_effect" | "badge" | "featured_game" | "early_access";
  label: string;
  meta?: Record<string, string | number>;
}

/** Perks granted when a user first reaches a tier. Rank never reduces marketplace fees. */
export const TIER_PERKS: Record<RankTier, TierPerk[]> = {
  newcomer: [{ kind: "badge", label: "Newcomer" }],
  builder: [
    { kind: "badge", label: "Builder" },
    { kind: "credits", label: "+20 research credits", meta: { category: "research", amount: 20 } },
  ],
  established: [
    { kind: "badge", label: "Established" },
    { kind: "profile_effect", label: "Crimson profile ring", meta: { effect: "ring" } },
    { kind: "credits", label: "+40 research credits", meta: { category: "research", amount: 40 } },
  ],
  elite: [
    { kind: "badge", label: "Elite" },
    { kind: "featured_game", label: "Featured game slot" },
    { kind: "early_access", label: "Early feature access" },
    { kind: "credits", label: "+60 blueprint credits", meta: { category: "blueprints", amount: 60 } },
  ],
  legend: [
    { kind: "badge", label: "Legend" },
    { kind: "profile_effect", label: "Animated profile glow", meta: { effect: "glow" } },
    { kind: "credits", label: "+100 blueprint credits", meta: { category: "blueprints", amount: 100 } },
  ],
};
