import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow, UserPreferencesRow } from "@/types/database";

export interface Viewer {
  id: string;
  email: string | undefined;
  profile: ProfileRow;
  prefs: UserPreferencesRow;
}

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: prefs }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_preferences").select("*").eq("user_id", user.id).single(),
  ]);
  if (!profile || !prefs) return null;
  return { id: user.id, email: user.email, profile, prefs };
});

/** For pages inside the app shell: signed in and finished onboarding. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!viewer.prefs.onboarded_at) redirect("/onboarding");
  return viewer;
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.profile.is_admin) redirect("/home");
  return viewer;
}
