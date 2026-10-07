import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const sourceSchema = z.object({
  claim: z.string().min(8).max(400),
  url: z.string().url().refine((u) => /^https?:\/\//.test(u), "Must be http(s)"),
  title: z.string().min(2).max(200),
  publisher: z.string().min(2).max(80),
  date: isoDate,
});

export const subScoresSchema = z.object({
  popularity: z.number().min(0).max(100),
  competition: z.number().min(0).max(100),
  momentum: z.number().min(0).max(100),
  differentiation: z.number().min(0).max(100),
  production_scope: z.number().min(0).max(100),
  retention_design: z.number().min(0).max(100),
  monetization_fit: z.number().min(0).max(100),
});

export const conceptSchema = z.object({
  title: z.string().min(2).max(80),
  hook: z.string().min(10).max(220),
  target_player: z.string().min(5).max(300),
  core_loop: z.string().min(10).max(600),
  progression: z.string().min(10).max(600),
  original_angle: z.string().min(10).max(500),
  comparable_games: z.array(z.object({ name: z.string().min(1).max(80), why: z.string().min(3).max(240) })).min(1).max(6),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  scope: z.string().min(5).max(300),
  monetization: z.array(z.string().min(3).max(200)).min(1).max(6),
  risks: z.array(z.string().min(3).max(240)).min(1).max(6),
  sub_scores: subScoresSchema,
  score_rationale: z.string().min(20).max(900),
  sources: z.array(sourceSchema).min(2).max(10),
});

export const conceptSetSchema = z.object({ concepts: z.array(conceptSchema).length(3) });

export const followUpSchema = z.object({ follow_up: z.string().max(300).nullable() });

export type ConceptDraft = z.infer<typeof conceptSchema>;
export type ConceptSetDraft = z.infer<typeof conceptSetSchema>;
export type SubScores = z.infer<typeof subScoresSchema>;
export type SourceDraft = z.infer<typeof sourceSchema>;
