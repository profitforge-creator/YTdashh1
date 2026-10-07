"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { startConversation } from "./actions";

export function StartConversation({ recipientId, open }: { recipientId: string; open: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await startConversation(recipientId, body);
          if (!res.ok) { toast.error(res.error); return; }
          toast.success(open ? "Message sent." : "Message request sent.");
          router.push(`/messages?c=${res.data.conversationId}`);
        });
      }}
    >
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder={open ? "Write a message…" : "Introduce yourself. They'll see this as a message request."} aria-label="Message" className="min-h-16" />
      <Button type="submit" size="sm" loading={pending} disabled={!body.trim()}>{open ? "Send message" : "Send request"}</Button>
    </form>
  );
}
