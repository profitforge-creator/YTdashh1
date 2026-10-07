import { z } from "zod";

export const ALLOWED_IMAGE = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const ALLOWED_VIDEO = ["video/mp4", "video/webm"] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export const createPostSchema = z.object({
  body: z.string().trim().max(2000),
  projectId: z.string().uuid().nullable().optional(),
  media: z
    .array(z.object({ path: z.string().min(3).max(300), mime: z.enum([...ALLOWED_IMAGE, ...ALLOWED_VIDEO]) }))
    .max(4)
    .default([]),
});

export const commentSchema = z.object({
  postId: z.string().uuid(),
  body: z.string().trim().min(1, "Write something first.").max(1000),
});

export const reportSchema = z.object({
  targetType: z.enum(["post", "comment", "profile", "message", "job"]),
  targetId: z.string().uuid(),
  reason: z.enum(["spam", "harassment", "unsafe", "scam", "impersonation", "other"]),
  details: z.string().trim().max(1000).optional(),
});

export const profileSchema = z.object({
  display_name: z.string().trim().min(1).max(40),
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "3–24 letters, numbers or underscores."),
  bio: z.string().trim().max(280),
  dm_policy: z.enum(["open", "requests"]),
});
