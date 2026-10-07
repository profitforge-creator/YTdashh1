"use client";

import { Ban, Flag, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setBlock, setMute, submitReport } from "./actions";

export function ProfileSafety({ userId, blocked, muted }: { userId: string; blocked: boolean; muted: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [isMuted, setIsMuted] = useState(muted);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Something went wrong.");
      else { toast.success(success); after?.(); }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setMute(userId, !isMuted), isMuted ? "Unmuted." : "Muted.", () => setIsMuted(!isMuted))}>
        <VolumeX className="h-4 w-4" aria-hidden /> {isMuted ? "Unmute" : "Mute"}
      </Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setBlock(userId, !blocked), blocked ? "Unblocked." : "Blocked.", () => router.refresh())}>
        <Ban className="h-4 w-4" aria-hidden /> {blocked ? "Unblock" : "Block"}
      </Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => submitReport({ targetType: "profile", targetId: userId, reason: "other" }), "Report sent. Thanks.")}>
        <Flag className="h-4 w-4" aria-hidden /> Report
      </Button>
    </div>
  );
}
