"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { respondToRequest } from "./actions";

export function RequestActions({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const run = (accept: boolean) =>
    startTransition(async () => {
      const res = await respondToRequest(requestId, accept);
      if (!res.ok) toast.error(res.error);
      else toast.success(accept ? "Request accepted." : "Request declined.");
    });
  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => run(true)}>Accept</Button>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(false)}>Decline</Button>
    </div>
  );
}
