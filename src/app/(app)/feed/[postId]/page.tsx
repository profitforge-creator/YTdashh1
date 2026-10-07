import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { CommentForm } from "@/features/community/comment-form";
import { PostCard } from "@/features/community/post-card";
import { hydratePosts } from "@/features/community/queries";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/utils";
import { DeleteCommentButton } from "@/features/community/delete-comment-button";

export const metadata = { title: "Post" };

export default async function PostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: post } = await supabase.from("posts").select("*").eq("id", postId).is("deleted_at", null).maybeSingle();
  if (!post) notFound();

  const [[item], { data: comments }] = await Promise.all([
    hydratePosts(supabase, [post]),
    supabase.from("comments").select("*").eq("post_id", postId).is("deleted_at", null).order("created_at"),
  ]);
  if (!item) notFound();

  const authorIds = [...new Set((comments ?? []).map((c) => c.author_id))];
  const { data: authors } = authorIds.length ? await supabase.from("profiles").select("id, handle, display_name, avatar_url").in("id", authorIds) : { data: [] };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/feed" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" aria-hidden /> Feed</Link>
      <PostCard item={item} viewerId={viewer.id} detail />
      <CommentForm postId={postId} />
      <ul className="space-y-3">
        {(comments ?? []).map((c) => {
          const a = authors?.find((x) => x.id === c.author_id);
          return (
            <li key={c.id} className="flex gap-3 rounded-[var(--radius-card)] border bg-surface p-3">
              <Avatar name={a?.display_name ?? "?"} src={a?.avatar_url} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted"><Link href={`/profile/${a?.handle ?? ""}`} className="font-medium text-fg hover:underline">{a?.display_name ?? "Creator"}</Link> · {timeAgo(c.created_at)}</p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{c.body}</p>
              </div>
              {c.author_id === viewer.id ? <DeleteCommentButton commentId={c.id} postId={postId} /> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
