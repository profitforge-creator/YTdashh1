import { describe, expect, it } from "vitest";
import { fixtureConcepts, fixtureFollowUp } from "./fixtures";
import { confidenceFor, opportunityScore, OPPORTUNITY_WEIGHTS } from "./opportunity";
import { conceptSetSchema } from "./schemas";
import { isSafePublicUrl } from "./verify-sources";

describe("opportunity score", () => {
  it("has weights summing to 1", () => {
    expect(Object.values(OPPORTUNITY_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it("is computed from sub-scores, bounded 0-100", () => {
    const all = (n: number) => ({ popularity: n, competition: n, momentum: n, differentiation: n, production_scope: n, retention_design: n, monetization_fit: n });
    expect(opportunityScore(all(0))).toBe(0);
    expect(opportunityScore(all(100))).toBe(100);
    expect(opportunityScore(all(60))).toBe(60);
  });
});

describe("confidence", () => {
  const now = Date.parse("2026-10-07");
  it("is low with few sources", () => {
    expect(confidenceFor([{ publisher: "A", date: "2026-10-01" }], now)).toBe("low");
  });
  it("is high with many varied, recent sources", () => {
    const s = ["A", "B", "C", "A", "B"].map((publisher) => ({ publisher, date: "2026-09-30" }));
    expect(confidenceFor(s, now)).toBe("high");
  });
  it("is medium for several sources that are not recent", () => {
    const s = ["A", "B", "C", "A", "B"].map((publisher) => ({ publisher, date: "2025-01-01" }));
    expect(confidenceFor(s, now)).toBe("medium");
  });
});

describe("fixtures", () => {
  const answers = { genres: ["Tower Defense"], interaction: "Combat", progression: "Rebirth / prestige", core_loop: "Defend, upgrade, repeat across waves." };

  it("produce three schema-valid concepts", () => {
    const set = fixtureConcepts(answers, "2026-10-07");
    expect(conceptSetSchema.safeParse(set).success).toBe(true);
  });

  it("are deterministic for the same answers", () => {
    expect(fixtureConcepts(answers, "2026-10-07")).toEqual(fixtureConcepts(answers, "2026-10-07"));
  });

  it("asks a follow-up only for thin answers", () => {
    expect(fixtureFollowUp({ core_loop: "kill stuff" })).not.toBeNull();
    expect(fixtureFollowUp({ core_loop: "A detailed loop that clearly explains what the player does each minute." })).toBeNull();
  });
});

describe("isSafePublicUrl", () => {
  it.each([
    ["https://www.roblox.com/charts", true],
    ["http://www.roblox.com", false],
    ["https://localhost/x", false],
    ["https://127.0.0.1/x", false],
    ["https://169.254.169.254/latest/meta-data", false],
    ["https://metadata.internal/x", false],
    ["https://user:pw@example.com", false],
    ["https://example.com:8443", false],
    ["not a url", false],
  ])("%s -> %s", (url, expected) => {
    expect(isSafePublicUrl(url)).toBe(expected);
  });
});
