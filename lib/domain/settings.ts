import type { DbClient } from "./types";
import { APP_SETTING_KEYS } from "./types";

const DEFAULTS: Record<string, number> = {
  [APP_SETTING_KEYS.maxLeadRecipients]: 3,
  [APP_SETTING_KEYS.leadExpiryHours]: 48,
};

/** Read an integer AppSetting, falling back to a hardcoded default. */
export async function getIntSetting(
  db: DbClient,
  key: string,
): Promise<number> {
  const row = await db.appSetting.findUnique({ where: { key } });
  if (!row) return DEFAULTS[key] ?? 0;
  const n = Number.parseInt(row.value, 10);
  return Number.isFinite(n) ? n : DEFAULTS[key] ?? 0;
}

export async function getMaxLeadRecipients(db: DbClient): Promise<number> {
  const n = await getIntSetting(db, APP_SETTING_KEYS.maxLeadRecipients);
  return Math.max(1, n); // min 1 (see business rule 1)
}

export async function getLeadExpiryHours(db: DbClient): Promise<number> {
  const n = await getIntSetting(db, APP_SETTING_KEYS.leadExpiryHours);
  return Math.max(1, n);
}
