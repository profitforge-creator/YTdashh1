"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { getViewer, requireAdmin } from "@/lib/auth";
import { getPaymentProvider } from "@/lib/payments/provider";
import { allow } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { applySchema, createJobSchema, reviewSchema, submitWorkSchema } from "@/lib/validation/work";
import type { Json } from "@/types/database";

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] ??= i.message;
  return out;
}

export async function createJob(input: unknown): Promise<ActionResult<{ id: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const parsed = createJobSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrors(parsed.error.issues));
  if (!(await allow(`job:${viewer.id}`, 10, 3600))) return fail("You're posting jobs too fast.");
  const v = parsed.data;

  const supabase = await createClient();
  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      owner_id: viewer.id, project_id: v.projectId ?? null, title: v.title, description: v.description, category: v.category,
      deliverables: v.deliverables, acceptance_conditions: v.acceptance_conditions, deadline: new Date(v.deadline).toISOString(),
      session_minutes: v.category === "tester" ? (v.session_minutes ?? null) : null, revisions_allowed: v.revisions_allowed,
      payment_cents: Math.round(v.payment_dollars * 100),
    })
    .select("id")
    .single();
  if (error || !job) return fail("Couldn't publish the job.");

  const { error: slotError } = await supabase.from("job_slots").insert(
    Array.from({ length: v.slots }, (_, i) => ({ job_id: job.id, position: i + 1, label: v.slots > 1 ? `Slot ${i + 1}` : null })),
  );
  if (slotError) {
    await supabase.from("jobs").update({ status: "cancelled" }).eq("id", job.id);
    return fail("Couldn't create the job slots.");
  }
  revalidatePath("/work");
  return ok({ id: job.id });
}

export async function applyToJob(input: unknown): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrors(parsed.error.issues));
  if (!(await allow(`apply:${viewer.id}`, 30, 3600))) return fail("You're applying too fast.");
  const supabase = await createClient();
  const { error } = await supabase.from("applications").insert({
    job_id: parsed.data.jobId, applicant_id: viewer.id, portfolio_url: parsed.data.portfolio_url || null,
    proof: parsed.data.proof, availability: parsed.data.availability, offer: parsed.data.offer,
  });
  if (error) return fail(error.code === "23505" ? "You already applied to this job." : "Couldn't submit your application. The job may be closed.");
  revalidatePath(`/work/${parsed.data.jobId}`);
  return ok();
}

export async function withdrawApplication(applicationId: string, jobId: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const supabase = await createClient();
  const { error } = await supabase.from("applications").update({ status: "withdrawn" }).eq("id", applicationId).eq("applicant_id", viewer.id);
  if (error) return fail("Couldn't withdraw that application.");
  revalidatePath(`/work/${jobId}`);
  return ok();
}

export async function selectApplicant(applicationId: string, jobId: string): Promise<ActionResult<{ contractId: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("select_applicant", { p_application: applicationId });
  if (error || !data) return fail(dbErrorMessage(error, "Couldn't select that applicant."));
  revalidatePath(`/work/${jobId}`);
  revalidatePath("/work");
  return ok({ contractId: data });
}

export async function rejectApplicant(applicationId: string, jobId: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const supabase = await createClient();
  // RLS limits updates to the applicant; the owner path goes through the service client after an ownership check.
  const { data: job } = await supabase.from("jobs").select("owner_id").eq("id", jobId).single();
  if (!job || job.owner_id !== viewer.id) return fail("You don't own this job.");
  const { error } = await createAdminClient().from("applications").update({ status: "rejected" }).eq("id", applicationId).eq("job_id", jobId).eq("status", "pending");
  if (error) return fail("Couldn't update that application.");
  revalidatePath(`/work/${jobId}`);
  return ok();
}

export async function closeJob(jobId: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update({ status: "closed" }).eq("id", jobId).eq("owner_id", viewer.id).eq("status", "open");
  if (error) return fail("Couldn't close that job.");
  revalidatePath("/work");
  revalidatePath(`/work/${jobId}`);
  return ok();
}

/** Test-mode funding. The provider call happens here; the ledger write is service-role only. */
export async function fundContract(contractId: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const supabase = await createClient();
  const { data: contract } = await supabase.from("contracts").select("id, buyer_id, amount_cents, status").eq("id", contractId).single();
  if (!contract || contract.buyer_id !== viewer.id) return fail("You can't fund this job.");
  if (contract.status !== "awaiting_funding") return fail("This job is already funded.");

  try {
    const charge = await getPaymentProvider().charge({ contractId, buyerId: viewer.id, amountCents: contract.amount_cents });
    const { error } = await createAdminClient().rpc("fund_contract", { p_contract: contractId, p_buyer: viewer.id, p_provider: charge.provider, p_ref: charge.ref });
    if (error) return fail(dbErrorMessage(error, "Couldn't fund this job."));
  } catch {
    return fail("The payment didn't go through. Nothing was charged.");
  }
  revalidatePath(`/work/contracts/${contractId}`);
  return ok();
}

export async function submitWork(input: unknown): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const parsed = submitWorkSchema.safeParse(input);
  if (!parsed.success) return fail("Check your submission.");
  const { contractId, note, evidence } = parsed.data;
  if (evidence.some((e) => !e.path.startsWith(`${contractId}/`) || e.path.includes(".."))) return fail("Invalid evidence upload.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_work", { p_contract: contractId, p_note: note, p_evidence: evidence as unknown as Json });
  if (error) return fail(dbErrorMessage(error, "Couldn't submit your work."));
  revalidatePath(`/work/contracts/${contractId}`);
  return ok();
}

async function simpleRpc(contractId: string, fn: () => PromiseLike<{ error: { message?: string } | null }>, fallback: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const { error } = await fn();
  if (error) return fail(dbErrorMessage(error, fallback));
  revalidatePath(`/work/contracts/${contractId}`);
  revalidatePath("/work");
  return ok();
}

export async function approveWork(contractId: string): Promise<ActionResult> {
  const supabase = await createClient();
  return simpleRpc(contractId, () => supabase.rpc("approve_contract", { p_contract: contractId }), "Couldn't approve this work.");
}

export async function requestRevision(contractId: string, note: string): Promise<ActionResult> {
  const supabase = await createClient();
  return simpleRpc(contractId, () => supabase.rpc("request_revision", { p_contract: contractId, p_note: note.slice(0, 1000) }), "Couldn't request a revision.");
}

export async function openDispute(contractId: string, reason: string): Promise<ActionResult> {
  const supabase = await createClient();
  return simpleRpc(contractId, () => supabase.rpc("open_dispute", { p_contract: contractId, p_reason: reason.trim().slice(0, 2000) }), "Couldn't open the dispute.");
}

export async function resolveDispute(disputeId: string, resolution: "worker" | "buyer" | "split", workerDollars: number, note: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_dispute", {
    p_dispute: disputeId, p_resolution: resolution, p_worker_gross_cents: Math.round(workerDollars * 100), p_note: note.slice(0, 1000),
  });
  if (error) return fail(dbErrorMessage(error, "Couldn't resolve the dispute."));
  revalidatePath("/admin/disputes");
  return ok();
}

export async function leaveReview(input: unknown): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return fail("Pick a rating from 1 to 5.");
  const supabase = await createClient();
  const { data: contract } = await supabase.from("contracts").select("buyer_id, worker_id").eq("id", parsed.data.contractId).single();
  if (!contract) return fail("Job not found.");
  const reviewee = contract.buyer_id === viewer.id ? contract.worker_id : contract.buyer_id;
  const { error } = await supabase.from("reviews").insert({ contract_id: parsed.data.contractId, reviewer_id: viewer.id, reviewee_id: reviewee, rating: parsed.data.rating, body: parsed.data.body });
  if (error) return fail(error.code === "23505" ? "You already reviewed this job." : "Couldn't save your review.");
  revalidatePath(`/work/contracts/${parsed.data.contractId}`);
  return ok();
}

/** Safe to call from any page: only contracts past their 7-day window are touched, and it is idempotent. */
export async function releaseExpired(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("release_expired_reviews");
  return data ?? 0;
}
