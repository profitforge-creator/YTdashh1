"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Select } from "@/components/ui/input";
import { AI_PROVIDERS } from "@/lib/constants";
import type { AiProvider } from "@/types/database";
import { setProvider } from "./actions";

export function ProviderSelect({ projectId, value }: { projectId: string; value: AiProvider }) {
  const [pending, startTransition] = useTransition();
  return (
    <Select
      aria-label="AI provider"
      className="h-9 w-32"
      value={value}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          const res = await setProvider(projectId, e.target.value as AiProvider);
          if (!res.ok) toast.error(res.error);
        })
      }
    >
      {AI_PROVIDERS.map((p) => (
        <option key={p.value} value={p.value}>{p.label}</option>
      ))}
    </Select>
  );
}
