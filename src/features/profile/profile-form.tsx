"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { updateProfile } from "@/features/community/actions";

export function ProfileForm({ initial }: { initial: { display_name: string; handle: string; bio: string; dm_policy: "open" | "requests" } }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) => setValues((s) => ({ ...s, [k]: v }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await updateProfile(values);
          if (!res.ok) { setErrors(res.fieldErrors ?? {}); toast.error(res.error); return; }
          setErrors({});
          toast.success("Profile saved.");
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Display name" htmlFor="pf-name" error={errors.display_name}><Input id="pf-name" value={values.display_name} maxLength={40} onChange={(e) => set("display_name", e.target.value)} /></Field>
        <Field label="Handle" htmlFor="pf-handle" error={errors.handle}><Input id="pf-handle" value={values.handle} maxLength={24} onChange={(e) => set("handle", e.target.value.toLowerCase())} /></Field>
      </div>
      <Field label="Bio" htmlFor="pf-bio" error={errors.bio} hint="Up to 280 characters."><Textarea id="pf-bio" value={values.bio} maxLength={280} onChange={(e) => set("bio", e.target.value)} /></Field>
      <Field label="Who can message you" htmlFor="pf-dm" hint="Requests only: new people must be accepted before they can chat.">
        <Select id="pf-dm" value={values.dm_policy} onChange={(e) => set("dm_policy", e.target.value as "open" | "requests")}>
          <option value="requests">Requests only</option>
          <option value="open">Anyone</option>
        </Select>
      </Field>
      <Button type="submit" loading={pending}>Save profile</Button>
    </form>
  );
}
