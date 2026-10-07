"use client";

import { ExternalLink, FlaskConical, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { FACTOR_LABELS } from "@/lib/ai/opportunity";
import type { SubScores } from "@/lib/ai/schemas";
import { CREDIT_COSTS } from "@/lib/config/plans";
import { cn, formatDate } from "@/lib/utils";
import type { Json } from "@/types/database";
import { approveConcept, combineConcepts, reviseConcept } from "./actions";
import type { ConceptView } from "./types";

function asStrings(v: Json): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function asComparables(v: Json): { name: string; why: string }[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) =>
    x && typeof x === "object" && !Array.isArray(x) && typeof x["name"] === "string" && typeof x["why"] === "string"
      ? [{ name: x["name"], why: x["why"] }]
      : [],
  );
}

function asScores(v: Json): Partial<SubScores> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Partial<SubScores>) : {};
}

const CONFIDENCE_TONE = { high: "positive", medium: "warning", low: "danger" } as const;

function ScoreRing({ score }: { score: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-14 w-14 shrink-0" role="img" aria-label={`Opportunity score ${score} out of 100`}>
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth="5" />
        <circle
          cx="28" cy="28" r={r} fill="none" stroke="var(--color-brand-hover)" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold">{score}</span>
    </div>
  );
}

function ConceptCard({
  concept, canEdit, selected, onSelect, decided, busy, run,
}: {
  concept: ConceptView;
  canEdit: boolean;
  selected: boolean;
  onSelect: () => void;
  decided: boolean;
  busy: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => void;
}) {
  const [revising, setRevising] = useState(false);
  const [note, setNote] = useState("");
  const scores = asScores(concept.score_breakdown);
  const approved = concept.status === "approved";
  const pending = concept.status === "proposed";

  return (
    <Card className={cn("space-y-4", approved && "border-positive/50", selected && "border-brand")}>
      <div className="flex items-start gap-3">
        <ScoreRing score={concept.opportunity_score} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-semibold">{concept.title}</h3>
            {approved ? <Badge tone="positive">Approved</Badge> : null}
            {concept.status === "revision_requested" ? <Badge tone="warning">Revision requested</Badge> : null}
          </div>
          <p className="mt-0.5 text-sm text-muted">{concept.hook}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={CONFIDENCE_TONE[concept.confidence]}>
              <ShieldCheck className="h-3 w-3" aria-hidden /> {concept.confidence} confidence
            </Badge>
            <Badge>{concept.difficulty}</Badge>
            {concept.is_fixture ? (
              <Badge tone="warning"><FlaskConical className="h-3 w-3" aria-hidden /> Fixture data</Badge>
            ) : null}
          </div>
        </div>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted">Target player</dt><dd>{concept.target_player}</dd></div>
        <div><dt className="text-xs text-muted">Scope</dt><dd>{concept.scope}</dd></div>
        <div><dt className="text-xs text-muted">Core loop</dt><dd>{concept.core_loop}</dd></div>
        <div><dt className="text-xs text-muted">Progression</dt><dd>{concept.progression}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-muted">Original angle</dt><dd>{concept.original_angle}</dd></div>
      </dl>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Opportunity score breakdown</p>
        <ul className="space-y-1.5">
          {(Object.keys(FACTOR_LABELS) as (keyof SubScores)[]).map((k) => (
            <li key={k} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-xs">
              <span className="text-muted">{FACTOR_LABELS[k]}</span>
              <span className="tabular-nums">{scores[k] ?? "–"}</span>
              <span className="col-span-2 h-1 overflow-hidden rounded-full bg-surface-3">
                <span className="block h-full rounded-full bg-active" style={{ width: `${scores[k] ?? 0}%` }} />
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">{concept.score_explanation}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Comparable games</p>
          <ul className="space-y-1 text-sm">
            {asComparables(concept.comparable_games).map((g) => (
              <li key={g.name}><span className="font-medium">{g.name}</span> <span className="text-muted">— {g.why}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Monetization</p>
          <ul className="list-disc space-y-1 pl-4 text-sm">{asStrings(concept.monetization).map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1 text-xs font-medium text-muted">Main risks</p>
          <ul className="list-disc space-y-1 pl-4 text-sm">{asStrings(concept.risks).map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Sources</p>
        <ul className="space-y-2">
          {concept.sources.map((s) => (
            <li key={s.id} className="rounded-lg bg-surface-2 p-2.5 text-xs">
              <p>{s.claim}</p>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-1 inline-flex items-center gap-1 text-active hover:underline"
              >
                {s.title} <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
              <span className="text-faint"> · {s.publisher} · {formatDate(s.source_date)}</span>
            </li>
          ))}
        </ul>
      </div>

      {canEdit && pending && !decided ? (
        <div className="space-y-3 border-t pt-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => run(() => approveConcept(concept.id), "Concept approved.")}>
              Approve concept
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setRevising((v) => !v)}>
              Request revision
            </Button>
            <label className="ml-auto flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={selected} onChange={onSelect} className="h-4 w-4 accent-[var(--color-brand)]" />
              Combine
            </label>
          </div>
          {revising ? (
            <div className="space-y-2">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should change? e.g. make it more social and cheaper to build." maxLength={1000} aria-label="Revision request" />
              <Button
                size="sm"
                disabled={busy || note.trim().length < 5}
                onClick={() => run(() => reviseConcept(concept.id, note), "Revision started.")}
              >
                Send revision · {CREDIT_COSTS.concepts.amount} credits
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export function ConceptsPanel({
  projectId, concepts, canEdit, researchCredits, hasApproval,
}: {
  projectId: string;
  concepts: ConceptView[];
  canEdit: boolean;
  researchCredits: number;
  hasApproval: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const cost = CREDIT_COSTS.concepts.amount;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Something went wrong.");
      else {
        toast.success(success);
        setSelected([]);
      }
    });
  }

  const visible = concepts.filter((c) => c.status !== "superseded" && c.status !== "combined");
  const proposedCount = visible.filter((c) => c.status === "proposed").length;

  return (
    <div className="space-y-4">
      {!hasApproval && proposedCount > 0 ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 bg-surface-2">
          <p className="text-sm">Approve one concept to unlock the blueprint, or combine two or three. {researchCredits} research credits left.</p>
          {canEdit && selected.length >= 2 ? (
            <Button size="sm" variant="secondary" disabled={pending || researchCredits < cost} onClick={() => run(() => combineConcepts(projectId, selected), "Combining concepts…")}>
              Combine {selected.length} · {cost} credits
            </Button>
          ) : null}
        </Card>
      ) : null}
      {visible.map((c) => (
        <ConceptCard
          key={c.id}
          concept={c}
          canEdit={canEdit}
          selected={selected.includes(c.id)}
          onSelect={() => setSelected((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))}
          decided={hasApproval}
          busy={pending}
          run={run}
        />
      ))}
    </div>
  );
}
