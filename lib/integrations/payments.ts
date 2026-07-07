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

export interface PaymentsProvider {
  createTopUpCheckout(params: CreateTopUpParams): Promise<CreateTopUpResult>;
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
      payment_intent_data: { metadata },
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
