/**
 * Payments interface (wallet top-ups). Real Stripe drops in behind this same
 * interface with zero call-site changes. Toggle with STRIPE_MOCK env.
 */
export type CreateTopUpParams = {
  contractorId: string;
  amountCents: number;
  stripeCustomerId?: string | null;
  /** Absolute URLs to return to after Checkout. */
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
};

export type CreateTopUpResult = {
  /** Where to send the user to complete payment. */
  checkoutUrl: string;
  paymentIntentId: string;
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
  async createTopUpCheckout(
    params: CreateTopUpParams,
  ): Promise<CreateTopUpResult> {
    const paymentIntentId = `pi_mock_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    // eslint-disable-next-line no-console
    console.log(
      `[payments:mock] top-up of ${params.amountCents}c for contractor ${params.contractorId} -> ${paymentIntentId}`,
    );
    const url = new URL(params.successUrl);
    url.searchParams.set("mock", "1");
    url.searchParams.set("amountCents", String(params.amountCents));
    url.searchParams.set("pi", paymentIntentId);
    return { checkoutUrl: url.toString(), paymentIntentId, mocked: true };
  }
}

/**
 * Real Stripe provider stub. Wire this up when STRIPE_MOCK=false.
 * Uses a lazy import so the `stripe` package is only required in real mode.
 */
class StripePaymentsProvider implements PaymentsProvider {
  async createTopUpCheckout(
    params: CreateTopUpParams,
  ): Promise<CreateTopUpResult> {
    // TODO(real): implement with Stripe Checkout Sessions.
    //   const Stripe = (await import("stripe")).default;
    //   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    //   const session = await stripe.checkout.sessions.create({ ...mode: "payment" });
    //   return { checkoutUrl: session.url!, paymentIntentId: session.payment_intent, mocked: false };
    throw new Error(
      "Stripe live mode not yet implemented. Set STRIPE_MOCK=true or wire StripePaymentsProvider.",
    );
  }
}

export const payments: PaymentsProvider = isMock()
  ? new MockPaymentsProvider()
  : new StripePaymentsProvider();
