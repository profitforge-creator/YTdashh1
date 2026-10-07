"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  AI_PROVIDERS, EXPERIENCE_LEVELS, GENRES, GOALS, ROLE_OPTIONS, SKILLS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AiProvider, AppRole } from "@/types/database";
import { completeOnboarding } from "./actions";

interface FormState {
  display_name: string;
  roles: AppRole[];
  experience_level: string;
  genres: string[];
  skills: string[];
  goals: string[];
  weekly_hours: string;
  budget_usd: string;
  preferred_ai: AiProvider;
}

const STEPS = ["About you", "Interests", "Goals & time", "Your AI"] as const;

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active ? "border-brand bg-brand-soft text-fg" : "text-muted hover:border-border-strong hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<FormState>({
    display_name: defaultName,
    roles: [],
    experience_level: "",
    genres: [],
    skills: [],
    goals: [],
    weekly_hours: "10",
    budget_usd: "0",
    preferred_ai: "claude",
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setState((s) => ({ ...s, [key]: value }));

  function validateStep(): boolean {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!state.display_name.trim()) e.display_name = "Add a display name.";
      if (state.roles.length === 0) e.roles = "Pick at least one role.";
      if (!state.experience_level) e.experience_level = "Choose your experience level.";
    }
    if (step === 1 && state.genres.length === 0) e.genres = "Pick at least one genre.";
    if (step === 2 && state.goals.length === 0) e.goals = "Pick at least one goal.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (validateStep()) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function submit() {
    if (!validateStep()) return;
    startTransition(async () => {
      const res = await completeOnboarding({
        ...state,
        weekly_hours: Number(state.weekly_hours || 0),
        budget_usd: Number(state.budget_usd || 0),
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success("You're all set.");
      router.replace("/home");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-5 py-8">
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
        <Progress value={((step + 1) / STEPS.length) * 100} />
      </div>

      {step === 0 && (
        <div className="space-y-5">
          <h1 className="text-xl font-semibold">Tell us about you</h1>
          <Field label="Display name" htmlFor="display_name" error={errors.display_name}>
            <Input id="display_name" value={state.display_name} maxLength={40} onChange={(e) => set("display_name", e.target.value)} />
          </Field>
          <Field label="What are you here to do? (pick any)" error={errors.roles}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  aria-pressed={state.roles.includes(r.value)}
                  onClick={() => set("roles", toggle(state.roles, r.value))}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    state.roles.includes(r.value) ? "border-brand bg-brand-soft" : "hover:border-border-strong",
                  )}
                >
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-xs text-muted">{r.blurb}</p>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Experience level" htmlFor="exp" error={errors.experience_level}>
            <Select id="exp" value={state.experience_level} onChange={(e) => set("experience_level", e.target.value)}>
              <option value="">Select…</option>
              {EXPERIENCE_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <h1 className="text-xl font-semibold">What do you like?</h1>
          <Field label="Preferred Roblox genres" error={errors.genres}>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <Chip key={g} active={state.genres.includes(g)} onClick={() => set("genres", toggle(state.genres, g))}>{g}</Chip>
              ))}
            </div>
          </Field>
          <Field label="Your skills (optional)">
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((s) => (
                <Chip key={s} active={state.skills.includes(s)} onClick={() => set("skills", toggle(state.skills, s))}>{s}</Chip>
              ))}
            </div>
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <h1 className="text-xl font-semibold">Goals and capacity</h1>
          <Field label="Goals" error={errors.goals}>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <Chip key={g} active={state.goals.includes(g)} onClick={() => set("goals", toggle(state.goals, g))}>{g}</Chip>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hours per week" htmlFor="hours">
              <Input id="hours" type="number" inputMode="numeric" min={0} max={168} value={state.weekly_hours} onChange={(e) => set("weekly_hours", e.target.value)} />
            </Field>
            <Field label="Project budget (USD)" htmlFor="budget" hint="Total you could spend on a project.">
              <Input id="budget" type="number" inputMode="numeric" min={0} value={state.budget_usd} onChange={(e) => set("budget_usd", e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <h1 className="text-xl font-semibold">Pick your AI</h1>
          <p className="text-sm text-muted">DevMint supplies AI access and charges credits. No API keys needed. You can switch per project.</p>
          <div className="grid grid-cols-3 gap-2">
            {AI_PROVIDERS.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={state.preferred_ai === p.value}
                onClick={() => set("preferred_ai", p.value)}
                className={cn(
                  "rounded-xl border p-3 text-center transition-colors",
                  state.preferred_ai === p.value ? "border-brand bg-brand-soft" : "hover:border-border-strong",
                )}
              >
                <p className="text-sm font-medium">{p.label}</p>
                <p className="text-xs text-muted">{p.blurb}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between gap-3 pt-2">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || pending}>Back</Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>Continue</Button>
        ) : (
          <Button onClick={submit} loading={pending}>Finish</Button>
        )}
      </div>
    </div>
  );
}
