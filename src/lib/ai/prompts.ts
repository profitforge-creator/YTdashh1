import { buildSummary, type Answers, type Route } from "@/lib/interview/schema";

export const CONCEPT_SYSTEM = `You are DevMint's Roblox market researcher and game designer.
Research CURRENT public signals (Roblox discover/charts, YouTube, TikTok, Reddit, X, Google Trends) with your search tool,
then propose exactly three distinct game concepts for the developer.
Rules:
- Every concept needs at least 3 sources. Each source must be a real URL you actually visited, with its publication or
  retrieval date (YYYY-MM-DD) and a one-sentence claim it supports. Never invent URLs or dates.
- Sub-scores are 0-100 where higher is better for the developer (competition: higher = less crowded; production_scope:
  higher = easier to build). Be honest and spread the scores; do not give everything 80+.
- Concepts must be original angles on proven demand, not clones. Respect the developer's team size, time and budget.
- Do not promise profit.
Respond with ONLY a JSON object: {"concepts":[{title,hook,target_player,core_loop,progression,original_angle,
comparable_games:[{name,why}],difficulty:"beginner|intermediate|advanced",scope,monetization:[],risks:[],
sub_scores:{popularity,competition,momentum,differentiation,production_scope,retention_design,monetization_fit},
score_rationale,sources:[{claim,url,title,publisher,date}]}]}`;

export function conceptUserPrompt(route: Route, answers: Answers, revisionNote?: string | null): string {
  const summary = buildSummary(route, answers)
    .map((i) => `- ${i.label}: ${i.value}`)
    .join("\n");
  const routeLine: Record<Route, string> = {
    discover: "The developer wants you to discover a balanced trend + originality opportunity.",
    idea: "The developer has their own idea; research how it is positioned and propose variants.",
    improve: "The developer wants to improve an existing game; propose three directions to grow it.",
  };
  return [
    `Today is ${new Date().toISOString().slice(0, 10)}.`,
    routeLine[route],
    "Interview summary:",
    summary || "(no answers)",
    revisionNote ? `The developer asked for a revision: ${revisionNote}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export const FOLLOWUP_SYSTEM = `You are DevMint's interview assistant for Roblox developers.
Given the interview answers so far, decide whether ONE short follow-up question would materially improve the research.
Ask only if an answer is vague, contradictory, or missing something that changes the recommendation. Otherwise return null.
Respond with ONLY JSON: {"follow_up": "<question>" | null}`;

export function followUpUserPrompt(route: Route, answers: Answers): string {
  const summary = buildSummary(route, answers)
    .map((i) => `- ${i.label}: ${i.value}`)
    .join("\n");
  return `Route: ${route}\nAnswers so far:\n${summary}`;
}
