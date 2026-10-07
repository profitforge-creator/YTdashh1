import { z } from "zod";
import { EXPERIENCE_LEVELS, GENRES, GOALS, SKILLS } from "@/lib/constants";

const experienceValues = EXPERIENCE_LEVELS.map((e) => e.value) as [string, ...string[]];

export const onboardingSchema = z.object({
  roles: z.array(z.enum(["developer", "specialist", "tester", "player"])).min(1, "Pick at least one role."),
  experience_level: z.enum(experienceValues, { message: "Choose your experience level." }),
  genres: z.array(z.enum(GENRES)).min(1, "Pick at least one genre.").max(8),
  skills: z.array(z.enum(SKILLS)).max(12),
  goals: z.array(z.enum(GOALS)).min(1, "Pick at least one goal.").max(8),
  weekly_hours: z.coerce.number().int().min(0).max(168),
  budget_usd: z.coerce.number().int().min(0).max(1_000_000),
  preferred_ai: z.enum(["claude", "chatgpt", "gemini"]),
  display_name: z.string().trim().min(1, "Add a display name.").max(40),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
