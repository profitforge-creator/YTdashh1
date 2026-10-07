"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { JOB_CATEGORIES } from "@/lib/constants";
import { formatCents } from "@/lib/utils";
import { createJob } from "./actions";

const defaultDeadline = () => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

export function JobForm({ projects }: { projects: { id: string; title: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [category, setCategory] = useState("tester");
  const [dollars, setDollars] = useState("15");
  const [slots, setSlots] = useState("1");
  const total = Math.round((Number(dollars) || 0) * 100) * (Number(slots) || 1);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries());
    startTransition(async () => {
      const res = await createJob({
        ...fd,
        deadline: fd.deadline ? new Date(`${String(fd.deadline)}T23:59:00`).toISOString() : "",
        session_minutes: fd.session_minutes === "" ? null : fd.session_minutes,
        projectId: fd.projectId === "" ? null : fd.projectId,
      });
      if (!res.ok) { setErrors(res.fieldErrors ?? {}); toast.error(res.error); return; }
      toast.success("Job published.");
      router.push(`/work/${res.data.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field label="Title" htmlFor="title" error={errors.title}><Input id="title" name="title" maxLength={120} placeholder="e.g. 30-minute playtest of my obby" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role" htmlFor="category" error={errors.category}>
          <Select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)}>{JOB_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select>
        </Field>
        {projects.length > 0 ? (
          <Field label="Project (optional)" htmlFor="projectId"><Select id="projectId" name="projectId" defaultValue=""><option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</Select></Field>
        ) : <input type="hidden" name="projectId" value="" />}
      </div>
      <Field label="Description" htmlFor="description" error={errors.description}><Textarea id="description" name="description" maxLength={4000} placeholder="Context, links, what you're building." /></Field>
      <Field label="Exact deliverables" htmlFor="deliverables" error={errors.deliverables}><Textarea id="deliverables" name="deliverables" maxLength={2000} placeholder="e.g. A written report of bugs found, plus a screen recording of your session." /></Field>
      <Field label="Acceptance conditions" htmlFor="acceptance_conditions" error={errors.acceptance_conditions} hint="You approve or dispute against these within 7 days."><Textarea id="acceptance_conditions" name="acceptance_conditions" maxLength={2000} placeholder="e.g. At least 5 distinct findings with steps to reproduce." /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Deadline" htmlFor="deadline" error={errors.deadline}><Input id="deadline" name="deadline" type="date" defaultValue={defaultDeadline()} min={new Date().toISOString().slice(0, 10)} /></Field>
        <Field label="Revisions allowed" htmlFor="revisions_allowed" error={errors.revisions_allowed}><Input id="revisions_allowed" name="revisions_allowed" type="number" min={0} max={5} defaultValue={1} /></Field>
        {category === "tester" ? (
          <Field label="Session length (min)" htmlFor="session_minutes" error={errors.session_minutes}><Input id="session_minutes" name="session_minutes" type="number" min={5} max={600} defaultValue={30} /></Field>
        ) : <input type="hidden" name="session_minutes" value="" />}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Pay per slot (USD)" htmlFor="payment_dollars" error={errors.payment_dollars}><Input id="payment_dollars" name="payment_dollars" type="number" min={5} step="0.01" value={dollars} onChange={(e) => setDollars(e.target.value)} /></Field>
        <Field label="Number of people" htmlFor="slots" error={errors.slots}><Input id="slots" name="slots" type="number" min={1} max={10} value={slots} onChange={(e) => setSlots(e.target.value)} /></Field>
      </div>
      <p className="rounded-xl bg-surface-2 p-3 text-xs text-muted">
        You&apos;ll fund each slot after selecting a person; DevMint holds it as protected pending payment until you approve. Total if all slots fill: <b className="text-fg">{formatCents(total)}</b>. A flat 10% platform fee comes out of the worker&apos;s payment.
      </p>
      <Button type="submit" loading={pending}>Publish job</Button>
    </form>
  );
}
