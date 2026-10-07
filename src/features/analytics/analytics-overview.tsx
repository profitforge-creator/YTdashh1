import { summarize, toSeries, totalRevenue } from "@/lib/analytics/series";
import { formatCompact } from "@/lib/utils";
import type { MetricSnapshotRow } from "@/types/database";
import { MetricCard } from "./metric-card";


const pct = (n: number | null) => (n === null ? "–" : `${n.toFixed(1)}%`);

/** The three priority metrics, shared by Home and the Analytics page. */
export function PriorityMetrics({ rows }: { rows: MetricSnapshotRow[] }) {
  const players = toSeries(rows, "active_players");
  const d1 = toSeries(rows, "retention_d1");
  const d7 = toSeries(rows, "retention_d7");
  const d30 = toSeries(rows, "retention_d30");
  const revenue = toSeries(rows, "robux_revenue");
  const p = summarize(players);
  const r = summarize(revenue);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard label="Active players" value={p.latest === null ? "–" : formatCompact(p.latest)} series={players} tone="active" changePct={p.changePct} />
      <MetricCard
        label="Retention (D1 · D7 · D30)"
        value={pct(summarize(d1).latest)}
        hint={`D7 ${pct(summarize(d7).latest)} · D30 ${pct(summarize(d30).latest)}`}
        series={d1.length ? d1 : d7.length ? d7 : d30}
        tone="retention"
        changePct={summarize(d1).changePct}
      />
      <MetricCard
        label="Robux revenue (private)"
        value={revenue.length ? `R$ ${formatCompact(totalRevenue(revenue))}` : "–"}
        hint="Total for the period shown"
        series={revenue}
        tone="positive"
        changePct={r.changePct}
      />
    </div>
  );
}
