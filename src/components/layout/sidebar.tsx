"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DESKTOP_NAV, isActive } from "./nav-config";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-surface/60 px-3 py-5 lg:flex">
      <Link href="/home" className="mb-6 flex items-center gap-2 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand font-bold">D</span>
        <span className="text-base font-semibold tracking-tight">DevMint</span>
      </Link>
      <nav aria-label="Primary" className="flex flex-1 flex-col gap-0.5">
        {DESKTOP_NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                active ? "bg-brand-soft text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icon className={cn("h-4 w-4", active && "text-[#ff8da1]")} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
