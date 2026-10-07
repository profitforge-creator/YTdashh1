"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { saveSnapshot } from "./actions";

const today = () => new Date().toISOString().slice(0, 10);

export function SnapshotForm({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = { projectId, ...Object.fromEntries(fd.entries()) };
    startTransition(async () => {
      const res = await saveSnapshot(payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setErrors({});
      toast.success("Snapshot saved.");
      form.reset();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Date" htmlFor="captured_on" error={errors.captured_on}>
          <Input id="captured_on" name="captured_on" type="date" defaultValue={today()} max={today()} />
        </Field>
        <Field label="Active players" htmlFor="active_players" error={errors.active_players}>
          <Input id="active_players" name="active_players" type="number" inputMode="numeric" min={0} />
        </Field>
        <Field label="Robux revenue" htmlFor="robux_revenue" error={errors.robux_revenue}>
          <Input id="robux_revenue" name="robux_revenue" type="number" inputMode="numeric" min={0} />
        </Field>
        <Field label="Visits" htmlFor="visits" error={errors.visits}>
          <Input id="visits" name="visits" type="number" inputMode="numeric" min={0} />
        </Field>
        <Field label="D1 retention %" htmlFor="retention_d1" error={errors.retention_d1}>
          <Input id="retention_d1" name="retention_d1" type="number" step="0.1" min={0} max={100} />
        </Field>
        <Field label="D7 retention %" htmlFor="retention_d7" error={errors.retention_d7}>
          <Input id="retention_d7" name="retention_d7" type="number" step="0.1" min={0} max={100} />
        </Field>
        <Field label="D30 retention %" htmlFor="retention_d30" error={errors.retention_d30}>
          <Input id="retention_d30" name="retention_d30" type="number" step="0.1" min={0} max={100} />
        </Field>
        <Field label="Avg session (min)" htmlFor="avg_session_minutes" error={errors.avg_session_minutes}>
          <Input id="avg_session_minutes" name="avg_session_minutes" type="number" step="0.1" min={0} />
        </Field>
        <Field label="Conversion %" htmlFor="conversion_rate" error={errors.conversion_rate}>
          <Input id="conversion_rate" name="conversion_rate" type="number" step="0.1" min={0} max={100} />
        </Field>
      </div>
      <Button type="submit" loading={pending}>Save snapshot</Button>
    </form>
  );
}
