import { describe, it, expect, beforeEach, vi } from "vitest";
import { WalletTransactionType } from "@prisma/client";
import { createFakeDb, type FakeDb } from "@/lib/domain/__fixtures__/fakeDb";

// Mock the prisma singleton so creditTopUp runs against a fresh in-memory fake.
const h = vi.hoisted(() => ({ db: null as unknown as FakeDb }));
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({} as Record<string, unknown>, {
    get(_t, prop: string) {
      const target = h.db as unknown as Record<string, unknown>;
      const val = target[prop];
      return typeof val === "function" ? (val as (...a: unknown[]) => unknown).bind(h.db) : val;
    },
  }),
}));

import Stripe from "stripe";
import { SuccessFeeStatus } from "@prisma/client";
import {
  creditTopUp,
  parseTopUpEvent,
  constructStripeEvent,
  parseSuccessFeeEvent,
  confirmSuccessFeePayment,
  type TopUpEvent,
  type SuccessFeePaymentEvent,
} from "./stripe-webhook";

function seedContractor(balance = 0) {
  const db = createFakeDb();
  h.db = db;
  db.contractor.seed([{ id: "c1", walletBalanceCents: balance, contractorTypeId: "ct1" }]);
  return db;
}

const topUpEvent = (over: Partial<TopUpEvent> = {}): TopUpEvent => ({
  eventId: "evt_1",
  eventType: "checkout.session.completed",
  contractorId: "c1",
  amountCents: 5000,
  paymentIntentId: "pi_1",
  ...over,
});

const chargeCount = (db: FakeDb) =>
  db.walletTransaction.rows.filter((t) => t.type === WalletTransactionType.TOPUP).length;

describe("creditTopUp — webhook idempotency (money safety)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("credits the wallet exactly once on a success event", async () => {
    const db = seedContractor(0);

    const res = await creditTopUp(topUpEvent());

    expect(res.status).toBe("credited");
    expect(db.contractor.rows[0].walletBalanceCents).toBe(5000);
    expect(chargeCount(db)).toBe(1);
    expect(db.processedStripeEvent.rows).toHaveLength(1);
  });

  it("a DUPLICATE delivery of the same event id credits ZERO additional", async () => {
    const db = seedContractor(0);

    const first = await creditTopUp(topUpEvent());
    const second = await creditTopUp(topUpEvent()); // identical event id

    expect(first.status).toBe("credited");
    expect(second.status).toBe("duplicate");
    expect(db.contractor.rows[0].walletBalanceCents).toBe(5000); // not 10000
    expect(chargeCount(db)).toBe(1);
    expect(db.processedStripeEvent.rows).toHaveLength(1);
  });

  it("refuses to credit at all when the payment intent is missing", async () => {
    // The payment intent is the only guard shared by the two crediting paths:
    // the webhook and the post-checkout verification derive different
    // ProcessedStripeEvent ids for one payment, so they never collide there.
    // NULLs are distinct in a unique index, so a null payment intent would let
    // both paths credit the same money. Refusing is the safe failure.
    const db = seedContractor(0);

    const res = await creditTopUp(topUpEvent({ paymentIntentId: null }));

    expect(res.status).toBe("ignored");
    expect(db.contractor.rows[0].walletBalanceCents).toBe(0);
    expect(chargeCount(db)).toBe(0);
    expect(db.processedStripeEvent.rows).toHaveLength(0);
  });

  it("credits once when the two crediting paths race on the same payment", async () => {
    // Verification-on-return and the webhook, in either order: distinct event
    // ids, same payment intent. Only the unique stripePaymentIntentId stops the
    // second one, which is why a null intent must never reach here.
    const db = seedContractor(0);

    const verified = await creditTopUp(
      topUpEvent({ eventId: "checkout_session_verified:cs_1", eventType: "checkout.session.verified" }),
    );
    const webhook = await creditTopUp(topUpEvent({ eventId: "evt_live" }));

    expect(verified.status).toBe("credited");
    expect(webhook.status).toBe("duplicate");
    expect(db.contractor.rows[0].walletBalanceCents).toBe(5000); // not 10000
    expect(chargeCount(db)).toBe(1);
  });

  it("a different event id for the SAME payment intent still credits only once", async () => {
    // checkout.session.completed + payment_intent.succeeded fire for one payment.
    const db = seedContractor(0);

    const a = await creditTopUp(topUpEvent({ eventId: "evt_session" }));
    const b = await creditTopUp(
      topUpEvent({ eventId: "evt_pi", eventType: "payment_intent.succeeded" }),
    );

    expect(a.status).toBe("credited");
    expect(b.status).toBe("duplicate"); // blocked by unique stripePaymentIntentId
    expect(db.contractor.rows[0].walletBalanceCents).toBe(5000);
    expect(chargeCount(db)).toBe(1);
  });

  it("ignores events missing a contractor id or a positive amount", async () => {
    const db = seedContractor(0);

    expect((await creditTopUp(topUpEvent({ contractorId: "" }))).status).toBe("ignored");
    expect((await creditTopUp(topUpEvent({ amountCents: 0 }))).status).toBe("ignored");
    expect(chargeCount(db)).toBe(0);
  });
});

describe("parseTopUpEvent", () => {
  it("maps checkout.session.completed", () => {
    const parsed = parseTopUpEvent({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { contractorId: "c1" },
          amount_total: 5000,
          payment_intent: "pi_abc",
        },
      },
    } as unknown as Stripe.Event);

    expect(parsed).toEqual({
      eventId: "evt_1",
      eventType: "checkout.session.completed",
      contractorId: "c1",
      amountCents: 5000,
      paymentIntentId: "pi_abc",
      paymentMethodId: null,
      stripeCustomerId: null,
    });
  });

  it("maps payment_intent.succeeded", () => {
    const parsed = parseTopUpEvent({
      id: "evt_2",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_xyz", metadata: { contractorId: "c9" }, amount_received: 25000 } },
    } as unknown as Stripe.Event);

    expect(parsed).toMatchObject({
      contractorId: "c9",
      amountCents: 25000,
      paymentIntentId: "pi_xyz",
    });
  });

  it("returns null for unrelated event types", () => {
    expect(
      parseTopUpEvent({ id: "evt_3", type: "invoice.paid", data: { object: {} } } as unknown as Stripe.Event),
    ).toBeNull();
  });

  it("never treats success_fee PaymentIntents as wallet top-ups", () => {
    expect(
      parseTopUpEvent({
        id: "evt_sf_pi",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_sf",
            metadata: {
              purpose: "success_fee",
              leadMatchId: "m1",
              contractorId: "c1",
            },
            amount_received: 40_000,
          },
        },
      } as unknown as Stripe.Event),
    ).toBeNull();
  });

  it("never treats success_fee checkout sessions as wallet top-ups", () => {
    expect(
      parseTopUpEvent({
        id: "evt_sf_cs",
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "payment",
            metadata: {
              purpose: "success_fee",
              leadMatchId: "m1",
              contractorId: "c1",
            },
            amount_total: 40_000,
            payment_intent: "pi_sf",
          },
        },
      } as unknown as Stripe.Event),
    ).toBeNull();
  });
});

function seedDueSuccessFee(amountCents = 40_000) {
  const db = createFakeDb();
  h.db = db;
  db.successFee.seed([
    {
      id: "sf1",
      leadMatchId: "match1",
      status: SuccessFeeStatus.DUE,
      feeAmountCents: amountCents,
      rateBasisPoints: 500,
      finalContractValueCents: 800_000,
    },
  ]);
  return db;
}

const successFeeEvent = (over: Partial<SuccessFeePaymentEvent> = {}): SuccessFeePaymentEvent => ({
  eventId: "evt_sf_1",
  eventType: "checkout.session.completed",
  leadMatchId: "match1",
  contractorId: "c1",
  amountCents: 40_000,
  paymentIntentId: "pi_sf_1",
  ...over,
});

describe("confirmSuccessFeePayment — Stripe to PAID", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks a due success fee as PAID with audit trail", async () => {
    const db = seedDueSuccessFee();

    const res = await confirmSuccessFeePayment(successFeeEvent());

    expect(res.status).toBe("credited");
    expect(db.successFee.rows[0].status).toBe(SuccessFeeStatus.PAID);
    expect(db.successFee.rows[0].paymentMethod).toBe("stripe");
    expect(db.successFee.rows[0].stripePaymentIntentId).toBe("pi_sf_1");
    expect(db.auditLog.rows.some((r) => r.action === "SUCCESS_FEE_PAID")).toBe(true);
    expect(db.processedStripeEvent.rows).toHaveLength(1);
  });

  it("is idempotent for duplicate Stripe event delivery", async () => {
    const db = seedDueSuccessFee();

    const first = await confirmSuccessFeePayment(successFeeEvent());
    const second = await confirmSuccessFeePayment(successFeeEvent());

    expect(first.status).toBe("credited");
    expect(second.status).toBe("duplicate");
    expect(db.successFee.rows[0].status).toBe(SuccessFeeStatus.PAID);
    expect(db.processedStripeEvent.rows).toHaveLength(1);
  });
});

describe("parseSuccessFeeEvent", () => {
  it("maps checkout.session.completed for success_fee purpose", () => {
    const parsed = parseSuccessFeeEvent({
      id: "evt_sf",
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "payment",
          metadata: { purpose: "success_fee", leadMatchId: "m1", contractorId: "c1" },
          amount_total: 40_000,
          payment_intent: "pi_abc",
        },
      },
    } as unknown as Stripe.Event);

    expect(parsed).toEqual({
      eventId: "evt_sf",
      eventType: "checkout.session.completed",
      leadMatchId: "m1",
      contractorId: "c1",
      amountCents: 40_000,
      paymentIntentId: "pi_abc",
    });
  });

  it("returns null for unrelated checkout sessions", () => {
    expect(
      parseSuccessFeeEvent({
        id: "evt_x",
        type: "checkout.session.completed",
        data: { object: { mode: "payment", metadata: {}, amount_total: 1000 } },
      } as unknown as Stripe.Event),
    ).toBeNull();
  });
});

describe("constructStripeEvent — signature verification", () => {
  const secret = "whsec_testsecret";
  const stripe = new Stripe("sk_test_dummy");

  beforeEach(() => {
    process.env.STRIPE_MOCK = "false";
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = secret;
  });

  it("accepts a correctly signed payload", async () => {
    const payload = JSON.stringify({ id: "evt_ok", type: "checkout.session.completed", data: { object: {} } });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });

    const event = await constructStripeEvent(payload, header);
    expect(event.id).toBe("evt_ok");
  });

  it("rejects a forged / unsigned payload", async () => {
    const payload = JSON.stringify({ id: "evt_forged", type: "checkout.session.completed", data: { object: {} } });
    await expect(constructStripeEvent(payload, "t=1,v1=deadbeef")).rejects.toThrow();
  });

  it("rejects a payload signed with the wrong secret", async () => {
    const payload = JSON.stringify({ id: "evt_wrong", type: "checkout.session.completed", data: { object: {} } });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong" });
    await expect(constructStripeEvent(payload, header)).rejects.toThrow();
  });
});
