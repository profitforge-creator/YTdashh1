"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { NotificationGroup } from "@/lib/notifications/group";
import { cn, timeAgo } from "@/lib/utils";
import { markNotificationsRead } from "./actions";

export function NotificationList({ groups }: { groups: NotificationGroup[] }) {
  const [pending, startTransition] = useTransition();
  const anyUnread = groups.some((g) => g.unread);

  return (
    <div className="space-y-3">
      {anyUnread ? (
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" loading={pending} onClick={() => startTransition(async () => { const r = await markNotificationsRead(); if (!r.ok) toast.error(r.error); })}>
            Mark all read
          </Button>
        </div>
      ) : null}
      <ul className="space-y-2">
        {groups.map((g) => {
          const content = (
            <div className={cn("flex items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-surface-2", g.unread ? "bg-surface" : "opacity-70")}>
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", g.unread ? "bg-brand-hover" : "bg-transparent")} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{g.title}</p>
                {g.body ? <p className="mt-0.5 text-xs text-muted">{g.body}</p> : null}
              </div>
              <span className="shrink-0 text-xs text-faint">{timeAgo(g.latest)}</span>
            </div>
          );
          return (
            <li key={g.id}>
              {g.href ? (
                <Link href={g.href} onClick={() => { void markNotificationsRead(g.items.map((i) => i.id)); }}>{content}</Link>
              ) : content}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
