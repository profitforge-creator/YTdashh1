import { describe, expect, it } from "vitest";
import type { NotificationRow } from "@/types/database";
import { groupNotifications } from "./group";

const n = (id: string, minutesAgo: number, over: Partial<NotificationRow> = {}): NotificationRow => ({
  id, user_id: "u", kind: "comment", title: `t${id}`, body: "", href: null, immediate: false, group_key: "g",
  read_at: null, created_at: new Date(Date.parse("2026-10-07T12:00:00Z") - minutesAgo * 60_000).toISOString(), ...over,
});

describe("groupNotifications", () => {
  it("groups same-key events in the window", () => {
    const g = groupNotifications([n("1", 1), n("2", 5), n("3", 10)]);
    expect(g).toHaveLength(1);
    expect(g[0]?.items).toHaveLength(3);
    expect(g[0]?.title).toMatch(/^3 new/);
  });

  it("never groups immediate events", () => {
    const g = groupNotifications([n("1", 1, { immediate: true }), n("2", 2, { immediate: true })]);
    expect(g).toHaveLength(2);
  });

  it("splits groups outside the window", () => {
    const g = groupNotifications([n("1", 1), n("2", 60 * 12)]);
    expect(g).toHaveLength(2);
  });

  it("marks a group unread if any item is unread", () => {
    const g = groupNotifications([n("1", 1, { read_at: "x" }), n("2", 2)]);
    expect(g[0]?.unread).toBe(true);
  });
});
