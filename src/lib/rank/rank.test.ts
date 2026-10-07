import { describe, expect, it } from "vitest";
import { computeRank, GENERATION_CEILING, tierFor, tierProgress, WEIGHTS } from "./score";

const NOW = Date.parse("2026-10-07T00:00:00Z");
const day = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

describe("rank weights", () => {
  it("sum to 1", () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});

describe("computeRank", () => {
  it("is zero with no events", () => {
    expect(computeRank([], NOW).score).toBe(0);
  });

  it("caps generation volume so it cannot dominate", () => {
    const spam = Array.from({ length: 5000 }, () => ({ component: "generation" as const, points: 1, created_at: day(0) }));
    const result = computeRank(spam, NOW);
    // Only the activity component (10% weight) can benefit, and only up to the ceiling.
    expect(result.components.activity).toBeLessThanOrEqual((GENERATION_CEILING / 60) * 100 + 0.1);
    expect(result.score).toBeLessThan(2);
  });

  it("lets verified paid work outweigh generation", () => {
    const work = Array.from({ length: 10 }, () => ({ component: "paid_work" as const, points: 10, created_at: day(1) }));
    const gen = Array.from({ length: 1000 }, () => ({ component: "generation" as const, points: 1, created_at: day(1) }));
    expect(computeRank(work, NOW).score).toBeGreaterThan(computeRank(gen, NOW).score);
  });

  it("decays old events", () => {
    const fresh = computeRank([{ component: "paid_work", points: 50, created_at: day(0) }], NOW);
    const old = computeRank([{ component: "paid_work", points: 50, created_at: day(365) }], NOW);
    expect(old.score).toBeLessThan(fresh.score);
  });

  it("never exceeds 100 per component", () => {
    const huge = [{ component: "projects" as const, points: 1e9, created_at: day(0) }];
    expect(computeRank(huge, NOW).components.projects).toBe(100);
  });

  it("does not let negative reviews push a component below zero", () => {
    const bad = [{ component: "paid_work" as const, points: -50, created_at: day(0) }];
    expect(computeRank(bad, NOW).components.paid_work).toBe(0);
  });
});

describe("tierFor", () => {
  it("caps unverified users below established", () => {
    expect(tierFor(90, 0)).toBe("builder");
  });
  it("allows high tiers with verified work", () => {
    expect(tierFor(90, 5)).toBe("legend");
  });
});

describe("tierProgress", () => {
  it("reports progress to the next tier", () => {
    const p = tierProgress(25);
    expect(p.current).toBe("builder");
    expect(p.next).toBe("established");
    expect(p.pct).toBeCloseTo(50);
  });
});
