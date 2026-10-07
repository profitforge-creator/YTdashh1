import type { RankEventRow } from "@/types/database";

export type RankComponent = RankEventRow["component"];

/** Spec weights: performance 30, projects 25, paid work 20, community 15, activity 10. */
export const WEIGHTS = {
  game_performance: 0.3,
  projects: 0.25,
  paid_work: 0.2,
  community: 0.15,
  activity: 0.1,
} as const;

/**
 * Points needed to max out a component (reach 100). Tuned so that no single component can be farmed.
 * Raw AI generation volume does not carry weight on its own; it is folded into "activity" under a hard ceiling.
 */
export const COMPONENT_TARGETS: Record<Exclude<RankComponent, "generation">, number> = {
  game_performance: 200,
  projects: 120,
  paid_work: 150,
  community: 150,
  activity: 60,
};

/** Generation can contribute at most this many points to the activity component, no matter the volume. */
export const GENERATION_CEILING = 6;
/** Per-event decay: half-life in days. Older events count less so rankings reflect recent work. */
export const HALF_LIFE_DAYS = 90;
/** Verified (paid or performance) work needed before a user can leave the newcomer tier. */
export const MIN_VERIFIED_EVENTS = 2;

export interface RankInputEvent {
  component: RankComponent;
  points: number;
  created_at: string;
}

export interface ComponentScores {
  game_performance: number;
  projects: number;
  paid_work: number;
  community: number;
  activity: number;
}

export interface RankResult {
  score: number;
  tier: RankTier;
  components: ComponentScores;
}

export type RankTier = "newcomer" | "builder" | "established" | "elite" | "legend";

export const TIERS: { tier: RankTier; min: number; label: string }[] = [
  { tier: "newcomer", min: 0, label: "Newcomer" },
  { tier: "builder", min: 15, label: "Builder" },
  { tier: "established", min: 35, label: "Established" },
  { tier: "elite", min: 60, label: "Elite" },
  { tier: "legend", min: 80, label: "Legend" },
];

export function decayFactor(createdAt: string, now: number): number {
  const ageDays = Math.max(0, (now - new Date(createdAt).getTime()) / 86_400_000);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

export function tierFor(score: number, verifiedEvents: number): RankTier {
  // Fraud/sample-size guard: without enough verified work, cap at "builder".
  const capped = verifiedEvents < MIN_VERIFIED_EVENTS ? Math.min(score, 34.9) : score;
  let result: RankTier = "newcomer";
  for (const t of TIERS) if (capped >= t.min) result = t.tier;
  return result;
}

export function computeRank(events: RankInputEvent[], now: number = Date.now()): RankResult {
  const sums: Record<RankComponent, number> = {
    game_performance: 0, projects: 0, paid_work: 0, community: 0, activity: 0, generation: 0,
  };
  let verified = 0;
  for (const e of events) {
    sums[e.component] += e.points * decayFactor(e.created_at, now);
    if ((e.component === "paid_work" || e.component === "game_performance") && e.points > 0) verified++;
  }

  const generation = Math.min(Math.max(sums.generation, 0), GENERATION_CEILING);
  const activityRaw = Math.max(sums.activity, 0) + generation;

  const raw: ComponentScores = {
    game_performance: Math.max(sums.game_performance, 0),
    projects: Math.max(sums.projects, 0),
    paid_work: Math.max(sums.paid_work, 0),
    community: Math.max(sums.community, 0),
    activity: activityRaw,
  };

  const components = {} as ComponentScores;
  let score = 0;
  for (const key of Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]) {
    const normalized = Math.min(100, (raw[key] / COMPONENT_TARGETS[key]) * 100);
    components[key] = Math.round(normalized * 10) / 10;
    score += normalized * WEIGHTS[key];
  }
  score = Math.round(score * 10) / 10;
  return { score, tier: tierFor(score, verified), components };
}

export function tierProgress(score: number): { current: RankTier; next: RankTier | null; pct: number; pointsToNext: number } {
  let idx = 0;
  TIERS.forEach((t, i) => {
    if (score >= t.min) idx = i;
  });
  const cur = TIERS[idx];
  const nxt = TIERS[idx + 1];
  if (!cur) return { current: "newcomer", next: null, pct: 0, pointsToNext: 0 };
  if (!nxt) return { current: cur.tier, next: null, pct: 100, pointsToNext: 0 };
  const pct = ((score - cur.min) / (nxt.min - cur.min)) * 100;
  return { current: cur.tier, next: nxt.tier, pct: Math.min(100, Math.max(0, pct)), pointsToNext: Math.max(0, nxt.min - score) };
}

const SPECIALTY_KEYWORDS: Record<string, string[]> = {
  scripter: ["luau scripting"],
  builder: ["map building"],
  artist: ["ui design", "3d modeling", "animation", "thumbnails"],
  tester: ["qa testing"],
};

export function deriveSpecialties(roles: string[], skills: string[], tier: RankTier): string[] {
  const out = new Set<string>();
  if (roles.includes("developer")) out.add("developer");
  if (roles.includes("tester")) out.add("tester");
  const lower = skills.map((s) => s.toLowerCase());
  for (const [spec, kws] of Object.entries(SPECIALTY_KEYWORDS)) {
    if (kws.some((k) => lower.includes(k))) out.add(spec);
  }
  if (tier === "newcomer") out.add("newcomer");
  return [...out];
}

export const LEADERBOARD_FILTERS = ["all", "developer", "scripter", "builder", "artist", "tester", "newcomer"] as const;
export type LeaderboardFilter = (typeof LEADERBOARD_FILTERS)[number];
