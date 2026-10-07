import type { MetricSnapshotRow } from "@/types/database";
import { summarize, toSeries } from "./series";

export interface Insight {
  id: string;
  tone: "positive" | "warning" | "neutral";
  text: string;
}

// Rough healthy-game reference points for Roblox retention. They guide the wording only; they are not guarantees.
const BENCH = { d1: 25, d7: 8, d30: 3 } as const;

/** Rule-based observations so the dashboard explains trends without spending AI credits. */
export function buildInsights(rows: MetricSnapshotRow[]): Insight[] {
  const out: Insight[] = [];
  if (rows.length === 0) return out;

  const players = summarize(toSeries(rows, "active_players"));
  if (players.changePct !== null) {
    out.push(
      players.changePct >= 10
        ? { id: "players-up", tone: "positive", text: `Active players are up ${players.changePct.toFixed(0)}% over this period.` }
        : players.changePct <= -10
          ? { id: "players-down", tone: "warning", text: `Active players are down ${Math.abs(players.changePct).toFixed(0)}% over this period. Check recent updates and traffic sources.` }
          : { id: "players-flat", tone: "neutral", text: "Active players are steady. Growth will need a new acquisition channel or update." },
    );
  }

  const d1 = summarize(toSeries(rows, "retention_d1")).latest;
  const d7 = summarize(toSeries(rows, "retention_d7")).latest;
  const d30 = summarize(toSeries(rows, "retention_d30")).latest;
  if (d1 !== null) {
    out.push(
      d1 < BENCH.d1
        ? { id: "d1-low", tone: "warning", text: `Day 1 retention is ${d1}%, below the ~${BENCH.d1}% reference. The first five minutes are the usual culprit: tutorial, first reward, clarity of goal.` }
        : { id: "d1-ok", tone: "positive", text: `Day 1 retention is ${d1}%, in a healthy range.` },
    );
  }
  if (d7 !== null && d7 < BENCH.d7) {
    out.push({ id: "d7-low", tone: "warning", text: `Day 7 retention is ${d7}%. Add a reason to return within the first week: daily rewards, unlockable zones, or events.` });
  }
  if (d30 !== null && d30 < BENCH.d30) {
    out.push({ id: "d30-low", tone: "warning", text: `Day 30 retention is ${d30}%. Long-term progression and social ties drive this number.` });
  }

  const revenue = toSeries(rows, "robux_revenue");
  const r = summarize(revenue);
  if (r.changePct !== null && r.changePct <= -15) {
    out.push({ id: "rev-down", tone: "warning", text: "Robux revenue is trending down. Review gamepass visibility and recent economy changes." });
  }
  return out;
}
