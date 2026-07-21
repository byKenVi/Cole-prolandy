-- Add CARD_REFUND to WalletTransactionType. A CARD_REFUND is real money sent
-- BACK to the contractor's card via a Stripe refund and therefore DEBITS the
-- wallet (the backing money left). It is intentionally DISTINCT from the
-- internal REFUND type, which CREDITS the wallet (returning money for a bad lead
-- with no card movement).
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'CARD_REFUND';
