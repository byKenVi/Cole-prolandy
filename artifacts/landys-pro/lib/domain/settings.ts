import type { DbClient } from "./types";
import { APP_SETTING_KEYS } from "./types";

/**
 * Defaults for every runtime setting. The production database may start with
 * an empty AppSetting table (Replit Publish copies the schema, not data), so a
 * missing row falls back here instead of breaking lead routing. The bootstrap
 * in `lib/ops/bootstrap.ts` also writes these rows so admins can edit them.
 */
export const DEFAULT_SETTINGS: Record<string, string> = {
  [APP_SETTING_KEYS.maxLeadPurchases]: "3",
  [APP_SETTING_KEYS.leadExpiryHours]: "48",
  [APP_SETTING_KEYS.acceptanceUnlimited]: "false",
  [APP_SETTING_KEYS.followUpOutcomeDelayHours]: "72",
  [APP_SETTING_KEYS.followUpPaymentDelayHours]: "336",
  [APP_SETTING_KEYS.followUpPaymentRetryHours]: "168",
  [APP_SETTING_KEYS.serviceRadiusMiles]: "50",
  [APP_SETTING_KEYS.landownerHireCheckDelayDays]: "14",
  [APP_SETTING_KEYS.followUpMaxAttempts]: "3",
};

/** Read an integer AppSetting, falling back to DEFAULT_SETTINGS. */
export async function getIntSetting(db: DbClient, key: string): Promise<number> {
  const row = await db.appSetting.findUnique({ where: { key } });
  const raw = row?.value ?? DEFAULT_SETTINGS[key];
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) {
    const fallback = Number.parseInt(DEFAULT_SETTINGS[key] ?? "", 10);
    if (Number.isFinite(fallback)) return fallback;
    throw new Error(`Invalid integer AppSetting: ${key}`);
  }
  return n;
}

export async function getOptionalStringSetting(
  db: DbClient,
  key: string,
): Promise<string | null> {
  const row = await db.appSetting.findUnique({ where: { key } });
  return row?.value ?? DEFAULT_SETTINGS[key] ?? null;
}

/** Maximum successful acceptances per general lead (snapshotted onto each lead at creation). */
export async function getMaxLeadPurchases(db: DbClient): Promise<number> {
  const n = await getIntSetting(db, APP_SETTING_KEYS.maxLeadPurchases);
  return Math.max(1, n);
}

export async function getAcceptanceUnlimited(db: DbClient): Promise<boolean> {
  const row = await db.appSetting.findUnique({
    where: { key: APP_SETTING_KEYS.acceptanceUnlimited },
  });
  return row?.value === "true";
}

export async function getLeadExpiryHours(db: DbClient): Promise<number> {
  const n = await getIntSetting(db, APP_SETTING_KEYS.leadExpiryHours);
  return Math.max(1, n);
}

export async function getFollowUpOutcomeDelayHours(db: DbClient): Promise<number> {
  const n = await getIntSetting(db, APP_SETTING_KEYS.followUpOutcomeDelayHours);
  return Math.max(1, n);
}

export async function getFollowUpPaymentDelayHours(db: DbClient): Promise<number> {
  const n = await getIntSetting(db, APP_SETTING_KEYS.followUpPaymentDelayHours);
  return Math.max(1, n);
}

export async function getFollowUpPaymentRetryHours(db: DbClient): Promise<number> {
  const n = await getIntSetting(db, APP_SETTING_KEYS.followUpPaymentRetryHours);
  return Math.max(1, n);
}

export async function getServiceRadiusMiles(db: DbClient): Promise<number> {
  const n = await getIntSetting(db, APP_SETTING_KEYS.serviceRadiusMiles);
  return Math.min(500, Math.max(1, n));
}

export async function getLandownerHireCheckDelayDays(db: DbClient): Promise<number> {
  const n = await getIntSetting(db, APP_SETTING_KEYS.landownerHireCheckDelayDays);
  return Math.min(120, Math.max(1, n));
}

export async function getFollowUpMaxAttempts(db: DbClient): Promise<number> {
  const n = await getIntSetting(db, APP_SETTING_KEYS.followUpMaxAttempts);
  return Math.min(10, Math.max(1, n));
}
