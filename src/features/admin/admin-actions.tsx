"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { moderateReport } from "./actions";
import { resolveDispute } from "@/features/work/actions";

export function ResolveDisputeForm({ disputeId, amountDollars }: { disputeId: string; amountDollars: number }) {
  const [pending, startTransition] = useTransition();
  const [resolution, setResolution] = useState<"worker" | "buyer" | "split">("worker");
  const [workerDollars, setWorkerDollars] = useState((amountDollars / 2).toFixed(2));
  const [note, setNote] = useState("");
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={resolution} onChange={(e) => setResolution(e.target.value as typeof resolution)} aria-label="Resolution">
          <option value="worker">Pay the worker in full</option>
          <option value="buyer">Refund the buyer</option>
          <option value="split">Split the payment</option>
        </Select>
        {resolution === "split" ? <Input type="number" step="0.01" min={0.01} max={amountDollars} value={workerDollars} onChange={(e) => setWorkerDollars(e.target.value)} aria-label="Worker share (USD)" /> : null}
      </div>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Reasoning shared with both parties." aria-label="Resolution note" />
      <Button size="sm" loading={pending} disabled={note.trim().length < 5} onClick={() => startTransition(async () => {
        const res = await resolveDispute(disputeId, resolution, resolution === "split" ? Number(workerDollars) : 0, note);
        if (!res.ok) toast.error(res.error); else toast.success("Dispute resolved.");
      })}>Resolve dispute</Button>
    </div>
  );
}

export function ModerateReportButtons({ reportId }: { reportId: string }) {
  const [pending, startTransition] = useTransition();
  const run = (action: "remove_content" | "dismiss" | "warn_user") => startTransition(async () => {
    const res = await moderateReport(reportId, action);
    if (!res.ok) toast.error(res.error); else toast.success("Done.");
  });
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="danger" disabled={pending} onClick={() => run("remove_content")}>Remove content</Button>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run("warn_user")}>Warn user</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("dismiss")}>Dismiss</Button>
    </div>
  );
}
