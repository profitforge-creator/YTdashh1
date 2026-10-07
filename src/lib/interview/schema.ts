import { GENRES } from "@/lib/constants";

export type Route = "discover" | "idea" | "improve";

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

export interface Question {
  id: string;
  group: string;
  prompt: string;
  type: "single" | "multi" | "text";
  options?: Option[];
  placeholder?: string;
  /** Text answers may be skipped when optional. */
  optional?: boolean;
  routes?: Route[];
}

const opt = (value: string, hint?: string): Option => (hint ? { value, label: value, hint } : { value, label: value });

// Order follows the product spec's interview topics. Questions are skipped when they don't fit the route.
export const QUESTIONS: Question[] = [
  { id: "idea", group: "Concept", type: "text", routes: ["idea"],
    prompt: "Describe your game idea in your own words. What is it and why would players love it?",
    placeholder: "e.g. A co-op tower defense where players survive waves while building a base on a floating island…" },
  { id: "current_game", group: "Concept", type: "text", routes: ["improve"],
    prompt: "Describe your current game: what it is, who plays it, and how it plays.",
    placeholder: "Paste a description, link, or notes about the game." },
  { id: "problems", group: "Concept", type: "text", routes: ["improve"],
    prompt: "What are your current metrics and the biggest problems? (low retention, weak monetization, bugs…)",
    placeholder: "e.g. 300 CCU, D1 18%, players leave after the tutorial." },
  { id: "genres", group: "Concept", type: "multi",
    prompt: "Which genres are you targeting?",
    options: GENRES.map((g) => opt(g)) },
  { id: "comparables", group: "Concept", type: "text", optional: true,
    prompt: "Name comparable Roblox experiences you like (optional).",
    placeholder: "e.g. Tower Defense Simulator, Blox Fruits" },
  { id: "audience", group: "Players", type: "multi",
    prompt: "Who is the target audience and which devices?",
    options: [opt("Kids 8–12"), opt("Teens 13–17"), opt("Older players 18+"), opt("Mobile-first"), opt("PC / console"), opt("Cross-platform")] },
  { id: "core_loop", group: "Gameplay", type: "text",
    prompt: "What is the core gameplay loop? What does a player do every minute?",
    placeholder: "e.g. Fight enemies → earn coins → upgrade gear → take on harder zones." },
  { id: "progression", group: "Gameplay", type: "single",
    prompt: "How do players progress and come back?",
    options: [opt("Levels & XP", "Classic power curve"), opt("Unlock-based", "New zones, items, abilities"),
      opt("Rebirth / prestige", "Reset for multipliers"), opt("Quest / story driven", "Narrative pull"),
      opt("Collection", "Pets, items, completion"), opt("Competitive ranks", "Seasons and ladders")] },
  { id: "map", group: "World", type: "single",
    prompt: "How is the map structured?",
    options: [opt("Hub + zones"), opt("Open world"), opt("Linear stages"), opt("Single arena"), opt("Procedural / rounds")] },
  { id: "ui_style", group: "World", type: "single",
    prompt: "What UI and interaction style fits?",
    options: [opt("Minimal & clean"), opt("Chunky cartoon"), opt("Stylized sci‑fi"), opt("Dark & gritty"), opt("Anime-inspired")] },
  { id: "interaction", group: "Gameplay", type: "single",
    prompt: "What's the primary interaction system?",
    options: [opt("Combat"), opt("Collecting / farming"), opt("Building"), opt("Racing / movement"), opt("Puzzle / obby"), opt("Social / roleplay")] },
  { id: "art", group: "World", type: "text", optional: true,
    prompt: "Describe the art direction or reference games (optional).",
    placeholder: "e.g. Low-poly, bright colors, soft shadows." },
  { id: "economy", group: "Economy", type: "single",
    prompt: "How should the economy work?",
    options: [opt("Single soft currency"), opt("Soft + premium currency"), opt("Multiple resources / crafting"), opt("No economy (score only)")] },
  { id: "monetization", group: "Economy", type: "multi",
    prompt: "Which monetization options do you want to explore?",
    options: [opt("Gamepasses"), opt("Developer products"), opt("Private servers"), opt("Cosmetics"), opt("Subscriptions"), opt("None yet")] },
  { id: "social", group: "Social", type: "multi",
    prompt: "Which social and multiplayer features matter?",
    options: [opt("Co-op"), opt("PvP"), opt("Trading"), opt("Guilds / clans"), opt("Leaderboards"), opt("Single-player focus")] },
  { id: "existing", group: "Production", type: "text", optional: true,
    prompt: "List any existing assets or scripts you already have (optional).",
    placeholder: "e.g. A weapon system module, custom character model." },
  { id: "dev_time", group: "Production", type: "single",
    prompt: "How much development time do you have?",
    options: [opt("Under 2 weeks"), opt("1–2 months"), opt("3–6 months"), opt("6+ months")] },
  { id: "team", group: "Production", type: "single",
    prompt: "What does your team look like?",
    options: [opt("Solo"), opt("2–3 people"), opt("4–8 people"), opt("9+ people")] },
  { id: "budget", group: "Production", type: "single",
    prompt: "What is your project budget?",
    options: [opt("$0"), opt("Under $200"), opt("$200–$1,000"), opt("$1,000–$5,000"), opt("$5,000+")] },
  { id: "community_plan", group: "Launch", type: "single",
    prompt: "What's your community-building plan?",
    options: [opt("Build in public"), opt("Discord first"), opt("Creator partnerships"), opt("Launch then grow"), opt("No plan yet")] },
  { id: "discord", group: "Launch", type: "single",
    prompt: "Where are you with Discord?",
    options: [opt("Need a full setup"), opt("Have a basic server"), opt("Active server"), opt("Not planning one")] },
  { id: "social_launch", group: "Launch", type: "multi",
    prompt: "Which social platforms will you launch on?",
    options: [opt("TikTok"), opt("YouTube Shorts"), opt("Instagram"), opt("X"), opt("Reddit"), opt("None yet")] },
];

export function questionsForRoute(route: Route): Question[] {
  return QUESTIONS.filter((q) => !q.routes || q.routes.includes(route));
}

export type AnswerValue = string | string[];
export type Answers = Record<string, AnswerValue>;

export function isAnswered(q: Question, answers: Answers): boolean {
  const v = answers[q.id];
  if (v === undefined) return false;
  return Array.isArray(v) ? v.length > 0 : v.trim().length > 0;
}

export function nextQuestionIndex(route: Route, answers: Answers, skipped: string[]): number {
  const qs = questionsForRoute(route);
  const idx = qs.findIndex((q) => !isAnswered(q, answers) && !skipped.includes(q.id));
  return idx === -1 ? qs.length : idx;
}

export interface SummaryItem {
  id: string;
  label: string;
  value: string;
}

const LABELS: Record<string, string> = {
  idea: "Idea", current_game: "Current game", problems: "Metrics & problems", genres: "Genres",
  comparables: "Comparable games", audience: "Audience & devices", core_loop: "Core loop",
  progression: "Progression", map: "Map structure", ui_style: "UI style", interaction: "Primary interaction",
  art: "Art direction", economy: "Economy", monetization: "Monetization", social: "Social & multiplayer",
  existing: "Existing assets & scripts", dev_time: "Development time", team: "Team", budget: "Budget",
  community_plan: "Community plan", discord: "Discord", social_launch: "Social launch",
};

export function buildSummary(route: Route, answers: Answers): SummaryItem[] {
  const items: SummaryItem[] = [];
  for (const q of questionsForRoute(route)) {
    const v = answers[q.id];
    if (v === undefined) continue;
    const value = Array.isArray(v) ? v.join(", ") : v.trim();
    if (!value) continue;
    items.push({ id: q.id, label: LABELS[q.id] ?? q.id, value });
  }
  const followups = answers["followups"];
  if (Array.isArray(followups)) {
    followups.forEach((f, i) => items.push({ id: `followup_${i}`, label: "Follow-up", value: f }));
  }
  return items;
}

export function isInterviewComplete(route: Route, answers: Answers, skipped: string[]): boolean {
  return nextQuestionIndex(route, answers, skipped) >= questionsForRoute(route).length;
}
