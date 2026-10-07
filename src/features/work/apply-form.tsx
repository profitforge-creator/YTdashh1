"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { applyToJob } from "./actions";

export function ApplyForm({ jobId }: { jobId: string }) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(e.currentTarget).entries());
        startTransition(async () => {
          const res = await applyToJob({ jobId, ...fd });
          if (!res.ok) { setErrors(res.fieldErrors ?? {}); toast.error(res.error); return; }
          toast.success("Application sent.");
        });
      }}
    >
      <Field label="Portfolio link (optional)" htmlFor="portfolio_url" error={errors.portfolio_url}><Input id="portfolio_url" name="portfolio_url" type="url" placeholder="https://" /></Field>
      <Field label="Relevant proof" htmlFor="proof" error={errors.proof} hint="Past work, games you've tested, tools you use."><Textarea id="proof" name="proof" maxLength={2000} /></Field>
      <Field label="Availability" htmlFor="availability" error={errors.availability}><Input id="availability" name="availability" maxLength={300} placeholder="e.g. Evenings and weekends" /></Field>
      <Field label="Your offer" htmlFor="offer" error={errors.offer}><Textarea id="offer" name="offer" maxLength={1500} placeholder="Why you're a good fit and how you'll deliver." /></Field>
      <Button type="submit" loading={pending}>Send application</Button>
    </form>
  );
}
