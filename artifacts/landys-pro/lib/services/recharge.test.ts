import { describe, it, expect, beforeEach, vi } from "vitest";
import { WalletTransactionType } from "@prisma/client";
import { createFakeDb, type FakeDb } from "@/lib/domain/__fixtures__/fakeDb";
import type { ChargeSavedCardResult } from "@/lib/integrations/payments";

// Mock prisma (in-memory fake) and the payments provider so we can drive the
// off-session charge result and assert the wallet is credited via the SAME
// webhook credit path (creditTopUp), exactly once, idempotently.
const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  charge: null as unknown as (args: unknown) => Promise<ChargeSavedCardResult>,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({} as Record<string, unknown>, {
    get(_t, prop: string) {
      const target = h.db as unknown as Record<string, unknown>;
      const val = target[prop];
      return typeof val === "function" ? (val as (...a: unknown[]) => unknown).bind(h.db) : val;
    },
  }),
}));

vi.mock("@/lib/integrations/payments", () => ({
  payments: { chargeSavedCard: (args: unknown) => h.charge(args) },
}));

import { chargeContractorSavedCard } from "./recharge";

function seedContractor(over: Record<string, unknown> = {}) {
  const db = createFakeDb();
  h.db = db;
  db.contractor.seed([
    {
      id: "c1",
      walletBalanceCents: 0,
      contractorTypeId: "ct1",
      stripeCustomerId: "cus_1",
      stripeDefaultPaymentMethodId: "pm_1",
      ...over,
    },
  ]);
  return db;
}

const topupCount = (db: FakeDb) =>
  db.walletTransaction.rows.filter((t) => t.type === WalletTransactionType.TOPUP).length;

const actor = { type: "contractor" as const, id: "c1" };

describe("chargeContractorSavedCard — off-session recharge (money safety)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("credits the wallet exactly ONCE via the webhook credit path, and is idempotent on a duplicate charge", async () => {
    const db = seedContractor();
    // A FIXED payment-intent id so a repeat charge is caught by the unique
    // stripePaymentIntentId guard — exactly like a duplicate webhook delivery.
    h.charge = async () => ({
      ok: true,
      mocked: true,
      paymentIntentId: "pi_fixed",
      paymentMethodId: "pm_1",
      status: "succeeded",
    });

    const first = await chargeContractorSavedCard({ contractorId: "c1", amountCents: 5000, actor });
    const second = await chargeContractorSavedCard({ contractorId: "c1", amountCents: 5000, actor });

    expect(first).toMatchObject({ ok: true, status: "credited", newBalanceCents: 5000 });
    expect(second).toMatchObject({ ok: true, status: "duplicate" });
    // Credited once, not twice.
    expect(db.contractor.rows[0].walletBalanceCents).toBe(5000);
    expect(topupCount(db)).toBe(1);
  });

  it("returns a graceful fallback (no crash, no wallet change) when there is NO saved card", async () => {
    const db = seedContractor({ stripeDefaultPaymentMethodId: null });
    h.charge = async () => {
      throw new Error("should not be called without a saved card");
    };

    const res = await chargeContractorSavedCard({ contractorId: "c1", amountCents: 5000, actor });

    expect(res).toMatchObject({ ok: false, code: "no_saved_card", fallbackToCheckout: true });
    expect(db.contractor.rows[0].walletBalanceCents).toBe(0);
    expect(topupCount(db)).toBe(0);
  });

  it("returns a graceful fallback when the card needs the cardholder present (authentication_required)", async () => {
    const db = seedContractor();
    h.charge = async () => ({
      ok: false,
      mocked: false,
      reason: "authentication_required",
      message: "This card needs verification.",
    });

    const res = await chargeContractorSavedCard({ contractorId: "c1", amountCents: 5000, actor });

    expect(res).toMatchObject({ ok: false, code: "authentication_required", fallbackToCheckout: true });
    // Never credited — the webhook path is the only crediting path and it never ran.
    expect(db.contractor.rows[0].walletBalanceCents).toBe(0);
    expect(topupCount(db)).toBe(0);
  });

  it("rejects an invalid (below-minimum) amount without touching the wallet", async () => {
    const db = seedContractor();
    h.charge = async () => {
      throw new Error("should not be called for an invalid amount");
    };

    const res = await chargeContractorSavedCard({ contractorId: "c1", amountCents: 500, actor });

    expect(res).toMatchObject({ ok: false, code: "invalid_amount" });
    expect(db.contractor.rows[0].walletBalanceCents).toBe(0);
  });
});
