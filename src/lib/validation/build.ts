import { z } from "zod";

export const createProjectSchema = z.object({
  route: z.enum(["discover", "idea", "improve"]),
  title: z.string().trim().max(120).optional(),
  provider: z.enum(["claude", "chatgpt", "gemini"]),
});

export const answerSchema = z.object({
  projectId: z.string().uuid(),
  questionId: z.string().min(1).max(40),
  value: z.union([z.string().max(4000), z.array(z.string().max(120)).max(20)]).optional(),
  skip: z.boolean().optional(),
});

export const summaryItemSchema = z.object({
  id: z.string().max(60),
  label: z.string().max(60),
  value: z.string().min(1).max(4000),
});

export const confirmSchema = z.object({
  projectId: z.string().uuid(),
  items: z.array(summaryItemSchema).min(1).max(40),
});
