"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function moderateReport(reportId: string, action: "remove_content" | "dismiss" | "warn_user"): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_report", { p_report: reportId, p_action: action });
  if (error) return fail(dbErrorMessage(error, "Couldn't act on that report."));
  revalidatePath("/admin/reports");
  return ok();
}
