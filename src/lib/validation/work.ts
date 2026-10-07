import { z } from "zod";

export const createJobSchema = z.object({
  title: z.string().trim().min(3, "Add a short title.").max(120),
  description: z.string().trim().max(4000),
  category: z.enum(["tester", "scripter", "map_builder", "ui_designer", "modeler", "animator", "thumbnail_artist", "community_manager", "discord_setup", "social_media", "other"]),
  deliverables: z.string().trim().min(5, "List the exact deliverables.").max(2000),
  acceptance_conditions: z.string().trim().min(5, "State how you'll accept the work.").max(2000),
  deadline: z.string().refine((d) => !Number.isNaN(Date.parse(d)) && Date.parse(d) > Date.now(), "Pick a future deadline."),
  session_minutes: z.coerce.number().int().min(5).max(600).nullable().optional(),
  revisions_allowed: z.coerce.number().int().min(0).max(5),
  payment_dollars: z.coerce.number().min(5, "Minimum $5 per slot.").max(10_000),
  slots: z.coerce.number().int().min(1).max(10),
  projectId: z.string().uuid().nullable().optional(),
});

export const applySchema = z.object({
  jobId: z.string().uuid(),
  portfolio_url: z.string().trim().url("Enter a full link starting with https://").refine((u) => u.startsWith("https://"), "Use an https link.").or(z.literal("")).optional(),
  proof: z.string().trim().min(10, "Describe relevant experience or proof (10+ characters).").max(2000),
  availability: z.string().trim().min(2, "Share when you're available.").max(300),
  offer: z.string().trim().min(10, "Write a short offer (10+ characters).").max(1500),
});

export const evidenceSchema = z.object({
  path: z.string().min(3).max(300),
  name: z.string().min(1).max(200),
  mime: z.string().min(3).max(100),
});

export const submitWorkSchema = z.object({
  contractId: z.string().uuid(),
  note: z.string().trim().max(4000),
  evidence: z.array(evidenceSchema).max(10),
});

export const reviewSchema = z.object({
  contractId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().max(1000),
});

export const EVIDENCE_MIMES = ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm", "application/pdf", "text/plain", "application/zip"] as const;
export const MAX_EVIDENCE_BYTES = 100 * 1024 * 1024;
