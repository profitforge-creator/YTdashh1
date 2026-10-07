import type { MetricSnapshotRow } from "@/types/database";

export interface SeriesPoint {
  date: string;
  value: number;
}

export type MetricKey = "active_players" | "retention_d1" | "retention_d7" | "retention_d30" | "robux_revenue";

export function toSeries(rows: MetricSnapshotRow[], key: MetricKey): SeriesPoint[] {
  return rows
    .filter((r) => r[key] !== null)
    .map((r) => ({ date: r.captured_on, value: Number(r[key]) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface Summary {
  latest: number | null;
  previous: number | null;
  /** Percent change from the first to last point of the window; null if not computable. */
  changePct: number | null;
}

export function summarize(series: SeriesPoint[]): Summary {
  const latest = series.at(-1)?.value ?? null;
  const previous = series.length > 1 ? (series.at(-2)?.value ?? null) : null;
  const first = series[0]?.value ?? null;
  const changePct =
    latest !== null && first !== null && series.length > 1 && first !== 0 ? ((latest - first) / first) * 100 : null;
  return { latest, previous, changePct };
}

/** Sums daily Robux revenue across the window. */
export function totalRevenue(series: SeriesPoint[]): number {
  return series.reduce((sum, p) => sum + p.value, 0);
}

/** Builds an SVG path for a compact line chart, scaled into width x height with padding. */
export function buildPaths(
  series: SeriesPoint[],
  width: number,
  height: number,
  pad = 4,
): { line: string; area: string } | null {
  if (series.length === 0) return null;
  const values = series.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = series.length > 1 ? (width - pad * 2) / (series.length - 1) : 0;
  const pts = series.map((p, i) => {
    const x = series.length > 1 ? pad + i * stepX : width / 2;
    const y = height - pad - ((p.value - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (!first || !last) return null;
  const area = `${line} L${last[0].toFixed(1)},${height} L${first[0].toFixed(1)},${height} Z`;
  return { line, area };
}
