import Link from "next/link";
import { Briefcase, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { JobCard } from "@/features/work/job-card";
import { releaseExpired } from "@/features/work/actions";
import { requireViewer } from "@/lib/auth";
import { JOB_CATEGORIES } from "@/lib/constants";
import { PAYMENT_LABELS, paymentState } from "@/lib/payments/states";
import { createClient } from "@/lib/supabase/server";
import { cn, formatCents } from "@/lib/utils";

export const metadata = { title: "Work" };

const VIEWS = [
  { id: "browse", label: "Browse" },
  { id: "posted", label: "My jobs" },
  { id: "doing", label: "My work" },
] as const;

export default async function WorkPage({ searchParams }: { searchParams: Promise<{ view?: string; category?: string; q?: string }> }) {
  const sp = await searchParams;
  const view = VIEWS.find((v) => v.id === sp.view)?.id ?? "browse";
  const viewer = await requireViewer();
  await releaseExpired();
  const supabase = await createClient();

  let jobs: Awaited<ReturnType<typeof fetchJobs>> = [];
  async function fetchJobs() {
    let q = supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(60);
    if (view === "browse") {
      q = q.eq("status", "open").neq("owner_id", viewer.id);
      if (sp.category && JOB_CATEGORIES.some((c) => c.value === sp.category)) q = q.eq("category", sp.category as never);
      if (sp.q) q = q.ilike("title", `%${sp.q.replace(/[%_]/g, "")}%`);
    } else {
      q = q.eq("owner_id", viewer.id);
    }
    return (await q).data ?? [];
  }
  if (view !== "doing") jobs = await fetchJobs();

  const jobIds = jobs.map((j) => j.id);
  const { data: slots } = jobIds.length ? await supabase.from("job_slots").select("job_id, status").in("job_id", jobIds) : { data: [] };

  const { data: contracts } = view === "doing"
    ? await supabase.from("contracts").select("*").eq("worker_id", viewer.id).order("created_at", { ascending: false })
    : { data: [] };
  const contractJobIds = (contracts ?? []).map((c) => c.job_id);
  const { data: contractJobs } = contractJobIds.length ? await supabase.from("jobs").select("id, title").in("id", contractJobIds) : { data: [] };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Work"
        subtitle="Paid testing and specialist jobs with protected payments."
        action={<Link href="/work/new"><Button size="sm"><Plus className="h-4 w-4" aria-hidden /> Post a job</Button></Link>}
      />
      <nav aria-label="Work views" className="grid grid-cols-3 rounded-xl border p-1">
        {VIEWS.map((v) => (
          <Link key={v.id} href={`/work?view=${v.id}`} aria-current={v.id === view ? "page" : undefined} className={cn("rounded-lg py-1.5 text-center text-sm", v.id === view ? "bg-surface-3" : "text-muted hover:text-fg")}>{v.label}</Link>
        ))}
      </nav>

      {view === "browse" ? (
        <form className="flex gap-2" role="search">
          <input type="hidden" name="view" value="browse" />
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search jobs" aria-label="Search jobs" className="h-10 flex-1 rounded-xl border bg-surface-2 px-3 text-sm" />
          <select name="category" defaultValue={sp.category ?? ""} aria-label="Category" className="h-10 rounded-xl border bg-surface-2 px-2 text-sm">
            <option value="">All roles</option>
            {JOB_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <Button type="submit" variant="secondary">Filter</Button>
        </form>
      ) : null}

      {view === "doing" ? (
        (contracts ?? []).length === 0 ? (
          <EmptyState icon={<Briefcase className="h-6 w-6" aria-hidden />} title="No active work" body="When a buyer selects you for a job it will appear here." />
        ) : (
          <ul className="space-y-3">
            {(contracts ?? []).map((c) => {
              const ps = PAYMENT_LABELS[paymentState(c.status)];
              return (
                <li key={c.id}>
                  <Link href={`/work/contracts/${c.id}`} className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border bg-surface p-4 hover:border-border-strong">
                    <span className="min-w-0 truncate font-medium">{contractJobs?.find((j) => j.id === c.job_id)?.title ?? "Job"}</span>
                    <span className="flex shrink-0 items-center gap-3"><Badge tone={ps.tone}>{ps.label}</Badge><span className="tabular-nums">{formatCents(c.amount_cents - c.platform_fee_cents)}</span></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      ) : jobs.length === 0 ? (
        <EmptyState icon={<Briefcase className="h-6 w-6" aria-hidden />} title={view === "posted" ? "You haven't posted a job" : "No jobs match"} body={view === "posted" ? "Post a testing or specialist job to get started." : "Try another role or search."} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {jobs.map((j) => {
            const s = (slots ?? []).filter((x) => x.job_id === j.id);
            return <JobCard key={j.id} job={j} totalSlots={s.length} openSlots={s.filter((x) => x.status === "open").length} />;
          })}
        </div>
      )}
    </div>
  );
}
