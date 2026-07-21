-- Card display fields + one refund/charge per lead match.
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "cardBrand" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "cardLast4" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "WalletTransaction_leadMatchId_type_key"
  ON "WalletTransaction"("leadMatchId", "type");
