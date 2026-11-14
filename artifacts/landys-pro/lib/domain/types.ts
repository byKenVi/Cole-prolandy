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
  /** Default service radius (miles) for contractors without their own radius. */
  serviceRadiusMiles: "serviceRadiusMiles",
  /** Days after the first acceptance before asking the landowner who they hired. */
  landownerHireCheckDelayDays: "landownerHireCheckDelayDays",
  /** Reminders per follow-up stage before the admin is alerted. */
  followUpMaxAttempts: "followUpMaxAttempts",
  /** Comma-separated extra recipients for admin alerts (besides team admins). */
  adminAlertEmails: "adminAlertEmails",
  cronLastRunAt: "cronLastRunAt",
  cronLastResult: "cronLastResult",
  cronLockUntil: "cronLockUntil",
  wixContractorSyncLastSuccessAt: "wixContractorSyncLastSuccessAt",
  wixContractorSyncLastAttemptAt: "wixContractorSyncLastAttemptAt",
  wixContractorSyncLastResult: "wixContractorSyncLastResult",
} as const;
