"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const KINDS = ["jobs", "messages", "payments", "builds", "analytics", "rank", "tasks"] as const;
const prefsSchema = z.record(z.enum(KINDS), z.object({ in_app: z.boolean(), push: z.boolean(), email: z.boolean() }));
const settingsSchema = z.object({
  dm_policy: z.enum(["open", "requests"]),
  preferred_ai: z.enum(["claude", "chatgpt", "gemini"]),
  notification_prefs: prefsSchema,
});

export async function saveSettings(input: unknown): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return fail("Those settings aren't valid.");

  // Payment and security events stay immediate regardless of preferences, so they aren't configurable here.
  const supabase = await createClient();
  const [a, b] = await Promise.all([
    supabase.from("profiles").update({ dm_policy: parsed.data.dm_policy }).eq("id", viewer.id),
    supabase.from("user_preferences").update({ preferred_ai: parsed.data.preferred_ai, notification_prefs: parsed.data.notification_prefs }).eq("user_id", viewer.id),
  ]);
  if (a.error || b.error) return fail("Couldn't save your settings.");
  revalidatePath("/settings");
  return ok();
}

export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const supabase = await createClient();
  let query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", viewer.id).is("read_at", null);
  if (ids && ids.length) query = query.in("id", ids);
  const { error } = await query;
  if (error) return fail("Couldn't update notifications.");
  revalidatePath("/", "layout");
  return ok();
}
