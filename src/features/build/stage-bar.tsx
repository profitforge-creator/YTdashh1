import { Check, Lock } from "lucide-react";
import { STAGE_LABELS, STAGES } from "@/lib/constants";
import { CREDIT_COSTS } from "@/lib/config/plans";
import { cn } from "@/lib/utils";
import type { ProjectStage } from "@/types/database";

type State = "done" | "current" | "locked";

const STAGE_META: Record<ProjectStage, string> = {
  interview: "Free",
  research: `${CREDIT_COSTS.concepts.amount} research credits`,
  concept: "Needs your approval",
  blueprint: "Unlocks after approval",
  assets: "After beta",
  scripts: "After beta",
  test: "After beta",
};

export function StageBar({ stage, approved }: { stage: ProjectStage; approved: boolean }) {
  const currentIndex = STAGES.indexOf(stage);
  return (
    <ol className="scroll-thin flex gap-2 overflow-x-auto pb-1" aria-label="Build stages">
      {STAGES.map((s, i) => {
        const state: State = i < currentIndex ? "done" : i === currentIndex ? "current" : "locked";
        return (
          <li
            key={s}
            aria-current={state === "current" ? "step" : undefined}
            className={cn(
              "min-w-[7.5rem] shrink-0 rounded-xl border px-3 py-2",
              state === "current" && "border-brand bg-brand-soft",
              state === "locked" && "opacity-60",
            )}
          >
            <div className="flex items-center gap-1.5 text-xs font-medium">
              {state === "done" ? <Check className="h-3.5 w-3.5 text-positive" aria-hidden /> : null}
              {state === "locked" && i > 3 ? <Lock className="h-3 w-3 text-faint" aria-hidden /> : null}
              {STAGE_LABELS[s]}
            </div>
            <p className="mt-0.5 text-[11px] text-muted">
              {s === "concept" && approved ? "Approved" : STAGE_META[s]}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
