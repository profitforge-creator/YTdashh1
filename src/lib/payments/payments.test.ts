import { describe, expect, it } from "vitest";
import { paymentState, reviewTimeLeft } from "./states";
import { feeFor } from "./provider";

describe("paymentState", () => {
  it("maps contract statuses to buyer-visible payment states", () => {
    expect(paymentState("funded")).toBe("pending");
    expect(paymentState("submitted")).toBe("pending");
    expect(paymentState("revision_requested")).toBe("pending");
    expect(paymentState("approved")).toBe("available");
    expect(paymentState("disputed")).toBe("disputed");
    expect(paymentState("refunded")).toBe("refunded");
  });
});

describe("reviewTimeLeft", () => {
  const now = Date.parse("2026-10-07T00:00:00Z");
  it("formats the countdown", () => {
    expect(reviewTimeLeft("2026-10-14T00:00:00Z", now)).toBe("7d 0h left to review");
    expect(reviewTimeLeft("2026-10-07T05:00:00Z", now)).toBe("5h left to review");
    expect(reviewTimeLeft("2026-10-06T00:00:00Z", now)).toBe("Review window ended");
    expect(reviewTimeLeft(null, now)).toBeNull();
  });
});

describe("feeFor", () => {
  it("takes a flat 10%, rounded down, regardless of who pays", () => {
    expect(feeFor(10_000)).toBe(1_000);
    expect(feeFor(999)).toBe(99);
  });
});
