"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { AI_PROVIDERS } from "@/lib/constants";
import type { AiProvider } from "@/types/database";
import { saveSettings } from "./actions";

export const NOTIFICATION_KINDS = [
  { id: "jobs", label: "Job applications and selections" },
  { id: "messages", label: "Messages and message requests" },
  { id: "payments", label: "Funding, approvals, payouts, refunds, disputes" },
  { id: "builds", label: "Completed AI builds" },
  { id: "analytics", label: "Analytics changes" },
  { id: "rank", label: "Rank and perk changes" },
  { id: "tasks", label: "Project tasks and deadlines" },
] as const;

export type Prefs = Record<(typeof NOTIFICATION_KINDS)[number]["id"], { in_app: boolean; push: boolean; email: boolean }>;

export const DEFAULT_PREFS: Prefs = Object.fromEntries(
  NOTIFICATION_KINDS.map((k) => [k.id, { in_app: true, push: k.id === "payments" || k.id === "messages", email: k.id === "payments" }]),
) as Prefs;

export function SettingsForm({ initial }: { initial: { dm_policy: "open" | "requests"; preferred_ai: AiProvider; prefs: Prefs } }) {
  const [state, setState] = useState(initial);
  const [pending, startTransition] = useTransition();

  const toggle = (kind: keyof Prefs, channel: "in_app" | "push" | "email") =>
    setState((s) => ({ ...s, prefs: { ...s.prefs, [kind]: { ...s.prefs[kind], [channel]: !s.prefs[kind][channel] } } }));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await saveSettings({ dm_policy: state.dm_policy, preferred_ai: state.preferred_ai, notification_prefs: state.prefs });
          if (!res.ok) toast.error(res.error);
          else toast.success("Settings saved.");
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Who can message you" htmlFor="st-dm">
          <Select id="st-dm" value={state.dm_policy} onChange={(e) => setState((s) => ({ ...s, dm_policy: e.target.value as "open" | "requests" }))}>
            <option value="requests">Requests only</option><option value="open">Anyone</option>
          </Select>
        </Field>
        <Field label="Default AI provider" htmlFor="st-ai">
          <Select id="st-ai" value={state.preferred_ai} onChange={(e) => setState((s) => ({ ...s, preferred_ai: e.target.value as AiProvider }))}>
            {AI_PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-muted">Notifications</legend>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead className="text-xs text-muted"><tr><th className="py-2 text-left font-medium">Event</th><th className="font-medium">In-app</th><th className="font-medium">Push</th><th className="font-medium">Email</th></tr></thead>
            <tbody>
              {NOTIFICATION_KINDS.map((k) => (
                <tr key={k.id} className="border-t">
                  <td className="py-2.5 pr-3">{k.label}</td>
                  {(["in_app", "push", "email"] as const).map((c) => (
                    <td key={c} className="text-center">
                      <input type="checkbox" checked={state.prefs[k.id][c]} onChange={() => toggle(k.id, c)} aria-label={`${k.label}: ${c.replace("_", "-")}`} className="h-4 w-4 accent-[var(--color-brand)]" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-faint">Busy events are grouped into digests. Push and email delivery turn on after the beta; preferences are stored now. Payment and security events are always immediate.</p>
      </fieldset>
      <Button type="submit" loading={pending}>Save settings</Button>
    </form>
  );
}
