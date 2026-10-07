"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { onboardingSchema } from "@/lib/validation/onboarding";

export async function completeOnboarding(input: unknown): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return fail("Check the highlighted fields.", fieldErrors);
  }
  const v = parsed.data;
  const supabase = await createClient();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: v.display_name,
      roles: v.roles,
      experience_level: v.experience_level,
      genres: v.genres,
      skills: v.skills,
    })
    .eq("id", viewer.id);
  if (profileError) return fail("Couldn't save your profile.");

  const { error: prefError } = await supabase
    .from("user_preferences")
    .update({
      goals: v.goals,
      weekly_hours: v.weekly_hours,
      budget_usd: v.budget_usd,
      preferred_ai: v.preferred_ai,
      onboarded_at: new Date().toISOString(),
    })
    .eq("user_id", viewer.id);
  if (prefError) return fail("Couldn't save your preferences.");

  revalidatePath("/", "layout");
  return ok();
}
