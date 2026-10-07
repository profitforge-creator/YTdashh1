"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { addComment } from "./actions";

export function CommentForm({ postId }: { postId: string }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await addComment({ postId, body });
          if (!res.ok) toast.error(res.error);
          else setBody("");
        });
      }}
    >
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="Add a comment…" aria-label="Add a comment" className="min-h-16" />
      <div className="flex justify-end"><Button size="sm" type="submit" loading={pending} disabled={!body.trim()}>Comment</Button></div>
    </form>
  );
}
