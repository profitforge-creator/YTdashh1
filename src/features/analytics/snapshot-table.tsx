"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatCompact } from "@/lib/utils";
import type { MetricSnapshotRow } from "@/types/database";
import { deleteSnapshot } from "./actions";

const cell = (v: number | null, suffix = "") => (v === null ? "–" : `${v}${suffix}`);

export function SnapshotTable({ rows, canEdit }: { rows: MetricSnapshotRow[]; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  if (rows.length === 0) return <p className="text-sm text-muted">No snapshots yet.</p>;
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="py-2 pr-3 font-medium">Date</th><th className="pr-3 font-medium">Players</th>
            <th className="pr-3 font-medium">D1</th><th className="pr-3 font-medium">D7</th><th className="pr-3 font-medium">D30</th>
            <th className="pr-3 font-medium">Robux</th><th className="pr-3 font-medium">Source</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-2 pr-3">{r.captured_on}</td>
              <td className="pr-3 tabular-nums">{r.active_players === null ? "–" : formatCompact(r.active_players)}</td>
              <td className="pr-3 tabular-nums">{cell(r.retention_d1, "%")}</td>
              <td className="pr-3 tabular-nums">{cell(r.retention_d7, "%")}</td>
              <td className="pr-3 tabular-nums">{cell(r.retention_d30, "%")}</td>
              <td className="pr-3 tabular-nums">{r.robux_revenue === null ? "–" : formatCompact(r.robux_revenue)}</td>
              <td className="pr-3 text-xs text-muted">{r.source}</td>
              <td className="text-right">
                {canEdit ? (
                  <Button
                    variant="ghost" size="icon" aria-label={`Delete ${r.captured_on}`} disabled={pending}
                    onClick={() => startTransition(async () => { const res = await deleteSnapshot(r.id); if (!res.ok) toast.error(res.error); })}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
