import Link from "next/link";
import { Clock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { JOB_CATEGORIES } from "@/lib/constants";
import { formatCents, formatDate } from "@/lib/utils";
import type { JobRow } from "@/types/database";

export function JobCard({ job, openSlots, totalSlots, href }: { job: JobRow; openSlots: number; totalSlots: number; href?: string }) {
  return (
    <Link href={href ?? `/work/${job.id}`} className="block rounded-[var(--radius-card)] border bg-surface p-4 transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="active">{JOB_CATEGORIES.find((c) => c.value === job.category)?.label ?? job.category}</Badge>
            {job.is_official ? <Badge tone="brand">Sample</Badge> : null}
            {job.status !== "open" ? <Badge>{job.status.replace("_", " ")}</Badge> : null}
          </div>
          <h3 className="mt-2 truncate text-base font-medium">{job.title}</h3>
        </div>
        <p className="shrink-0 text-lg font-semibold tabular-nums text-positive">{formatCents(job.payment_cents)}</p>
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm text-muted">{job.deliverables}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden /> {openSlots}/{totalSlots} slots open</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden /> Due {formatDate(job.deadline)}</span>
        {job.session_minutes ? <span>{job.session_minutes} min session</span> : null}
      </div>
    </Link>
  );
}
