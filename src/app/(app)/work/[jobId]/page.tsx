import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ApplicantActions, WithdrawButton } from "@/features/work/applicant-actions";
import { ApplyForm } from "@/features/work/apply-form";
import { CloseJobButton } from "@/features/work/close-job-button";
import { requireViewer } from "@/lib/auth";
import { JOB_CATEGORIES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { formatCents, formatDate, timeAgo } from "@/lib/utils";

export const metadata = { title: "Job" };

export default async function JobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) notFound();

  const isOwner = job.owner_id === viewer.id;
  const [{ data: slots }, { data: apps }, { data: owner }, { data: contracts }] = await Promise.all([
    supabase.from("job_slots").select("*").eq("job_id", jobId).order("position"),
    supabase.from("applications").select("*").eq("job_id", jobId).order("created_at"),
    supabase.from("profiles").select("id, display_name, handle, avatar_url").eq("id", job.owner_id).single(),
    supabase.from("contracts").select("id, worker_id, buyer_id, status").eq("job_id", jobId),
  ]);
  const applicantIds = [...new Set((apps ?? []).map((a) => a.applicant_id))];
  const { data: people } = applicantIds.length ? await supabase.from("profiles").select("id, display_name, handle, avatar_url").in("id", applicantIds) : { data: [] };

  const mine = (apps ?? []).find((a) => a.applicant_id === viewer.id);
  const openSlots = (slots ?? []).filter((s) => s.status === "open").length;
  const myContract = (contracts ?? []).find((c) => c.worker_id === viewer.id);
  const category = JOB_CATEGORIES.find((c) => c.value === job.category)?.label ?? job.category;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap gap-1.5"><Badge tone="active">{category}</Badge><Badge>{job.status.replace("_", " ")}</Badge>{job.is_official ? <Badge tone="brand">Sample job</Badge> : null}</div>
            <h1 className="mt-2 text-xl font-semibold">{job.title}</h1>
            {owner ? <Link href={`/profile/${owner.handle}`} className="mt-1 inline-flex items-center gap-2 text-sm text-muted hover:text-fg"><Avatar name={owner.display_name} src={owner.avatar_url} size={22} /> {owner.display_name}</Link> : null}
          </div>
          <div className="text-right"><p className="text-2xl font-semibold tabular-nums text-positive">{formatCents(job.payment_cents)}</p><p className="text-xs text-muted">per slot · {openSlots}/{(slots ?? []).length} open</p></div>
        </div>
        {job.description ? <p className="whitespace-pre-wrap text-sm">{job.description}</p> : null}
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted">Deliverables</dt><dd className="whitespace-pre-wrap">{job.deliverables}</dd></div>
          <div><dt className="text-xs text-muted">Acceptance conditions</dt><dd className="whitespace-pre-wrap">{job.acceptance_conditions}</dd></div>
          <div><dt className="text-xs text-muted">Deadline</dt><dd>{formatDate(job.deadline)}</dd></div>
          <div><dt className="text-xs text-muted">Revisions</dt><dd>{job.revisions_allowed} included</dd></div>
          {job.session_minutes ? <div><dt className="text-xs text-muted">Session length</dt><dd>{job.session_minutes} minutes</dd></div> : null}
        </dl>
        {isOwner && job.status === "open" ? <CloseJobButton jobId={job.id} /> : null}
      </Card>

      {myContract ? (
        <Card className="flex items-center justify-between gap-3"><p className="text-sm">You were selected for this job.</p><Link className="text-sm text-brand-hover underline underline-offset-4" href={`/work/contracts/${myContract.id}`}>Open your contract</Link></Card>
      ) : null}

      {!isOwner && !myContract ? (
        mine ? (
          <Card className="flex items-center justify-between gap-3">
            <p className="text-sm">Your application is <b>{mine.status}</b>.</p>
            {mine.status === "pending" ? <WithdrawButton applicationId={mine.id} jobId={job.id} /> : null}
          </Card>
        ) : job.status === "open" && openSlots > 0 ? (
          <Card><CardHeader title="Apply" /><ApplyForm jobId={job.id} /></Card>
        ) : (
          <Card><p className="text-sm text-muted">This job isn&apos;t accepting applications.</p></Card>
        )
      ) : null}

      {isOwner ? (
        <Card>
          <CardHeader title={`Applicants (${(apps ?? []).filter((a) => a.status !== "withdrawn").length})`} />
          {(apps ?? []).length === 0 ? <p className="text-sm text-muted">No applications yet.</p> : (
            <ul className="space-y-4">
              {(apps ?? []).map((a) => {
                const p = people?.find((x) => x.id === a.applicant_id);
                const contract = (contracts ?? []).find((c) => c.worker_id === a.applicant_id);
                return (
                  <li key={a.id} className="rounded-xl bg-surface-2 p-4">
                    <div className="flex items-start gap-3">
                      <Avatar name={p?.display_name ?? "?"} src={p?.avatar_url} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><Link href={`/profile/${p?.handle ?? ""}`} className="text-sm font-medium hover:underline">{p?.display_name}</Link><Badge tone={a.status === "selected" ? "positive" : "neutral"}>{a.status}</Badge><span className="text-xs text-faint">{timeAgo(a.created_at)}</span></div>
                        <p className="mt-2 text-sm">{a.offer}</p>
                        <p className="mt-2 text-xs text-muted"><b>Proof:</b> {a.proof}</p>
                        <p className="mt-1 text-xs text-muted"><b>Availability:</b> {a.availability}</p>
                        {a.portfolio_url ? <a href={a.portfolio_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-block text-xs text-active hover:underline">Portfolio ↗</a> : null}
                      </div>
                    </div>
                    <div className="mt-3">
                      {a.status === "pending" ? <ApplicantActions applicationId={a.id} jobId={job.id} canSelect={openSlots > 0} /> : null}
                      {contract ? <Link href={`/work/contracts/${contract.id}`} className="text-sm text-brand-hover underline underline-offset-4">Open contract</Link> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}
