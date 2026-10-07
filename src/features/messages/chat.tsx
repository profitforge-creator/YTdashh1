"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn, timeAgo } from "@/lib/utils";
import type { MessageRow } from "@/types/database";
import { markRead, sendMessage } from "./actions";

export function Chat({ conversationId, viewerId, initial, locked }: { conversationId: string; viewerId: string; initial: MessageRow[]; locked: string | null }) {
  const [messages, setMessages] = useState(initial);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { setMessages(initial); }, [initial]);

  useEffect(() => {
    void markRead(conversationId);
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const row = payload.new as MessageRow;
        setMessages((m) => (m.some((x) => x.id === row.id) ? m : [...m, row]));
        if (row.sender_id !== viewerId) void markRead(conversationId);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId, viewerId]);

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body;
    startTransition(async () => {
      const res = await sendMessage(conversationId, text);
      if (!res.ok) toast.error(res.error);
      else setBody("");
    });
  }

  return (
    <div className="flex h-full min-h-[24rem] flex-col">
      <div className="scroll-thin flex-1 space-y-2 overflow-y-auto p-4" role="log" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.sender_id === viewerId ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", m.sender_id === viewerId ? "bg-brand" : "bg-surface-3")}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className="mt-0.5 text-[10px] opacity-60">{timeAgo(m.created_at)}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {locked ? (
        <p className="border-t p-3 text-xs text-muted">{locked}</p>
      ) : (
        <form onSubmit={send} className="flex gap-2 border-t p-3">
          <Input value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Message…" aria-label="Message" />
          <Button type="submit" size="icon" aria-label="Send" loading={pending} disabled={!body.trim()}><Send className="h-4 w-4" aria-hidden /></Button>
        </form>
      )}
    </div>
  );
}
