import { describe, expect, it } from "vitest";
import { buildSummary, isInterviewComplete, nextQuestionIndex, questionsForRoute } from "./schema";

describe("interview routes", () => {
  it("shows route-specific questions only", () => {
    const ids = (r: "discover" | "idea" | "improve") => questionsForRoute(r).map((q) => q.id);
    expect(ids("idea")).toContain("idea");
    expect(ids("discover")).not.toContain("idea");
    expect(ids("improve")).toContain("problems");
    expect(ids("idea")).not.toContain("problems");
  });

  it("covers every topic from the spec", () => {
    const ids = questionsForRoute("idea").map((q) => q.id);
    for (const topic of ["genres", "audience", "core_loop", "progression", "map", "ui_style", "interaction", "art", "economy", "monetization", "social", "existing", "dev_time", "team", "budget", "community_plan", "discord", "social_launch"]) {
      expect(ids).toContain(topic);
    }
  });
});

describe("interview progress", () => {
  it("advances past answered and skipped questions", () => {
    const qs = questionsForRoute("discover");
    expect(nextQuestionIndex("discover", {}, [])).toBe(0);
    expect(nextQuestionIndex("discover", { [qs[0]!.id]: ["Obby"] }, [])).toBe(1);
    expect(nextQuestionIndex("discover", {}, [qs[0]!.id])).toBe(1);
  });

  it("completes when every question is answered or skipped", () => {
    const answers: Record<string, string> = {};
    for (const q of questionsForRoute("discover")) answers[q.id] = q.type === "multi" ? "x" : "y";
    expect(isInterviewComplete("discover", answers, [])).toBe(true);
  });

  it("builds a summary from answers including follow-ups", () => {
    const s = buildSummary("discover", { genres: ["Obby", "Tycoon"], followups: ["Why? — because"] });
    expect(s.find((i) => i.id === "genres")?.value).toBe("Obby, Tycoon");
    expect(s.some((i) => i.label === "Follow-up")).toBe(true);
  });
});
