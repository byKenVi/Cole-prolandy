/**
 * Payments interface (wallet top-ups). Real Stripe drops in behind this same
 * interface with zero call-site changes. Toggle with STRIPE_MOCK env.
 *
 * MOCK is the default. Real Stripe activates ONLY when STRIPE_MOCK=false.
 * In real mode, the wallet is credited exclusively by the signature-verified
 * webhook (see app/api/stripe/webhook) — never by the browser success redirect.
 */
import type Stripe from "stripe";
export type CreateTopUpParams = {
  contractorId: string;
  amountCents: number;
  /** Existing Stripe customer id, if the contractor already has one. */
  stripeCustomerId?: string | null;
  /** Used to create the Stripe customer on first top-up. */
  contractorEmail?: string | null;
  contractorName?: string | null;
  /** Absolute URLs to return to after Checkout. */
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
};

export type CreateTopUpResult = {
  /** Where to send the user to complete payment. */
  checkoutUrl: string;
  /** PaymentIntent id if known at creation (mock only); null for Checkout. */
  paymentIntentId: string | null;
  /** Stripe customer id (created here if it was missing) so the caller persists it. */
  customerId: string | null;
  mocked: boolean;
};

// ── Off-session recharge (charge a previously-saved card) ──

export type ChargeSavedCardParams = {
  contractorId: string;
  amountCents: number;
  /** Required: the Stripe customer the saved card belongs to. */
  stripeCustomerId: string;
  /** Required: the saved payment method (card) id (pm_...). */
  paymentMethodId: string;
  /** Metadata the webhook reads to credit the wallet — { contractorId, amountCents, purpose }. */
  metadata?: Record<string, string>;
};

export type ChargeSavedCardResult =
  | {
      ok: true;
      mocked: boolean;
      /** The PaymentIntent id (real) or a synthetic mock id. */
      paymentIntentId: string;
      /** The payment method used (echoed back for persistence/audit). */
      paymentMethodId: string;
      status: string;
    }
  | {
      ok: false;
      mocked: boolean;
      /** Coarse, UI-safe reason. Never a raw Stripe error. */
      reason: "authentication_required" | "card_declined" | "error";
      message: string;
    };

// ── Refund a past top-up back to the card (Stripe refund) ──

export type RefundToCardParams = {
  /** The original top-up PaymentIntent to refund against. */
  paymentIntentId: string;
  amountCents: number;
  /** Idempotency key so a retry/double-submit never double-refunds on Stripe. */
  idempotencyKey?: string;
  metadata?: Record<string, string>;
};

export type RefundToCardResult =
  | { ok: true; mocked: boolean; refundId: string; refundedCents: number; status: string }
  | { ok: false; mocked: boolean; reason: "not_refundable" | "error"; message: string };

export interface PaymentsProvider {
  createTopUpCheckout(params: CreateTopUpParams): Promise<CreateTopUpResult>;
  /**
   * Charge a saved card OFF-SESSION (no customer present). The wallet is still
   * credited ONLY by the webhook on payment_intent.succeeded — never inline.
   * Returns a graceful, UI-safe failure (never throws raw Stripe errors) so the
   * caller can fall back to interactive Checkout.
   */
  chargeSavedCard(params: ChargeSavedCardParams): Promise<ChargeSavedCardResult>;
  /**
   * Issue a real refund to the card against the original top-up PaymentIntent.
   * Returns a graceful failure (never throws) so callers never move the wallet
   * balance when Stripe rejects the refund.
   */
  refundToCard(params: RefundToCardParams): Promise<RefundToCardResult>;
}

const isMock = () => process.env.STRIPE_MOCK !== "false"; // default ON

/**
 * MOCK provider: logs to console and returns a local URL that simulates a
 * successful top-up completion (see /wallet/topup/complete route).
 */
class MockPaymentsProvider implements PaymentsProvider {
  async createTopUpCheckout(params: CreateTopUpParams): Promise<CreateTopUpResult> {
    const paymentIntentId = `pi_mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // eslint-disable-next-line no-console
    console.log(
      `[payments:mock] top-up of ${params.amountCents}c for contractor ${params.contractorId} -> ${paymentIntentId}`,
    );
    const url = new URL(params.successUrl);
    url.searchParams.set("mock", "1");
    url.searchParams.set("amountCents", String(params.amountCents));
    url.searchParams.set("pi", paymentIntentId);
    return { checkoutUrl: url.toString(), paymentIntentId, customerId: null, mocked: true };
  }

  async chargeSavedCard(params: ChargeSavedCardParams): Promise<ChargeSavedCardResult> {
    const paymentIntentId = `pi_mock_recharge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // eslint-disable-next-line no-console
    console.log(
      `[payments:mock] off-session charge of ${params.amountCents}c for contractor ${params.contractorId} on ${params.paymentMethodId} -> ${paymentIntentId}`,
    );
    // Simulate a successful synchronous off-session charge. The caller drives the
    // existing mock credit path (creditTopUp) to mirror the real webhook.
    return {
      ok: true,
      mocked: true,
      paymentIntentId,
      paymentMethodId: params.paymentMethodId,
      status: "succeeded",
    };
  }

  async refundToCard(params: RefundToCardParams): Promise<RefundToCardResult> {
    const refundId = `re_mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // eslint-disable-next-line no-console
    console.log(
      `[payments:mock] refund of ${params.amountCents}c against ${params.paymentIntentId} -> ${refundId}`,
    );
    return {
      ok: true,
      mocked: true,
      refundId,
      refundedCents: params.amountCents,
      status: "succeeded",
    };
  }
}

/**
 * Real Stripe provider. Creates a Checkout Session for the exact integer-cents
 * amount, creating the Stripe customer on first top-up if missing. Amounts and
 * contractor id are attached as metadata (on both the session and the resulting
 * PaymentIntent) so the webhook can resolve who to credit.
 */
class StripePaymentsProvider implements PaymentsProvider {
  async createTopUpCheckout(params: CreateTopUpParams): Promise<CreateTopUpResult> {
    const stripe = await getStripe();

    let customerId = params.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: params.contractorEmail ?? undefined,
        name: params.contractorName ?? undefined,
        metadata: { contractorId: params.contractorId },
      });
      customerId = customer.id;
    }

    const metadata = { ...params.metadata, contractorId: params.contractorId };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.contractorId,
      metadata,
      // Save the card for future OFF-SESSION charges (admin "charge saved card"
      // + contractor "1-click recharge"). Stripe Checkout automatically shows the
      // required mandate/consent text — this IS the consent the client agreed to.
      payment_intent_data: { metadata, setup_future_usage: "off_session" },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: params.amountCents,
            product_data: { name: "Wallet top-up" },
          },
        },
      ],
    });

    if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
    return { checkoutUrl: session.url, paymentIntentId: null, customerId, mocked: false };
  }

  async chargeSavedCard(params: ChargeSavedCardParams): Promise<ChargeSavedCardResult> {
    const stripe = await getStripe();
    try {
      const pi = await stripe.paymentIntents.create({
        amount: params.amountCents, // integer cents
        currency: "usd",
        customer: params.stripeCustomerId,
        payment_method: params.paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: params.metadata,
      });
      // A successful off-session PI fires payment_intent.succeeded → the webhook
      // credits the wallet. We NEVER credit inline here.
      return {
        ok: true,
        mocked: false,
        paymentIntentId: pi.id,
        paymentMethodId:
          typeof pi.payment_method === "string"
            ? pi.payment_method
            : (pi.payment_method?.id ?? params.paymentMethodId),
        status: pi.status,
      };
    } catch (err) {
      return mapChargeError(err);
    }
  }

  async refundToCard(params: RefundToCardParams): Promise<RefundToCardResult> {
    const stripe = await getStripe();
    try {
      const refund = await stripe.refunds.create(
        {
          payment_intent: params.paymentIntentId,
          amount: params.amountCents, // integer cents
          metadata: params.metadata,
        },
        params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined,
      );
      // "failed" is the only status that means no money moved; "pending" and
      // "succeeded" both mean the refund was accepted by Stripe.
      if (refund.status === "failed") {
        return {
          ok: false,
          mocked: false,
          reason: "error",
          message: "Stripe could not process the refund. No money was moved.",
        };
      }
      return {
        ok: true,
        mocked: false,
        refundId: refund.id,
        refundedCents: refund.amount,
        status: refund.status ?? "pending",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      // Over-refund / already-refunded / outside window → not refundable.
      const notRefundable =
        /refund|charge_already_refunded|already been refunded|amount|greater than|expired/i.test(
          message,
        );
      return {
        ok: false,
        mocked: false,
        reason: notRefundable ? "not_refundable" : "error",
        message:
          "This charge can't be refunded to the card (it may be too old, already refunded, or outside Stripe's window).",
      };
    }
  }
}

/**
 * Map a Stripe off-session charge failure to a coarse, UI-safe reason. Never
 * leaks a raw Stripe message. `authentication_required` means the card needs the
 * cardholder present (3DS) — the caller falls back to interactive Checkout.
 */
function mapChargeError(err: unknown): ChargeSavedCardResult {
  const e = err as { code?: string; decline_code?: string; type?: string } | undefined;
  const code = e?.code ?? "";
  if (code === "authentication_required") {
    return {
      ok: false,
      mocked: false,
      reason: "authentication_required",
      message:
        "This card needs verification and can't be charged automatically. Please top up via the secure checkout.",
    };
  }
  if (code === "card_declined" || e?.type === "StripeCardError" || e?.decline_code) {
    return {
      ok: false,
      mocked: false,
      reason: "card_declined",
      message:
        "We couldn't charge the saved card (it was declined). Please top up via the secure checkout.",
    };
  }
  return {
    ok: false,
    mocked: false,
    reason: "error",
    message:
      "We couldn't charge the saved card. Please top up via the secure checkout.",
  };
}

/** Lazily construct the Stripe client so the SDK/keys are only needed in real mode. */
let stripeSingleton: Stripe | null = null;
export async function getStripe(): Promise<Stripe> {
  if (stripeSingleton) return stripeSingleton;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is required when STRIPE_MOCK=false.");
  const StripeCtor = (await import("stripe")).default;
  stripeSingleton = new StripeCtor(key);
  return stripeSingleton;
}

export const payments: PaymentsProvider = isMock()
  ? new MockPaymentsProvider()
  : new StripePaymentsProvider();

// ─────────────────────────────────────────────────────────────
// Read-only reporting helpers (admin "Cash & revenue" view).
// These NEVER move money — they only read Stripe's live balance and
// recent payouts so admins can reconcile the internal ledger against the
// real platform Stripe account. In mock mode (STRIPE_MOCK !== "false" or
// missing keys) they return clearly-labeled placeholder data and NEVER throw.
// ─────────────────────────────────────────────────────────────

export type StripeBalanceAmount = { amountCents: number; currency: string };

export type StripeBalanceResult = {
  mocked: boolean;
  /** Available (withdrawable) balance, one entry per currency. */
  available: StripeBalanceAmount[];
  /** Pending (not yet settled) balance, one entry per currency. */
  pending: StripeBalanceAmount[];
};

export type StripePayout = {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  /** Expected arrival in the bank, ms epoch (null if unknown). */
  arrivalDate: number | null;
  created: number | null;
};

export type StripePayoutsResult = {
  mocked: boolean;
  payouts: StripePayout[];
};

/**
 * Live Stripe balance (available + pending). Returns mocked/empty data when
 * running in mock mode or if the Stripe call fails, so the admin page renders
 * a "live data unavailable" notice instead of erroring.
 */
export async function getStripeBalance(): Promise<StripeBalanceResult> {
  if (isMock() || !process.env.STRIPE_SECRET_KEY) {
    return { mocked: true, available: [], pending: [] };
  }
  try {
    const stripe = await getStripe();
    const balance = await stripe.balance.retrieve();
    return {
      mocked: false,
      available: balance.available.map((b) => ({ amountCents: b.amount, currency: b.currency })),
      pending: balance.pending.map((b) => ({ amountCents: b.amount, currency: b.currency })),
    };
  } catch {
    return { mocked: true, available: [], pending: [] };
  }
}

/**
 * Ten most recent Stripe payouts to the company bank account. Returns
 * mocked/empty data in mock mode or on failure (never throws).
 */
export async function listRecentPayouts(): Promise<StripePayoutsResult> {
  if (isMock() || !process.env.STRIPE_SECRET_KEY) {
    return { mocked: true, payouts: [] };
  }
  try {
    const stripe = await getStripe();
    const list = await stripe.payouts.list({ limit: 10 });
    return {
      mocked: false,
      payouts: list.data.map((p) => ({
        id: p.id,
        amountCents: p.amount,
        currency: p.currency,
        status: p.status,
        arrivalDate: p.arrival_date ? p.arrival_date * 1000 : null,
        created: p.created ? p.created * 1000 : null,
      })),
    };
  } catch {
    return { mocked: true, payouts: [] };
  }
}
