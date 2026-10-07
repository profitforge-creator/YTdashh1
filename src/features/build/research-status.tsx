"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { GenerationJobRow } from "@/types/database";
import { returnToInterview } from "./actions";

export function ResearchStatus({ job, projectId, canEdit }: { job: GenerationJobRow | null; projectId: string; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const active = job?.status === "queued" || job?.status === "running";

  // Polling is simpler and more robust than a socket for a job that finishes in minutes.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [active, router]);

  if (job?.status === "failed") {
    return (
      <Card className="space-y-3">
        <div className="flex items-start gap-2">
          <TriangleAlert className="mt-0.5 h-4 w-4 text-warning" aria-hidden />
          <div>
            <p className="text-sm font-medium">Research didn&apos;t finish</p>
            <p className="text-xs text-muted">{job.error ?? "Something went wrong."} Your credits were refunded.</p>
          </div>
        </div>
        {canEdit ? (
          <Button
            size="sm"
            variant="secondary"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await returnToInterview(projectId);
                if (!res.ok) toast.error(res.error);
              })
            }
          >
            Back to the summary
          </Button>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="space-y-4" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="h-4 w-4 animate-spin text-brand-hover" aria-hidden />
        {job?.status === "queued" ? "Queued…" : "Researching current Roblox signals…"}
      </div>
      <p className="text-xs text-muted">
        DevMint is checking public popularity, competition and momentum, then drafting three concepts. This can take a few
        minutes. You can leave this page; we&apos;ll notify you.
      </p>
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </Card>
  );
}
