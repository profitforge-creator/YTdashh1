"use client";

import { Bookmark, Flag, Heart, MessageCircle, MoreHorizontal, Repeat2, Share2, Trash2, VolumeX, Ban } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, timeAgo } from "@/lib/utils";
import {
  deletePost, setBlock, setMute, submitReport, toggleBookmark, toggleLike, toggleRepost,
} from "./actions";
import type { FeedPost } from "./queries";

function MediaGrid({ media }: { media: FeedPost["media"] }) {
  if (media.length === 0) return null;
  const video = media.find((m) => m.kind === "video");
  if (video?.url) {
    return <video src={video.url} controls preload="metadata" className="mt-3 max-h-96 w-full rounded-xl bg-black" />;
  }
  return (
    <div className={cn("mt-3 grid gap-1.5 overflow-hidden rounded-xl", media.length > 1 && "grid-cols-2")}>
      {media.map((m) =>
        m.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs; next/image caching would break them
          <img key={m.id} src={m.url} alt="Post attachment" loading="lazy" className="max-h-80 w-full object-cover" />
        ) : null,
      )}
    </div>
  );
}

function ActionButton({
  label, count, active, onClick, children, disabled,
}: {
  label: string; count?: number; active?: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50", active && "text-brand-hover")}
    >
      {children}
      {count !== undefined && count > 0 ? <span className="tabular-nums">{count}</span> : null}
    </button>
  );
}

export function PostCard({ item, viewerId, detail = false }: { item: FeedPost; viewerId: string; detail?: boolean }) {
  const { post, author } = item;
  const shown = post.kind === "repost" && item.original ? item.original : item;
  const [stats, setStats] = useState(shown.stats);
  const [menu, setMenu] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [pending, startTransition] = useTransition();

  if (removed) return null;
  const target = shown.post;
  const owner = target.author_id === viewerId;
  const isRepost = post.kind === "repost";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Something went wrong.");
      else onOk?.();
    });
  }

  async function share() {
    const url = `${window.location.origin}/feed/${target.id}`;
    try {
      if (navigator.share) await navigator.share({ url, title: "DevMint post" });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied.");
      }
    } catch {
      // The user dismissed the share sheet.
    }
  }

  if (isRepost && !item.original) return null;

  return (
    <article className="rounded-[var(--radius-card)] border bg-surface p-4">
      {isRepost ? (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted"><Repeat2 className="h-3.5 w-3.5" aria-hidden /> {author.display_name} reposted</p>
      ) : null}
      <div className="flex gap-3">
        <Link href={`/profile/${shown.author.handle}`} aria-label={`${shown.author.display_name}'s profile`}>
          <Avatar name={shown.author.display_name} src={shown.author.avatar_url} size={40} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link href={`/profile/${shown.author.handle}`} className="truncate text-sm font-semibold hover:underline">{shown.author.display_name}</Link>
            {shown.author.is_official ? <Badge tone="brand">Official</Badge> : shown.author.is_demo ? <Badge>Demo</Badge> : null}
            <span className="truncate text-xs text-faint">@{shown.author.handle} · {timeAgo(target.created_at)}</span>
            <div className="relative ml-auto">
              <button type="button" aria-label="More actions" aria-expanded={menu} onClick={() => setMenu((v) => !v)} className="rounded-lg p-1 text-muted hover:bg-surface-2">
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </button>
              {menu ? (
                <ul role="menu" className="absolute right-0 z-10 mt-1 w-44 rounded-xl border bg-surface-2 p-1 text-sm shadow-xl">
                  {owner ? (
                    <li><button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-danger hover:bg-surface-3" onClick={() => { setMenu(false); run(() => deletePost(target.id), () => setRemoved(true)); }}><Trash2 className="h-4 w-4" aria-hidden /> Delete</button></li>
                  ) : (
                    <>
                      <li><button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-surface-3" onClick={() => { setMenu(false); run(() => submitReport({ targetType: "post", targetId: target.id, reason: "spam" }), () => toast.success("Report sent. Thanks.")); }}><Flag className="h-4 w-4" aria-hidden /> Report</button></li>
                      <li><button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-surface-3" onClick={() => { setMenu(false); run(() => setMute(target.author_id, true), () => { toast.success("Muted."); setRemoved(true); }); }}><VolumeX className="h-4 w-4" aria-hidden /> Mute user</button></li>
                      <li><button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-danger hover:bg-surface-3" onClick={() => { setMenu(false); run(() => setBlock(target.author_id, true), () => { toast.success("Blocked."); setRemoved(true); }); }}><Ban className="h-4 w-4" aria-hidden /> Block user</button></li>
                    </>
                  )}
                </ul>
              ) : null}
            </div>
          </div>
          {target.body ? <p className="mt-1.5 whitespace-pre-wrap break-words text-sm">{target.body}</p> : null}
          <MediaGrid media={shown.media} />
          {shown.project ? (
            <Link href={`/build/${shown.project.id}`} className="mt-3 flex items-center gap-3 rounded-xl border bg-surface-2 p-3 hover:border-border-strong">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-sm font-semibold text-[#ff8da1]">{shown.project.title[0]}</span>
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{shown.project.title}</span><span className="text-xs text-muted">Project · {shown.project.stage}</span></span>
            </Link>
          ) : null}

          <div className="-ml-2 mt-2 flex items-center gap-1">
            <ActionButton label={stats.liked ? "Unlike" : "Like"} count={stats.likes} active={stats.liked} disabled={pending}
              onClick={() => { const was = stats.liked; setStats((s) => ({ ...s, liked: !was, likes: s.likes + (was ? -1 : 1) })); run(() => toggleLike(target.id, was), undefined); }}>
              <Heart className={cn("h-4 w-4", stats.liked && "fill-current")} aria-hidden />
            </ActionButton>
            <Link href={`/feed/${target.id}`} aria-label="Comments" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-fg">
              <MessageCircle className="h-4 w-4" aria-hidden />{stats.comments > 0 ? <span className="tabular-nums">{stats.comments}</span> : null}
            </Link>
            <ActionButton label={stats.reposted ? "Undo repost" : "Repost"} count={stats.reposts} active={stats.reposted} disabled={pending || owner}
              onClick={() => { const was = stats.reposted; run(() => toggleRepost(target.id, was), () => setStats((s) => ({ ...s, reposted: !was, reposts: s.reposts + (was ? -1 : 1) }))); }}>
              <Repeat2 className="h-4 w-4" aria-hidden />
            </ActionButton>
            <ActionButton label={stats.bookmarked ? "Remove bookmark" : "Bookmark"} active={stats.bookmarked} disabled={pending}
              onClick={() => { const was = stats.bookmarked; setStats((s) => ({ ...s, bookmarked: !was })); run(() => toggleBookmark(target.id, was)); }}>
              <Bookmark className={cn("h-4 w-4", stats.bookmarked && "fill-current")} aria-hidden />
            </ActionButton>
            <ActionButton label="Share" onClick={share}><Share2 className="h-4 w-4" aria-hidden /></ActionButton>
          </div>
        </div>
      </div>
    </article>
  );
}
