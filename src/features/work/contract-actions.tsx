"use client";

import { Paperclip, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { EVIDENCE_MIMES, MAX_EVIDENCE_BYTES } from "@/lib/validation/work";
import { formatCents } from "@/lib/utils";
import { approveWork, fundContract, leaveReview, openDispute, requestRevision, submitWork } from "./actions";

function useRun() {
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, onOk?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Something went wrong.");
      else { toast.success(success); onOk?.(); }
    });
  return { pending, run };
}

export function FundButton({ contractId, amountCents, feeCents }: { contractId: string; amountCents: number; feeCents: number }) {
  const { pending, run } = useRun();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Fund {formatCents(amountCents)} to start the job. It stays protected and pending until you approve the work. The worker receives {formatCents(amountCents - feeCents)} after the 10% platform fee.
      </p>
      <Button loading={pending} onClick={() => run(() => fundContract(contractId), "Funded in test mode.")}>Fund job · {formatCents(amountCents)} (test mode)</Button>
      <p className="text-xs text-faint">Test mode: no card is charged and no real money moves.</p>
    </div>
  );
}

export function BuyerReviewActions({ contractId, canRevise }: { contractId: string; canRevise: boolean }) {
  const { pending, run } = useRun();
  const [mode, setMode] = useState<"none" | "revise">("none");
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button loading={pending} onClick={() => run(() => approveWork(contractId), "Approved. Payment released.")}>Approve &amp; release payment</Button>
        {canRevise ? <Button variant="secondary" disabled={pending} onClick={() => setMode(mode === "revise" ? "none" : "revise")}>Request revision</Button> : null}
      </div>
      {mode === "revise" ? (
        <div className="space-y-2">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="What needs to change?" aria-label="Revision note" />
          <Button size="sm" disabled={pending || note.trim().length < 5} onClick={() => run(() => requestRevision(contractId, note), "Revision requested.", () => setNote(""))}>Send revision request</Button>
        </div>
      ) : null}
    </div>
  );
}

export function DisputeForm({ contractId }: { contractId: string }) {
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <Button variant="danger" size="sm" onClick={() => setOpen(true)}>Open a dispute</Button>;
  return (
    <div className="space-y-2 rounded-xl border border-danger/30 bg-danger/5 p-3">
      <p className="text-xs text-muted">A dispute freezes the payment while DevMint reviews the agreement, messages, revisions and evidence.</p>
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} placeholder="Explain what went wrong (10+ characters)." aria-label="Dispute reason" />
      <div className="flex gap-2">
        <Button variant="danger" size="sm" loading={pending} disabled={reason.trim().length < 10} onClick={() => run(() => openDispute(contractId, reason), "Dispute opened.")}>Submit dispute</Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

interface PendingFile { file: File }

export function SubmitWorkForm({ contractId, testerHint }: { contractId: string; testerHint: boolean }) {
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    const next = [...files];
    for (const f of picked) {
      if (!(EVIDENCE_MIMES as readonly string[]).includes(f.type)) { toast.error(`${f.name}: unsupported file type.`); continue; }
      if (f.size > MAX_EVIDENCE_BYTES) { toast.error(`${f.name} is larger than 100 MB.`); continue; }
      if (next.length >= 10) { toast.error("Up to 10 files."); break; }
      next.push({ file: f });
    }
    setFiles(next);
  }

  function submit() {
    startTransition(async () => {
      const supabase = createClient();
      const uploaded: { path: string; name: string; mime: string }[] = [];
      try {
        for (const { file } of files) {
          const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
          const path = `${contractId}/${crypto.randomUUID()}-${safe}`;
          const { error } = await supabase.storage.from("evidence").upload(path, file, { contentType: file.type, upsert: false });
          if (error) throw new Error("Upload failed. Check the file type and size.");
          uploaded.push({ path, name: file.name, mime: file.type });
        }
      } catch (err) {
        if (uploaded.length) await supabase.storage.from("evidence").remove(uploaded.map((u) => u.path));
        toast.error(err instanceof Error ? err.message : "Upload failed.");
        return;
      }
      const res = await submitWork({ contractId, note, evidence: uploaded });
      if (!res.ok) {
        if (uploaded.length) await supabase.storage.from("evidence").remove(uploaded.map((u) => u.path));
        toast.error(res.error);
        return;
      }
      toast.success("Work submitted.");
      setNote(""); setFiles([]);
    });
  }

  return (
    <div className="space-y-3">
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} aria-label="Submission note" placeholder={testerHint ? "Your structured report: what you tested, bugs found with steps to reproduce, suggestions." : "Describe what you're delivering and how to use it."} className="min-h-32" />
      <input ref={input} type="file" multiple accept={EVIDENCE_MIMES.join(",")} onChange={onPick} className="sr-only" aria-label="Attach evidence" />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={pending}><Paperclip className="h-4 w-4" aria-hidden /> Add screenshots, video or files</Button>
        <span className="text-xs text-faint">PNG, JPG, WebP, MP4, WebM, PDF, TXT, ZIP · 100 MB each</span>
      </div>
      {files.length > 0 ? (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={`${f.file.name}-${i}`} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-1.5 text-xs">
              <span className="truncate">{f.file.name}</span>
              <button type="button" aria-label={`Remove ${f.file.name}`} onClick={() => setFiles((l) => l.filter((_, idx) => idx !== i))}><X className="h-3.5 w-3.5" aria-hidden /></button>
            </li>
          ))}
        </ul>
      ) : null}
      <Button loading={pending} disabled={!note.trim() && files.length === 0} onClick={submit}>Submit work</Button>
    </div>
  );
}

export function ReviewForm({ contractId }: { contractId: string }) {
  const { pending, run } = useRun();
  const [rating, setRating] = useState("5");
  const [body, setBody] = useState("");
  return (
    <div className="space-y-2">
      <Select value={rating} onChange={(e) => setRating(e.target.value)} aria-label="Rating" className="w-32">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}</Select>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="Share how it went (optional)." aria-label="Review" />
      <Button size="sm" loading={pending} onClick={() => run(() => leaveReview({ contractId, rating, body }), "Review posted.")}>Post review</Button>
    </div>
  );
}
