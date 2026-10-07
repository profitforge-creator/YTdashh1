import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { releaseExpired } from "@/features/work/actions";
import { BuyerReviewActions, DisputeForm, FundButton, ReviewForm, SubmitWorkForm } from "@/features/work/contract-actions";
import { requireViewer } from "@/lib/auth";
import { PAYMENT_LABELS, paymentState, reviewTimeLeft, STATUS_LABELS } from "@/lib/payments/states";
import { createClient } from "@/lib/supabase/server";
import { cn, formatCents, formatDate, timeAgo } from "@/lib/utils";
import type { EvidenceItem } from "@/types/database";

export const metadata = { title: "Contract" };

function toEvidence(value: unknown): EvidenceItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => (v && typeof v === "object" && typeof (v as EvidenceItem).path === "string" ? [v as EvidenceItem] : []));
}

export default async function ContractPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params;
  const viewer = await requireViewer();
  await releaseExpired();
  const supabase = await createClient();

  const { data: contract } = await supabase.from("contracts").select("*").eq("id", contractId).maybeSingle();
  if (!contract) notFound();
  const isBuyer = contract.buyer_id === viewer.id;
  const isWorker = contract.worker_id === viewer.id;

  const [{ data: job }, { data: people }, { data: submissions }, { data: disputes }, { data: reviews }] = await Promise.all([
    supabase.from("jobs").select("id, title, category, deliverables, acceptance_conditions, session_minutes").eq("id", contract.job_id).single(),
    supabase.from("profiles").select("id, display_name, handle").in("id", [contract.buyer_id, contract.worker_id]),
    supabase.from("submissions").select("*").eq("contract_id", contractId).order("created_at", { ascending: false }),
    supabase.from("disputes").select("*").eq("contract_id", contractId).order("created_at", { ascending: false }),
    supabase.from("reviews").select("*").eq("contract_id", contractId),
  ]);

  const evidencePaths = (submissions ?? []).flatMap((s) => toEvidence(s.evidence).map((e) => e.path));
  const signed = evidencePaths.length ? await supabase.storage.from("evidence").createSignedUrls(evidencePaths, 3600) : { data: [] };
  const urlFor = new Map((signed.data ?? []).map((s) => [s.path ?? "", s.signedUrl]));

  const buyer = people?.find((p) => p.id === contract.buyer_id);
  const worker = people?.find((p) => p.id === contract.worker_id);
  const ps = PAYMENT_LABELS[paymentState(contract.status)];
  const workerNet = contract.amount_cents - contract.platform_fee_cents;
  const myReview = reviews?.find((r) => r.reviewer_id === viewer.id);
  const decided = contract.status === "approved" || contract.status === "split";
  const openDisputeRow = disputes?.find((d) => d.status === "open");
  const canDispute = ["funded", "submitted", "revision_requested"].includes(contract.status);

  const steps = [
    { label: "Selected", done: true },
    { label: "Funded", done: contract.status !== "awaiting_funding" },
    { label: "Submitted", done: Boolean(contract.submitted_at) },
    { label: "Resolved", done: Boolean(contract.resolved_at) },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href={`/work/${contract.job_id}`} className="text-xs text-muted hover:text-fg">← Job listing</Link>
            <h1 className="mt-1 text-xl font-semibold">{job?.title}</h1>
            <p className="text-sm text-muted">Buyer {buyer?.display_name} · Worker {worker?.display_name}</p>
          </div>
          <Badge tone={ps.tone}>{ps.label}</Badge>
        </div>
        <ol className="grid grid-cols-4 gap-2" aria-label="Progress">
          {steps.map((s) => (
            <li key={s.label} className={cn("flex items-center gap-1.5 text-xs", s.done ? "text-fg" : "text-faint")}>
              {s.done ? <Check className="h-3.5 w-3.5 text-positive" aria-hidden /> : <Circle className="h-3.5 w-3.5" aria-hidden />}{s.label}
            </li>
          ))}
        </ol>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-muted">Job amount</dt><dd className="text-lg font-semibold tabular-nums">{formatCents(contract.amount_cents)}</dd></div>
          <div><dt className="text-xs text-muted">Worker receives</dt><dd className="text-lg font-semibold tabular-nums">{formatCents(workerNet)}</dd></div>
          <div><dt className="text-xs text-muted">Status</dt><dd>{STATUS_LABELS[contract.status]}</dd></div>
          <div><dt className="text-xs text-muted">Deadline</dt><dd>{formatDate(contract.deadline)}</dd></div>
          <div><dt className="text-xs text-muted">Revisions</dt><dd>{contract.revisions_used} of {contract.revisions_allowed} used</dd></div>
          {contract.status === "submitted" ? <div><dt className="text-xs text-muted">Review window</dt><dd>{reviewTimeLeft(contract.review_deadline)}</dd></div> : null}
        </dl>
        <details className="text-sm"><summary className="cursor-pointer text-muted">Agreement</summary>
          <div className="mt-2 space-y-2"><p><b>Deliverables:</b> {job?.deliverables}</p><p><b>Acceptance:</b> {job?.acceptance_conditions}</p></div>
        </details>
      </Card>

      {contract.status === "awaiting_funding" ? (
        <Card><CardHeader title="Funding" />
          {isBuyer ? <FundButton contractId={contract.id} amountCents={contract.amount_cents} feeCents={contract.platform_fee_cents} /> : <p className="text-sm text-muted">Waiting for the buyer to fund this job. You can start once payment is protected.</p>}
        </Card>
      ) : null}

      {isWorker && (contract.status === "funded" || contract.status === "revision_requested") ? (
        <Card><CardHeader title={contract.status === "revision_requested" ? "Submit your revision" : "Submit your work"} /><SubmitWorkForm contractId={contract.id} testerHint={job?.category === "tester"} /></Card>
      ) : null}

      {isBuyer && contract.status === "submitted" ? (
        <Card><CardHeader title="Review the submission" /><BuyerReviewActions contractId={contract.id} canRevise={contract.revisions_used < contract.revisions_allowed} /></Card>
      ) : null}

      {(submissions ?? []).length > 0 ? (
        <Card>
          <CardHeader title="Submissions" />
          <ul className="space-y-4">
            {(submissions ?? []).map((s) => (
              <li key={s.id} className="rounded-xl bg-surface-2 p-3">
                <p className="text-xs text-muted">Revision {s.revision_no} · {timeAgo(s.created_at)}</p>
                {s.note ? <p className="mt-1 whitespace-pre-wrap text-sm">{s.note}</p> : null}
                <ul className="mt-2 flex flex-wrap gap-2">
                  {toEvidence(s.evidence).map((e) => {
                    const url = urlFor.get(e.path);
                    return url ? (
                      <li key={e.path}>
                        {e.mime.startsWith("image/") ? (
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                            <img src={url} alt={e.name} loading="lazy" className="h-20 w-20 rounded-lg object-cover" />
                          </a>
                        ) : (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg border px-3 py-2 text-xs hover:bg-surface-3">{e.name}</a>
                        )}
                      </li>
                    ) : null;
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {(disputes ?? []).length > 0 ? (
        <Card>
          <CardHeader title="Dispute" />
          {(disputes ?? []).map((d) => (
            <div key={d.id} className="space-y-1 text-sm">
              <p><b>Reason:</b> {d.reason}</p>
              <p className="text-muted">{d.status === "open" ? "Payment is frozen while DevMint reviews this." : `Resolved in favour of ${d.resolution === "split" ? "a split" : d.resolution}. ${d.admin_note ?? ""}`}</p>
            </div>
          ))}
        </Card>
      ) : null}

      {canDispute && (isBuyer || isWorker) && !openDisputeRow ? <Card><CardHeader title="Something wrong?" /><DisputeForm contractId={contract.id} /></Card> : null}

      {decided && (isBuyer || isWorker) && !myReview ? <Card><CardHeader title="Leave a review" /><ReviewForm contractId={contract.id} /></Card> : null}
      {(reviews ?? []).length > 0 ? (
        <Card><CardHeader title="Reviews" />
          <ul className="space-y-2 text-sm">{(reviews ?? []).map((r) => <li key={r.id}><b>{r.rating}★</b> {r.body}</li>)}</ul>
        </Card>
      ) : null}
    </div>
  );
}
