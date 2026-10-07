import type { AiProvider, AppRole, JobCategory } from "@/types/database";

export const ROLE_OPTIONS: { value: AppRole; label: string; blurb: string }[] = [
  { value: "developer", label: "Developer", blurb: "Build and run games, hire collaborators." },
  { value: "specialist", label: "Specialist", blurb: "Scripting, maps, UI, models, art and more." },
  { value: "tester", label: "Tester", blurb: "Get paid to playtest and report." },
  { value: "player", label: "Player", blurb: "Discover games and learn to build." },
];

export const EXPERIENCE_LEVELS = [
  { value: "new", label: "New to Roblox dev" },
  { value: "learning", label: "Learning (under 1 year)" },
  { value: "intermediate", label: "Intermediate (1–3 years)" },
  { value: "advanced", label: "Advanced (3+ years)" },
] as const;

export const GENRES = [
  "Obby", "Tycoon", "Simulator", "RPG", "Horror", "Fighting", "Tower Defense", "Roleplay",
  "Shooter", "Racing", "Survival", "Sports", "Party / Minigames", "Anime", "Strategy", "Puzzle",
] as const;

export const SKILLS = [
  "Luau scripting", "Map building", "UI design", "3D modeling", "Animation", "Thumbnails",
  "Game design", "Sound design", "Community management", "Discord setup", "Social media", "QA testing",
] as const;

export const GOALS = [
  "Ship my first game", "Grow an existing game", "Earn Robux", "Find a team", "Get paid for my skills",
  "Learn game development", "Test games for pay", "Build a following",
] as const;

export const AI_PROVIDERS: { value: AiProvider; label: string; blurb: string }[] = [
  { value: "claude", label: "Claude", blurb: "Anthropic" },
  { value: "chatgpt", label: "ChatGPT", blurb: "OpenAI" },
  { value: "gemini", label: "Gemini", blurb: "Google" },
];

export const JOB_CATEGORIES: { value: JobCategory; label: string }[] = [
  { value: "tester", label: "Tester" },
  { value: "scripter", label: "Scripter" },
  { value: "map_builder", label: "Map builder" },
  { value: "ui_designer", label: "UI designer" },
  { value: "modeler", label: "Modeler" },
  { value: "animator", label: "Animator" },
  { value: "thumbnail_artist", label: "Thumbnail artist" },
  { value: "community_manager", label: "Community manager" },
  { value: "discord_setup", label: "Discord setup" },
  { value: "social_media", label: "Social media" },
  { value: "other", label: "Other" },
];

export const STAGES = ["interview", "research", "concept", "blueprint", "assets", "scripts", "test"] as const;

export const STAGE_LABELS: Record<(typeof STAGES)[number], string> = {
  interview: "Interview",
  research: "Research",
  concept: "Concept",
  blueprint: "Blueprint",
  assets: "Assets",
  scripts: "Scripts",
  test: "Test",
};

export const REVIEW_WINDOW_DAYS = 7;
