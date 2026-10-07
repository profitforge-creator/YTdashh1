"use client";

import { Upload } from "lucide-react";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { importCsv } from "./actions";

export function CsvImport({ projectId }: { projectId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      toast.error("That file is too large (max 512 KB).");
      e.target.value = "";
      return;
    }
    startTransition(async () => {
      const text = await file.text();
      const res = await importCsv(projectId, file.name, text);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(`Imported ${res.data.imported} day${res.data.imported === 1 ? "" : "s"}.`);
        if (res.data.skipped.length) toast.warning(`Skipped: ${res.data.skipped.join(" ")}`);
      }
      if (input.current) input.current.value = "";
    });
  }

  return (
    <div className="space-y-2">
      <input ref={input} type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" id="csv-file" />
      <Button variant="secondary" loading={pending} onClick={() => input.current?.click()} type="button">
        <Upload className="h-4 w-4" aria-hidden /> Import CSV
      </Button>
      <p className="text-xs text-muted">
        Needs a <code>date</code> column (YYYY-MM-DD) plus any of: active_players, d1, d7, d30, robux, visits, avg_session_minutes, conversion.
      </p>
    </div>
  );
}
