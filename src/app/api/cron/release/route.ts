import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

// Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. Releases contracts whose 7-day review window ended.
export async function GET(request: NextRequest) {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data, error } = await createAdminClient().rpc("release_expired_reviews");
  if (error) return NextResponse.json({ error: "release_failed" }, { status: 500 });
  return NextResponse.json({ released: data ?? 0 });
}
