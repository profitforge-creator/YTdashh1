import type { NotificationRow } from "@/types/database";

export interface NotificationGroup {
  id: string;
  items: NotificationRow[];
  title: string;
  body: string;
  href: string | null;
  unread: boolean;
  latest: string;
}

const WINDOW_MS = 6 * 3_600_000;

/**
 * Collapses high-frequency events (likes, comments, applications…) that share a group key within a
 * window into one digest row. Payment and security events (immediate) are never grouped.
 */
export function groupNotifications(list: NotificationRow[]): NotificationGroup[] {
  const sorted = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const groups: NotificationGroup[] = [];
  const open = new Map<string, NotificationGroup>();

  for (const n of sorted) {
    const key = !n.immediate && n.group_key ? n.group_key : null;
    const existing = key ? open.get(key) : undefined;
    if (existing && Date.parse(existing.latest) - Date.parse(n.created_at) <= WINDOW_MS) {
      existing.items.push(n);
      existing.unread ||= n.read_at === null;
      continue;
    }
    const group: NotificationGroup = {
      id: n.id, items: [n], title: n.title, body: n.body, href: n.href, unread: n.read_at === null, latest: n.created_at,
    };
    groups.push(group);
    if (key) open.set(key, group);
  }

  for (const g of groups) {
    if (g.items.length > 1) {
      g.title = `${g.items.length} new: ${g.items[0]?.title ?? ""}`;
      g.body = "";
    }
  }
  return groups;
}
