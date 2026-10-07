"use client";

import { Bell, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function Topbar({ userId, initialUnread, initialMessages }: { userId: string; initialUnread: number; initialMessages: number }) {
  const [unread, setUnread] = useState(initialUnread);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => setUnread((n) => n + 1),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-bg/90 px-4 backdrop-blur lg:px-8">
      <Link href="/home" className="flex items-center gap-2 lg:invisible">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-sm font-bold">D</span>
        <span className="font-semibold tracking-tight">DevMint</span>
      </Link>
      <div className="flex items-center gap-1">
        <Link href="/messages" aria-label="Messages" className="relative rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-fg">
          <MessageSquare className="h-5 w-5" aria-hidden />
          {initialMessages > 0 ? (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-hover" aria-label={`${initialMessages} unread`} />
          ) : null}
        </Link>
        <Link href="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-fg">
          <Bell className="h-5 w-5" aria-hidden />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
