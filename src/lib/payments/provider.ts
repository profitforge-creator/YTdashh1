import "server-only";
import { randomUUID } from "node:crypto";
import { getServerEnv } from "@/lib/env";

export interface ChargeInput {
  contractId: string;
  buyerId: string;
  amountCents: number;
}

export interface ChargeResult {
  provider: "test" | "stripe";
  ref: string;
}

/**
 * Seam for the marketplace payment provider. The beta ships only the test implementation; the Stripe
 * Connect implementation must be added here (and approved) before PAYMENTS_MODE can accept anything else.
 */
export interface PaymentProvider {
  readonly name: ChargeResult["provider"];
  charge(input: ChargeInput): Promise<ChargeResult>;
}

class TestPaymentProvider implements PaymentProvider {
  readonly name = "test" as const;
  async charge(input: ChargeInput): Promise<ChargeResult> {
    if (input.amountCents <= 0) throw new Error("Amount must be positive");
    // No network call and no money moves; the ref is unique so the DB can enforce one charge per intent.
    return { provider: "test", ref: `test_pi_${randomUUID()}` };
  }
}

export function getPaymentProvider(): PaymentProvider {
  // getServerEnv() rejects any PAYMENTS_MODE except "test" for the October beta.
  getServerEnv();
  return new TestPaymentProvider();
}

/** 10% platform fee, applied identically to every account. Rank never changes it. */
export const PLATFORM_FEE_BPS = 1000;

export function feeFor(amountCents: number): number {
  return Math.floor((amountCents * PLATFORM_FEE_BPS) / 10_000);
}
