import { z } from "zod";

const optionalInt = z.union([z.coerce.number().int().min(0), z.literal("").transform(() => null), z.null()]).nullable();
const optionalPct = z.union([z.coerce.number().min(0).max(100), z.literal("").transform(() => null), z.null()]).nullable();
const optionalNum = z.union([z.coerce.number().min(0), z.literal("").transform(() => null), z.null()]).nullable();

export const snapshotSchema = z.object({
  projectId: z.string().uuid(),
  captured_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date."),
  active_players: optionalInt,
  retention_d1: optionalPct,
  retention_d7: optionalPct,
  retention_d30: optionalPct,
  robux_revenue: optionalInt,
  visits: optionalInt,
  avg_session_minutes: optionalNum,
  conversion_rate: optionalPct,
});

export type SnapshotInput = z.infer<typeof snapshotSchema>;
