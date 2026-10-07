import type { CreditCategory, PlanTier } from "@/types/database";

export const CREDIT_CATEGORIES: { value: CreditCategory; label: string }[] = [
  { value: "research", label: "Research" },
  { value: "blueprints", label: "Blueprints" },
  { value: "scripts", label: "Scripts" },
  { value: "images", label: "Images" },
  { value: "studio", label: "Studio actions" },
];

/** Credits debited server-side per action. Interview turns are free but rate-limited. */
export const CREDIT_COSTS = {
  concepts: { category: "research", amount: 10 },
} as const satisfies Record<string, { category: CreditCategory; amount: number }>;

export interface PlanInfo {
  tier: PlanTier;
  name: string;
  monthlyUsd: number;
  annualUsd: number;
  tagline: string;
  features: string[];
  allowances: Record<CreditCategory, number>;
}

// Annual price is 10% off twelve months. Keep these in sync with plan_allowances in the migrations.
export const PLANS: PlanInfo[] = [
  {
    tier: "free", name: "Free", monthlyUsd: 0, annualUsd: 0,
    tagline: "Community, jobs and a limited concept preview.",
    features: ["Community, feed and profile", "Browse and apply to jobs", "Limited concept preview"],
    allowances: { research: 10, blueprints: 0, scripts: 0, images: 0, studio: 0 },
  },
  {
    tier: "creator", name: "Creator", monthlyUsd: 30, annualUsd: 324,
    tagline: "Full blueprint allowance for solo projects.",
    features: ["Full blueprint allowance", "Image generation", "Solo projects"],
    allowances: { research: 100, blueprints: 60, scripts: 100, images: 40, studio: 0 },
  },
  {
    tier: "pro", name: "Pro", monthlyUsd: 50, annualUsd: 540,
    tagline: "More research, scripts and images plus advanced workflow tools.",
    features: ["Higher research, script and image credits", "Advanced workflow tools"],
    allowances: { research: 250, blueprints: 150, scripts: 300, images: 120, studio: 50 },
  },
  {
    tier: "studio", name: "Studio", monthlyUsd: 100, annualUsd: 1080,
    tagline: "Maximum credits, team projects and early access.",
    features: ["Maximum included credits", "Direct Studio connection when released", "Advanced analytics", "Team projects", "Early features"],
    allowances: { research: 600, blueprints: 400, scripts: 800, images: 300, studio: 300 },
  },
];

export function planByTier(tier: PlanTier): PlanInfo {
  const plan = PLANS.find((p) => p.tier === tier);
  if (!plan) throw new Error(`Unknown plan: ${tier}`);
  return plan;
}

/** Paid monthly credits roll forward, capped at six months of allowance. */
export const ROLLOVER_MONTHS = 6;
