export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok(): ActionResult;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: string, fieldErrors?: Record<string, string>): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

/** Postgres exceptions raised by our SQL functions arrive as short codes; map them to human copy. */
const DB_MESSAGES: Record<string, string> = {
  insufficient_credits: "You're out of credits for this action. Upgrade your plan or buy a credit pack.",
  forbidden: "You don't have permission to do that.",
  not_found: "That item no longer exists.",
  concept_not_pending: "This concept was already decided.",
  concept_approval_required: "Approve a concept before generating the blueprint.",
  invalid_state: "That action isn't available in the current job state.",
  no_revisions_left: "No revisions left on this job.",
  evidence_required: "Add a note or evidence before submitting.",
  reason_required: "Explain the problem in at least 10 characters.",
  blocked: "You can't message this person.",
  request_pending: "Wait for them to accept your message request before sending more.",
  declined: "This conversation was declined.",
  already_funded: "This job is already funded.",
  no_open_slot: "All slots on this job are filled.",
  job_closed: "This job is no longer open.",
  application_not_pending: "That application was already handled.",
  dispute_not_open: "This dispute is already resolved.",
  invalid_split: "A split must give the worker part, but not all, of the payment.",
};

export function dbErrorMessage(err: { message?: string } | null | undefined, fallback = "Something went wrong. Try again."): string {
  const msg = err?.message ?? "";
  for (const [code, text] of Object.entries(DB_MESSAGES)) {
    if (msg.includes(code)) return text;
  }
  return fallback;
}
