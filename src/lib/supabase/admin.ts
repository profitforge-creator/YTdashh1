import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Service-role client: bypasses RLS. Use only after verifying the caller in code, and only for
 * writes that must not be client-controlled (credit debits, AI results, rank, test payments).
 */
export function createAdminClient() {
  const pub = getPublicEnv();
  const server = getServerEnv();
  return createSupabaseClient<Database>(pub.NEXT_PUBLIC_SUPABASE_URL, server.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
