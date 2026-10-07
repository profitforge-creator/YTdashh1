"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { CREDIT_COSTS } from "@/lib/config/plans";
import { buildSummary, isInterviewComplete, type Answers, type Route, type SummaryItem } from "@/lib/interview/schema";
import { confirmSummaryAndResearch } from "./actions";

export function SummaryEditor({
  projectId, route, answers, canEdit, researchCredits,
}: {
  projectId: string;
  route: Route;
  answers: Answers;
  canEdit: boolean;
  researchCredits: number;
}) {
  const skipped = Array.isArray(answers["_skipped"]) ? (answers["_skipped"] as string[]) : [];
  const complete = isInterviewComplete(route, answers, skipped) && typeof answers["_pending_followup"] !== "string";
  const items = buildSummary(route, answers);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const cost = CREDIT_COSTS.concepts.amount;
  const affordable = researchCredits >= cost;

  function confirm() {
    const payload: SummaryItem[] = items.map((i) => ({ ...i, value: (edits[i.id] ?? i.value).trim() || i.value }));
    startTransition(async () => {
      const res = await confirmSummaryAndResearch({ projectId, items: payload });
      if (!res.ok) toast.error(res.error);
      else toast.success("Research started. We'll notify you when it's ready.");
    });
  }

  return (
    <Card>
      <CardHeader title={complete ? "Review your summary" : "Your answers so far"} />
      {items.length === 0 ? (
        <p className="text-sm text-muted">Answer the questions on the left and your project summary will build here.</p>
      ) : (
        <dl className="space-y-3">
          {items.map((item) => (
            <div key={item.id}>
              <dt className="mb-1 text-xs font-medium text-muted">{item.label}</dt>
              <dd>
                {complete && canEdit ? (
                  <Textarea
                    aria-label={item.label}
                    value={edits[item.id] ?? item.value}
                    onChange={(e) => setEdits((s) => ({ ...s, [item.id]: e.target.value }))}
                    className="min-h-12 text-sm"
                    maxLength={4000}
                  />
                ) : (
                  <p className="text-sm">{item.value}</p>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {complete && canEdit ? (
        <div className="mt-5 space-y-2 border-t pt-4">
          <Button className="w-full" onClick={confirm} loading={pending} disabled={!affordable}>
            <Sparkles className="h-4 w-4" aria-hidden /> Confirm &amp; start research · {cost} credits
          </Button>
          <p className="text-center text-xs text-muted">
            {affordable
              ? `You have ${researchCredits} research credits. Failed research is refunded automatically.`
              : `You have ${researchCredits} research credits. Upgrade your plan or buy a pack to continue.`}
          </p>
        </div>
      ) : null}
    </Card>
  );
}
