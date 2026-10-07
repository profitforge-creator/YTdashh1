"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { closeJob } from "./actions";

export function CloseJobButton({ jobId }: { jobId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="secondary" size="sm" loading={pending} onClick={() => startTransition(async () => { const r = await closeJob(jobId); if (!r.ok) toast.error(r.error); else toast.success("Job closed to new applicants."); })}>
      Close to new applicants
    </Button>
  );
}
