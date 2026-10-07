import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { buildPaths, type SeriesPoint } from "@/lib/analytics/series";
import { cn } from "@/lib/utils";

export type MetricTone = "active" | "retention" | "positive";

const TONE: Record<MetricTone, string> = {
  active: "var(--color-active)",
  retention: "var(--color-retention)",
  positive: "var(--color-positive)",
};

const W = 300;
const H = 72;

function rangeLabel(series: SeriesPoint[]): { start: string; end: string } {
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { start: series[0] ? fmt(series[0].date) : "", end: series.at(-1) ? fmt(series.at(-1)!.date) : "" };
}

/** Large figure, thin line, faint area fill, compact range labels. */
export function MetricCard({
  label, value, series, tone, changePct, hint,
}: {
  label: string;
  value: string;
  series: SeriesPoint[];
  tone: MetricTone;
  changePct: number | null;
  hint?: string;
}) {
  const color = TONE[tone];
  const paths = buildPaths(series, W, H);
  const gradientId = `fill-${tone}-${label.replace(/\W/g, "")}`;
  const range = rangeLabel(series);
  const up = (changePct ?? 0) >= 0;

  return (
    <div className="rounded-[var(--radius-card)] border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {changePct !== null ? (
          <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", up ? "text-positive" : "text-danger")}>
            {up ? <ArrowUpRight className="h-3 w-3" aria-hidden /> : <ArrowDownRight className="h-3 w-3" aria-hidden />}
            {Math.abs(changePct).toFixed(1)}%
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="text-[11px] text-faint">{hint}</p> : null}
      {paths ? (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="mt-3 h-16 w-full"
            role="img"
            aria-label={`${label} from ${range.start} to ${range.end}`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={paths.area} fill={`url(#${gradientId})`} />
            <path d={paths.line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>
          <div className="mt-1 flex justify-between text-[10px] text-faint">
            <span>{range.start}</span>
            <span>{range.end}</span>
          </div>
        </>
      ) : (
        <p className="mt-6 text-xs text-faint">No data yet</p>
      )}
    </div>
  );
}
