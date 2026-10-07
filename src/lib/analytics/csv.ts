import { z } from "zod";

export interface MetricRowInput {
  captured_on: string;
  active_players: number | null;
  retention_d1: number | null;
  retention_d7: number | null;
  retention_d30: number | null;
  robux_revenue: number | null;
  visits: number | null;
  avg_session_minutes: number | null;
  conversion_rate: number | null;
}

export interface CsvParseResult {
  rows: MetricRowInput[];
  errors: string[];
}

/** Header aliases cover the column names common in Roblox Creator Dashboard exports. */
const ALIASES: Record<keyof MetricRowInput, string[]> = {
  captured_on: ["date", "day", "captured_on"],
  active_players: ["active_players", "daily_active_users", "dau", "players", "ccu"],
  retention_d1: ["d1", "d1_retention", "day1_retention", "retention_d1"],
  retention_d7: ["d7", "d7_retention", "day7_retention", "retention_d7"],
  retention_d30: ["d30", "d30_retention", "day30_retention", "retention_d30"],
  robux_revenue: ["robux", "robux_revenue", "revenue", "revenue_robux"],
  visits: ["visits", "total_visits"],
  avg_session_minutes: ["avg_session_minutes", "average_session_minutes", "session_length", "avg_session"],
  conversion_rate: ["conversion", "conversion_rate", "purchase_conversion"],
};

export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[%()]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function parseNumber(raw: string | undefined, opts: { int?: boolean; max?: number }): number | null | "invalid" {
  if (raw === undefined || raw.trim() === "") return null;
  const n = Number(raw.replace(/[,%\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return "invalid";
  if (opts.max !== undefined && n > opts.max) return "invalid";
  return opts.int ? Math.round(n) : n;
}

export const MAX_CSV_ROWS = 1000;

export function parseMetricsCsv(text: string): CsvParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errors: string[] = [];
  if (lines.length < 2) return { rows: [], errors: ["The file needs a header row and at least one data row."] };
  if (lines.length - 1 > MAX_CSV_ROWS) return { rows: [], errors: [`Too many rows (max ${MAX_CSV_ROWS}).`] };

  const headers = splitCsvLine(lines[0] ?? "").map(normalizeHeader);
  const index = {} as Record<keyof MetricRowInput, number>;
  for (const key of Object.keys(ALIASES) as (keyof MetricRowInput)[]) {
    index[key] = headers.findIndex((h) => ALIASES[key].includes(h));
  }
  if (index.captured_on < 0) return { rows: [], errors: ['Missing a "date" column.'] };
  const hasMetric = (Object.keys(index) as (keyof MetricRowInput)[]).some((k) => k !== "captured_on" && index[k] >= 0);
  if (!hasMetric) return { rows: [], errors: ["No recognised metric columns (active_players, d1, d7, d30, robux…)."] };

  const rows: MetricRowInput[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i] ?? "");
    const cell = (k: keyof MetricRowInput) => (index[k] >= 0 ? cells[index[k]] : undefined);
    const line = i + 1;

    const date = dateSchema.safeParse(cell("captured_on")?.trim());
    if (!date.success || Number.isNaN(Date.parse(date.data))) {
      errors.push(`Line ${line}: date must be YYYY-MM-DD.`);
      continue;
    }
    if (seen.has(date.data)) {
      errors.push(`Line ${line}: duplicate date ${date.data}.`);
      continue;
    }

    const parsed = {
      active_players: parseNumber(cell("active_players"), { int: true }),
      retention_d1: parseNumber(cell("retention_d1"), { max: 100 }),
      retention_d7: parseNumber(cell("retention_d7"), { max: 100 }),
      retention_d30: parseNumber(cell("retention_d30"), { max: 100 }),
      robux_revenue: parseNumber(cell("robux_revenue"), { int: true }),
      visits: parseNumber(cell("visits"), { int: true }),
      avg_session_minutes: parseNumber(cell("avg_session_minutes"), {}),
      conversion_rate: parseNumber(cell("conversion_rate"), { max: 100 }),
    };
    const bad = Object.entries(parsed).find(([, v]) => v === "invalid");
    if (bad) {
      errors.push(`Line ${line}: invalid value for ${bad[0]}.`);
      continue;
    }
    seen.add(date.data);
    rows.push({ captured_on: date.data, ...(parsed as Omit<MetricRowInput, "captured_on">) });
  }
  return { rows, errors };
}
