"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import {
  isAnswered, questionsForRoute, type Answers, type Question, type Route,
} from "@/lib/interview/schema";
import { cn } from "@/lib/utils";
import type { ProjectMessageRow } from "@/types/database";
import { answerFollowUp, submitAnswer } from "./actions";

interface Props {
  projectId: string;
  route: Route;
  messages: ProjectMessageRow[];
  answers: Answers;
  confirmed: boolean;
  canEdit: boolean;
}

function AnswerControls({ projectId, question, disabled }: { projectId: string; question: Question; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");

  function send(value: string | string[] | undefined, skip = false) {
    startTransition(async () => {
      const res = await submitAnswer({ projectId, questionId: question.id, value, skip });
      if (!res.ok) toast.error(res.error);
      else {
        setSelected([]);
        setText("");
      }
    });
  }

  const busy = pending || disabled;

  if (question.type === "text") {
    return (
      <div className="space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={question.placeholder}
          maxLength={4000}
          aria-label={question.prompt}
          disabled={busy}
          className="min-h-20"
        />
        <div className="flex justify-end gap-2">
          {question.optional ? (
            <Button variant="ghost" size="sm" onClick={() => send(undefined, true)} disabled={busy}>Skip</Button>
          ) : null}
          <Button size="sm" onClick={() => send(text)} disabled={busy || !text.trim()} loading={pending}>
            <Send className="h-3.5 w-3.5" aria-hidden /> Send
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {question.options?.map((o) => {
          const active = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              disabled={busy}
              aria-pressed={active}
              onClick={() => {
                if (question.type === "single") send(o.value);
                else setSelected((s) => (s.includes(o.value) ? s.filter((x) => x !== o.value) : [...s, o.value]));
              }}
              className={cn(
                "rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50",
                active ? "border-brand bg-brand-soft" : "hover:border-border-strong",
              )}
            >
              <span className="block">{o.label}</span>
              {o.hint ? <span className="block text-[11px] text-muted">{o.hint}</span> : null}
            </button>
          );
        })}
      </div>
      {question.type === "multi" ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => send(selected)} disabled={busy || selected.length === 0} loading={pending}>
            Continue
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FollowUpControls({ projectId, disabled }: { projectId: string; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  return (
    <div className="space-y-2">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} className="min-h-20" aria-label="Your answer" disabled={disabled || pending} />
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={disabled || !text.trim()}
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await answerFollowUp({ projectId, value: text });
              if (!res.ok) toast.error(res.error);
              else setText("");
            })
          }
        >
          <Send className="h-3.5 w-3.5" aria-hidden /> Send
        </Button>
      </div>
    </div>
  );
}

export function ChatPanel({ projectId, route, messages, answers, confirmed, canEdit }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const skipped = Array.isArray(answers["_skipped"]) ? (answers["_skipped"] as string[]) : [];
  const pendingFollowUp = typeof answers["_pending_followup"] === "string";
  const next = questionsForRoute(route).find((q) => !isAnswered(q, answers) && !skipped.includes(q.id));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  return (
    <section aria-label="AI conversation" className="flex h-full min-h-[28rem] flex-col rounded-[var(--radius-card)] border bg-surface">
      <div className="scroll-thin flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <p
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                m.role === "user" ? "bg-brand text-white" : "bg-surface-3",
              )}
            >
              {m.content}
            </p>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="border-t p-3">
        {!canEdit ? (
          <p className="text-xs text-muted">You have view-only access to this project.</p>
        ) : confirmed ? (
          <p className="text-xs text-muted">The interview is confirmed. Use the output panel to review concepts.</p>
        ) : pendingFollowUp ? (
          <FollowUpControls projectId={projectId} disabled={false} />
        ) : next ? (
          <AnswerControls key={next.id} projectId={projectId} question={next} disabled={false} />
        ) : (
          <p className="text-xs text-muted">Interview complete. Review and confirm the summary to start research.</p>
        )}
      </div>
    </section>
  );
}
