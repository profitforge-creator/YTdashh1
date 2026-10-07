"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteComment } from "./actions";

export function DeleteCommentButton({ commentId, postId }: { commentId: string; postId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="ghost" size="icon" aria-label="Delete comment" disabled={pending} onClick={() => startTransition(async () => { const r = await deleteComment(commentId, postId); if (!r.ok) toast.error(r.error); })}>
      <Trash2 className="h-4 w-4" aria-hidden />
    </Button>
  );
}
