"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Desktop: chat left, output right. Mobile: two snap-scrolling panes (swipe or tap the tabs) so the
 * generated output behaves like a drawer beside the conversation.
 */
export function WorkspaceShell({ chat, output }: { chat: React.ReactNode; output: React.ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [pane, setPane] = useState<0 | 1>(0);

  function go(i: 0 | 1) {
    setPane(i);
    const el = scroller.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div>
      <div role="tablist" aria-label="Workspace panes" className="mb-3 grid grid-cols-2 rounded-xl border p-1 lg:hidden">
        {(["Conversation", "Output"] as const).map((label, i) => (
          <button
            key={label}
            role="tab"
            aria-selected={pane === i}
            onClick={() => go(i as 0 | 1)}
            className={cn("rounded-lg py-1.5 text-sm transition-colors", pane === i ? "bg-surface-3 text-fg" : "text-muted")}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          setPane(el.scrollLeft > el.clientWidth / 2 ? 1 : 0);
        }}
        className="scroll-thin flex snap-x snap-mandatory overflow-x-auto lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-4 lg:overflow-visible"
      >
        <div className="w-full shrink-0 snap-center pr-0 lg:sticky lg:top-20 lg:h-[calc(100dvh-8rem)] lg:self-start">{chat}</div>
        <div className="w-full shrink-0 snap-center pl-3 lg:pl-0">{output}</div>
      </div>
    </div>
  );
}
