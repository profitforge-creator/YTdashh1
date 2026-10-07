"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { AiProvider } from "@/types/database";
import { createProject } from "./actions";

interface RouteCard {
  route: "discover" | "idea" | "improve";
  title: string;
  body: string;
  icon: React.ReactNode;
}

export function NewProjectButtons({ routes, defaultProvider }: { routes: RouteCard[]; defaultProvider: AiProvider }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<string | null>(null);

  function start(route: RouteCard["route"]) {
    setActive(route);
    startTransition(async () => {
      const res = await createProject({ route, provider: defaultProvider });
      if (!res.ok) {
        toast.error(res.error);
        setActive(null);
        return;
      }
      router.push(`/build/${res.data.id}`);
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {routes.map((r) => (
        <button
          key={r.route}
          type="button"
          disabled={pending}
          onClick={() => start(r.route)}
          className={cn(
            "flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors hover:border-brand disabled:opacity-60",
            active === r.route && "border-brand bg-brand-soft",
          )}
        >
          <span className="text-[#ff8da1]">{r.icon}</span>
          <span className="text-sm font-medium">{r.title}</span>
          <span className="text-xs text-muted">{r.body}</span>
        </button>
      ))}
    </div>
  );
}
