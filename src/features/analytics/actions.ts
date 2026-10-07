"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { MAX_CSV_ROWS, parseMetricsCsv } from "@/lib/analytics/csv";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { snapshotSchema } from "@/lib/validation/analytics";

const MAX_CSV_BYTES = 512 * 1024;

export async function saveSnapshot(input: unknown): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const parsed = snapshotSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return fail("Check the highlighted fields.", fieldErrors);
  }
  const { projectId, ...values } = parsed.data;
  if (Date.parse(values.captured_on) > Date.now() + 86_400_000) return fail("The date can't be in the future.", { captured_on: "Pick today or earlier." });
  const hasMetric = Object.entries(values).some(([k, v]) => k !== "captured_on" && v !== null);
  if (!hasMetric) return fail("Enter at least one metric.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("metric_snapshots")
    .upsert({ project_id: projectId, ...values, source: "manual", created_by: viewer.id }, { onConflict: "project_id,captured_on" });
  if (error) return fail("Couldn't save. You may not have edit access to this project.");
  revalidatePath("/analytics");
  revalidatePath("/home");
  return ok();
}

export async function importCsv(projectId: string, filename: string, text: string): Promise<ActionResult<{ imported: number; skipped: string[] }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  if (text.length > MAX_CSV_BYTES) return fail("That file is too large (max 512 KB).");
  const supabase = await createClient();

  const { rows, errors } = parseMetricsCsv(text);
  if (rows.length === 0) {
    await supabase.from("analytics_imports").insert({ project_id: projectId, user_id: viewer.id, filename: filename.slice(0, 200), status: "failed", error: errors[0] ?? "No rows", rows_imported: 0 });
    return fail(errors[0] ?? "No valid rows found.");
  }
  if (rows.length > MAX_CSV_ROWS) return fail(`Too many rows (max ${MAX_CSV_ROWS}).`);

  const { error } = await supabase
    .from("metric_snapshots")
    .upsert(rows.map((r) => ({ project_id: projectId, ...r, source: "csv" as const, created_by: viewer.id })), { onConflict: "project_id,captured_on" });
  if (error) return fail("Couldn't import. You may not have edit access to this project.");
  await supabase.from("analytics_imports").insert({ project_id: projectId, user_id: viewer.id, filename: filename.slice(0, 200), status: "succeeded", rows_imported: rows.length });
  revalidatePath("/analytics");
  revalidatePath("/home");
  return ok({ imported: rows.length, skipped: errors.slice(0, 5) });
}

export async function deleteSnapshot(id: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const supabase = await createClient();
  const { error } = await supabase.from("metric_snapshots").delete().eq("id", id);
  if (error) return fail("Couldn't delete that entry.");
  revalidatePath("/analytics");
  return ok();
}
