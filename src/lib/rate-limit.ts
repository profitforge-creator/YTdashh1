import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Returns true if the action is allowed. Fails closed: a limiter error blocks the action. */
export async function allow(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("check_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) return false;
  return data === true;
}
