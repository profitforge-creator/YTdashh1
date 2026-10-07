"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rejectApplicant, selectApplicant, withdrawApplication } from "./actions";

export function ApplicantActions({ applicationId, jobId, canSelect }: { applicationId: string; jobId: string; canSelect: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending || !canSelect} onClick={() => startTransition(async () => {
        const res = await selectApplicant(applicationId, jobId);
        if (!res.ok) toast.error(res.error); else { toast.success("Selected. Fund the job to start work."); router.push(`/work/contracts/${res.data.contractId}`); }
      })}>Select</Button>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => startTransition(async () => {
        const res = await rejectApplicant(applicationId, jobId);
        if (!res.ok) toast.error(res.error); else toast.success("Declined.");
      })}>Decline</Button>
    </div>
  );
}

export function WithdrawButton({ applicationId, jobId }: { applicationId: string; jobId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button size="sm" variant="secondary" loading={pending} onClick={() => startTransition(async () => {
      const res = await withdrawApplication(applicationId, jobId);
      if (!res.ok) toast.error(res.error); else toast.success("Application withdrawn.");
    })}>Withdraw</Button>
  );
}
