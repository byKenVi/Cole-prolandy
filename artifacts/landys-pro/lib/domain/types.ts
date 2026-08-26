import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * A DB client that domain functions accept. Satisfied by both the full
 * PrismaClient and an interactive-transaction client (`tx`). Domain functions
 * that must be atomic accept a transaction client explicitly.
 *
 * Tests may pass a structural fake cast to this type.
 */
export type DbClient = PrismaClient | Prisma.TransactionClient;

export const APP_SETTING_KEYS = {
  maxLeadPurchases: "maxLeadPurchases",
  leadExpiryHours: "leadExpiryHours",
  acceptanceUnlimited: "acceptanceUnlimited",
  followUpOutcomeDelayHours: "followUpOutcomeDelayHours",
  followUpPaymentDelayHours: "followUpPaymentDelayHours",
  followUpPaymentRetryHours: "followUpPaymentRetryHours",
  /** @deprecated Legacy key — no longer used by intake. Kept for migration compatibility. */
  maxLeadRecipients: "maxLeadRecipients",
  /** @deprecated Legacy key — no longer used by intake. */
  defaultLeadTier: "defaultLeadTier",
  wixContractorSyncLastSuccessAt: "wixContractorSyncLastSuccessAt",
  wixContractorSyncLastAttemptAt: "wixContractorSyncLastAttemptAt",
  wixContractorSyncLastResult: "wixContractorSyncLastResult",
} as const;
