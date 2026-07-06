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
  maxLeadRecipients: "maxLeadRecipients",
  leadExpiryHours: "leadExpiryHours",
} as const;
