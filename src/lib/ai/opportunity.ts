import type { SourceDraft, SubScores } from "./schemas";

/** Weights follow the spec's factor list. Differentiation carries the most so clones don't win on popularity alone. */
export const OPPORTUNITY_WEIGHTS: Record<keyof SubScores, number> = {
  popularity: 0.15,
  competition: 0.15,
  momentum: 0.15,
  differentiation: 0.2,
  production_scope: 0.1,
  retention_design: 0.15,
  monetization_fit: 0.1,
};

export const FACTOR_LABELS: Record<keyof SubScores, string> = {
  popularity: "Public popularity",
  competition: "Competition (higher = less crowded)",
  momentum: "Momentum",
  differentiation: "Differentiation",
  production_scope: "Production scope (higher = easier)",
  retention_design: "Retention design",
  monetization_fit: "Monetization fit",
};

export type Confidence = "low" | "medium" | "high";

/** The score is computed here, never taken from the model, so it is reproducible and auditable. */
export function opportunityScore(sub: SubScores): number {
  let total = 0;
  for (const key of Object.keys(OPPORTUNITY_WEIGHTS) as (keyof SubScores)[]) {
    total += sub[key] * OPPORTUNITY_WEIGHTS[key];
  }
  return Math.round(total);
}

export function confidenceFor(sources: Pick<SourceDraft, "publisher" | "date">[], now: number = Date.now()): Confidence {
  const publishers = new Set(sources.map((s) => s.publisher.toLowerCase()));
  const recent = sources.filter((s) => now - Date.parse(s.date) <= 90 * 86_400_000).length;
  if (sources.length >= 5 && publishers.size >= 3 && recent >= 3) return "high";
  if (sources.length >= 3 && publishers.size >= 2) return "medium";
  return "low";
}

export function explainScore(sub: SubScores, score: number, confidence: Confidence, rationale: string): string {
  const entries = (Object.keys(sub) as (keyof SubScores)[]).sort((a, b) => sub[b] - sub[a]);
  const best = entries[0];
  const worst = entries[entries.length - 1];
  const parts = [
    best && worst
      ? `Scored ${score}/100. Strongest factor: ${FACTOR_LABELS[best]} (${sub[best]}). Weakest: ${FACTOR_LABELS[worst]} (${sub[worst]}).`
      : `Scored ${score}/100.`,
    rationale,
    `Confidence is ${confidence} based on the number, variety and recency of cited sources. This compares the concept with public signals only and does not predict profit.`,
  ];
  return parts.join(" ");
}
