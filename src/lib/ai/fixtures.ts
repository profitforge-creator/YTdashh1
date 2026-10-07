import type { Answers } from "@/lib/interview/schema";
import type { ConceptSetDraft } from "./schemas";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const asList = (v: Answers[string] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);

function clamp(n: number): number {
  return Math.max(20, Math.min(95, Math.round(n)));
}

/**
 * Deterministic stand-in for live research, used when AI_MODE=fixtures. Output is derived only from the
 * interview answers, so tests and local demos are repeatable. Sources are generic landing/search pages and
 * the UI labels fixture concepts so nobody mistakes them for real research.
 */
export function fixtureConcepts(answers: Answers, today: string, revisionNote?: string | null): ConceptSetDraft {
  const genres = asList(answers.genres);
  const genre = genres[0] ?? "Simulator";
  const interaction = asList(answers.interaction)[0] ?? "Collecting / farming";
  const progression = asList(answers.progression)[0] ?? "Unlock-based";
  const seed = hash(JSON.stringify(answers) + (revisionNote ?? ""));
  const q = encodeURIComponent(genre + " roblox");

  const sources = (angle: string) => [
    { claim: `Fixture: check the Roblox charts for current ${genre} activity (${angle}).`, url: "https://www.roblox.com/charts", title: "Roblox Charts", publisher: "Roblox", date: today },
    { claim: `Fixture: search interest for "${genre} Roblox" can be reviewed on Google Trends.`, url: `https://trends.google.com/trends/explore?q=${q}`, title: `Google Trends: ${genre} Roblox`, publisher: "Google Trends", date: today },
    { claim: `Fixture: recent ${genre} gameplay videos show how players talk about the genre.`, url: `https://www.youtube.com/results?search_query=${q}`, title: `YouTube: ${genre} Roblox`, publisher: "YouTube", date: today },
  ];

  const variants = [
    { name: "Fresh Take", angle: "a fresh twist on a proven loop", hookTail: "with a cleaner first-session hook" },
    { name: "Social Spin", angle: "making the loop social and shareable", hookTail: "built around co-op moments worth clipping" },
    { name: "Long Game", angle: "deep progression for long-term retention", hookTail: "with a progression ladder that rewards returning" },
  ] as const;

  const concepts = variants.map((v, i) => {
    const jitter = ((seed >> (i * 5)) % 13) - 6;
    return {
      title: `${genre} ${v.name}`,
      hook: `A ${genre.toLowerCase()} experience about ${interaction.toLowerCase()} ${v.hookTail}.`,
      target_player: asList(answers.audience).join(", ") || "Teens who play Roblox daily",
      core_loop: typeof answers.core_loop === "string" && answers.core_loop ? answers.core_loop : `${interaction} → earn rewards → upgrade → repeat in harder areas.`,
      progression: `${progression} progression with a clear next goal visible at every step.`,
      original_angle: `Takes ${genre.toLowerCase()} and focuses on ${v.angle}.`,
      comparable_games: [
        { name: `Top ${genre} experience`, why: "Established demand for the core loop." },
        { name: `Rising ${genre} experience`, why: "Shows recent momentum for a similar angle." },
      ],
      difficulty: (["beginner", "intermediate", "advanced"] as const)[i % 3] ?? "intermediate",
      scope: i === 2 ? "Large: plan for a phased release." : "Moderate: a focused first release is realistic.",
      monetization: ["Gamepasses for convenience", "Developer products for boosts", "Cosmetic items"],
      risks: ["A crowded genre can bury new releases.", "Retention depends on the first five minutes."],
      sub_scores: {
        popularity: clamp(70 + jitter),
        competition: clamp(45 + jitter + i * 6),
        momentum: clamp(60 + jitter),
        differentiation: clamp(55 + i * 8 + jitter),
        production_scope: clamp(80 - i * 12 + jitter),
        retention_design: clamp(58 + i * 7 + jitter),
        monetization_fit: clamp(65 + jitter),
      },
      score_rationale: `Fixture scoring derived from interview answers for ${v.angle}; not based on live research.`,
      sources: sources(v.angle),
    };
  });

  return { concepts: [concepts[0], concepts[1], concepts[2]] as ConceptSetDraft["concepts"] };
}

export function fixtureFollowUp(answers: Answers): string | null {
  const loop = answers.core_loop;
  if (typeof loop === "string" && loop.trim().length > 0 && loop.trim().length < 40) {
    return "Your core loop is short. What makes the second hour as fun as the first five minutes?";
  }
  const followups = answers.followups;
  if (Array.isArray(followups) && followups.length > 0) return null;
  const idea = answers.idea;
  if (typeof idea === "string" && idea.trim().length > 0 && idea.trim().length < 60) {
    return "Can you say more about what makes your idea different from games that already exist?";
  }
  return null;
}
