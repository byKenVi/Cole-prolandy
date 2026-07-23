-- Saved off-session payment method (card) for reuse. Captured from the first
-- top-up's PaymentIntent (setup_future_usage=off_session) so the platform can
-- charge the contractor's card off-session (admin "charge saved card" +
-- contractor "1-click recharge"). Nullable: null = no reusable card yet.
ALTER TABLE "Contractor" ADD COLUMN "stripeDefaultPaymentMethodId" TEXT;
