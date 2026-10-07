"use client";

import { CalendarClock, Check } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { completeTask } from "@/features/build/actions";
import { formatDate } from "@/lib/utils";
import type { BuildTaskRow } from "@/types/database";

export function NextTaskCard({ task, projectId }: { task: BuildTaskRow | null; projectId: string | null }) {
  const [pending, startTransition] = useTransition();

  if (!task) {
    return (
      <Card>
        <CardHeader title="Next build task" />
        <p className="text-sm text-muted">
          {projectId ? "You're all caught up. New tasks appear as your project moves forward." : "Start a project to get a guided task list."}
        </p>
        {!projectId ? (
          <Link href="/build" className="mt-3 inline-block text-sm text-brand-hover underline underline-offset-4">Start a project</Link>
        ) : null}
      </Card>
    );
  }

  const overdue = task.due_at ? Date.parse(task.due_at) < Date.now() : false;
  return (
    <Card>
      <CardHeader title="Next build task" />
      <p className="text-base font-medium">{task.title}</p>
      {task.detail ? <p className="mt-1 text-sm text-muted">{task.detail}</p> : null}
      <div className="mt-4 flex items-center justify-between gap-3">
        {task.due_at ? (
          <span className={`inline-flex items-center gap-1.5 text-xs ${overdue ? "text-warning" : "text-muted"}`}>
            <CalendarClock className="h-3.5 w-3.5" aria-hidden /> {overdue ? "Overdue · " : "Due "}{formatDate(task.due_at)}
          </span>
        ) : <span />}
        <Button
          size="sm"
          variant="secondary"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await completeTask(task.id, true);
              if (!res.ok) toast.error(res.error);
              else toast.success("Task completed.");
            })
          }
        >
          <Check className="h-4 w-4" aria-hidden /> Mark done
        </Button>
      </div>
    </Card>
  );
}
