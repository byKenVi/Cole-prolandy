-- Add PROMO_CREDIT to WalletTransactionType. Admin-granted promotional balance
-- is spendable but is a distinct, explicitly-labeled type — never conflated with
-- real (Stripe-backed) funds.
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'PROMO_CREDIT';
