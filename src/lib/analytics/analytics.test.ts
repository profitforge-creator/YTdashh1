import { describe, expect, it } from "vitest";
import { parseMetricsCsv, splitCsvLine } from "./csv";
import { buildPaths, summarize } from "./series";

describe("splitCsvLine", () => {
  it("handles quoted commas and escaped quotes", () => {
    expect(splitCsvLine('a,"b,c","say ""hi"""')).toEqual(["a", "b,c", 'say "hi"']);
  });
});

describe("parseMetricsCsv", () => {
  it("maps Roblox-style headers", () => {
    const csv = "Date,DAU,D1 Retention %,Robux\n2026-10-01,1200,24.5,9000\n2026-10-02,1500,26,11000";
    const { rows, errors } = parseMetricsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ captured_on: "2026-10-01", active_players: 1200, retention_d1: 24.5, robux_revenue: 9000 });
  });

  it("rejects bad dates, out-of-range percentages and duplicates per line", () => {
    const csv = "date,d1,dau\nnot-a-date,10,5\n2026-10-01,150,5\n2026-10-02,10,5\n2026-10-02,11,6";
    const { rows, errors } = parseMetricsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(3);
  });

  it("requires a date column and a metric column", () => {
    expect(parseMetricsCsv("dau\n5").errors[0]).toMatch(/date/);
    expect(parseMetricsCsv("date\n2026-10-01").errors[0]).toMatch(/metric/);
  });

  it("rejects negative numbers", () => {
    expect(parseMetricsCsv("date,dau\n2026-10-01,-5").rows).toHaveLength(0);
  });
});

describe("series helpers", () => {
  it("summarizes change across the window", () => {
    const s = summarize([{ date: "a", value: 100 }, { date: "b", value: 150 }]);
    expect(s.latest).toBe(150);
    expect(s.changePct).toBeCloseTo(50);
  });

  it("returns null change for a single point or zero baseline", () => {
    expect(summarize([{ date: "a", value: 5 }]).changePct).toBeNull();
    expect(summarize([{ date: "a", value: 0 }, { date: "b", value: 5 }]).changePct).toBeNull();
  });

  it("builds a closed area path", () => {
    const p = buildPaths([{ date: "a", value: 1 }, { date: "b", value: 3 }], 100, 50);
    expect(p?.area.endsWith("Z")).toBe(true);
    expect(buildPaths([], 100, 50)).toBeNull();
  });
});
