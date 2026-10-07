import type { ContractStatus } from "@/types/database";

export type PaymentState = "awaiting" | "pending" | "available" | "disputed" | "refunded" | "split";

export function paymentState(status: ContractStatus): PaymentState {
  switch (status) {
    case "awaiting_funding": return "awaiting";
    case "funded":
    case "submitted":
    case "revision_requested": return "pending";
    case "approved": return "available";
    case "disputed": return "disputed";
    case "refunded": return "refunded";
    case "split": return "split";
  }
}

export const PAYMENT_LABELS: Record<PaymentState, { label: string; tone: "neutral" | "warning" | "positive" | "danger" | "active" }> = {
  awaiting: { label: "Awaiting funding", tone: "neutral" },
  pending: { label: "Protected · pending", tone: "warning" },
  available: { label: "Available", tone: "positive" },
  disputed: { label: "Disputed", tone: "danger" },
  refunded: { label: "Refunded", tone: "active" },
  split: { label: "Split resolution", tone: "active" },
};

export const STATUS_LABELS: Record<ContractStatus, string> = {
  awaiting_funding: "Awaiting funding",
  funded: "Funded · work can begin",
  submitted: "Submitted · in review",
  revision_requested: "Revision requested",
  approved: "Approved",
  disputed: "In dispute",
  refunded: "Refunded to buyer",
  split: "Resolved with a split",
};

export function reviewTimeLeft(deadline: string | null, now: number = Date.now()): string | null {
  if (!deadline) return null;
  const ms = Date.parse(deadline) - now;
  if (ms <= 0) return "Review window ended";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  return days > 0 ? `${days}d ${hours}h left to review` : `${hours}h left to review`;
}
