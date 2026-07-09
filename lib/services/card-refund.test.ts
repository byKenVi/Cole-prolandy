import { describe, it, expect, beforeEach, vi } from "vitest";
import { WalletTransactionType } from "@prisma/client";
import { createFakeDb, type FakeDb } from "@/lib/domain/__fixtures__/fakeDb";
import type { RefundToCardParams, RefundToCardResult } from "@/lib/integrations/payments";

// Mock prisma (in-memory fake) + the payments provider. The mock refund echoes
// back the requested amount as the refunded amount, like a successful Stripe
// refund of exactly what we asked for.
const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  refund: null as unknown as (args: RefundToCardParams) => Promise<RefundToCardResult>,
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
  payments: { refundToCard: (args: RefundToCardParams) => h.refund(args) },
}));

import { refundTopUpToCard, returnRealBalanceToCard } from "./card-refund";

const okRefund =
  (): ((args: RefundToCardParams) => Promise<RefundToCardResult>) =>
  async (args) => ({
    ok: true,
    mocked: true,
    refundId: `re_${Math.random().toString(36).slice(2, 8)}`,
    refundedCents: args.amountCents, // echo exactly what we requested
    status: "succeeded",
  });

function seed(opts: {
  balanceCents: number;
  topups?: { id: string; amountCents: number; pi: string; createdAt?: Date }[];
  promoCents?: number;
}) {
  const db = createFakeDb();
  h.db = db;
  db.contractor.seed([{ id: "c1", walletBalanceCents: opts.balanceCents, contractorTypeId: "ct1" }]);
  (opts.topups ?? []).forEach((t, i) =>
    db.walletTransaction.seed([
      {
        id: t.id,
        contractorId: "c1",
        amountCents: t.amountCents,
        type: WalletTransactionType.TOPUP,
        stripePaymentIntentId: t.pi,
        createdAt: t.createdAt ?? new Date(2026, 0, 1 + i),
      },
    ]),
  );
  if (opts.promoCents) {
    db.walletTransaction.seed([
      {
        id: "promo1",
        contractorId: "c1",
        amountCents: opts.promoCents,
        type: WalletTransactionType.PROMO_CREDIT,
        createdAt: new Date(2026, 0, 1),
      },
    ]);
  }
  return db;
}

const cardRefundCount = (db: FakeDb) =>
  db.walletTransaction.rows.filter((t) => t.type === WalletTransactionType.CARD_REFUND).length;

describe("refundTopUpToCard — real refund DEBITS the wallet (money safety)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.refund = okRefund();
  });

  it("debits the wallet exactly ONCE and blocks a double refund of the same top-up", async () => {
    const db = seed({ balanceCents: 5000, topups: [{ id: "tx1", amountCents: 5000, pi: "pi_1" }] });

    const first = await refundTopUpToCard({ contractorId: "c1", walletTransactionId: "tx1" });
    expect(first).toMatchObject({ ok: true, refundedCents: 5000, newBalanceCents: 0 });
    expect(db.contractor.rows[0].walletBalanceCents).toBe(0);
    expect(cardRefundCount(db)).toBe(1);

    // Second attempt is rejected (deterministic idempotency key) — no double debit.
    const second = await refundTopUpToCard({ contractorId: "c1", walletTransactionId: "tx1" });
    expect(second).toMatchObject({ ok: false, code: "already_refunded" });
    expect(db.contractor.rows[0].walletBalanceCents).toBe(0);
    expect(cardRefundCount(db)).toBe(1);
  });

  it("caps the refund at the current REAL balance and NEVER goes negative", async () => {
    // Contractor topped up $50 but has spent down to $30 of real balance.
    const db = seed({ balanceCents: 3000, topups: [{ id: "tx1", amountCents: 5000, pi: "pi_1" }] });

    const res = await refundTopUpToCard({ contractorId: "c1", walletTransactionId: "tx1" });

    expect(res).toMatchObject({ ok: true, refundedCents: 3000, newBalanceCents: 0 });
    expect(db.contractor.rows[0].walletBalanceCents).toBe(0);
    expect(db.contractor.rows[0].walletBalanceCents).toBeGreaterThanOrEqual(0);
  });

  it("REJECTS refunding promo credit to a card (no real balance)", async () => {
    // Balance is entirely promotional — nothing real to send back to a card.
    const db = seed({
      balanceCents: 2000,
      promoCents: 2000,
      topups: [], // no real card top-up
    });

    const res = await returnRealBalanceToCard({ contractorId: "c1" });

    expect(res).toMatchObject({ ok: false, code: "no_real_balance" });
    expect(db.contractor.rows[0].walletBalanceCents).toBe(2000); // untouched
    expect(cardRefundCount(db)).toBe(0);
  });

  it("returns only the REAL balance to card, leaving promo credit untouched", async () => {
    // $50 real top-up + $20 promo, balance $70. Only the $50 real is refundable.
    const db = seed({
      balanceCents: 7000,
      promoCents: 2000,
      topups: [{ id: "tx1", amountCents: 5000, pi: "pi_1" }],
    });

    const res = await returnRealBalanceToCard({ contractorId: "c1" });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.refundedCents).toBe(5000);
    // 7000 - 5000 = 2000 promo remains; never negative.
    expect(db.contractor.rows[0].walletBalanceCents).toBe(2000);
    expect(cardRefundCount(db)).toBe(1);
  });

  it("does not move the wallet when Stripe rejects the refund", async () => {
    const db = seed({ balanceCents: 5000, topups: [{ id: "tx1", amountCents: 5000, pi: "pi_1" }] });
    h.refund = async () => ({
      ok: false,
      mocked: false,
      reason: "not_refundable",
      message: "Outside Stripe's refund window.",
    });

    const res = await refundTopUpToCard({ contractorId: "c1", walletTransactionId: "tx1" });

    expect(res).toMatchObject({ ok: false, code: "not_refundable" });
    expect(db.contractor.rows[0].walletBalanceCents).toBe(5000); // unchanged
    expect(cardRefundCount(db)).toBe(0);
  });
});
