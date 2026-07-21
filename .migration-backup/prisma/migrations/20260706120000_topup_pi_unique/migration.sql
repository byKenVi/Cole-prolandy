-- Deduplicate existing wallet transactions that share a Stripe payment-intent id
-- (keep the earliest row per pi) so the unique index below can be created.
-- Only rows with a non-null stripePaymentIntentId are affected.
DELETE FROM "WalletTransaction" a
USING "WalletTransaction" b
WHERE a."stripePaymentIntentId" IS NOT NULL
  AND a."stripePaymentIntentId" = b."stripePaymentIntentId"
  AND (
    a."createdAt" > b."createdAt"
    OR (a."createdAt" = b."createdAt" AND a."id" > b."id")
  );

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_stripePaymentIntentId_key"
  ON "WalletTransaction"("stripePaymentIntentId");
