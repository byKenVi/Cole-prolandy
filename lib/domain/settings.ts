import type { DbClient } from "./types";
import { APP_SETTING_KEYS } from "./types";

/** Read a required integer AppSetting. Migrations install every required key. */
export async function getIntSetting(
  db: DbClient,
  key: string,
): Promise<number> {
  const row = await db.appSetting.findUnique({ where: { key } });
  if (!row) throw new Error(`Missing required AppSetting: ${key}`);
  const n = Number.parseInt(row.value, 10);
  if (!Number.isFinite(n)) throw new Error(`Invalid integer AppSetting: ${key}`);
  return n;
}

export async function getMaxLeadRecipients(db: DbClient): Promise<number> {
  const n = await getIntSetting(db, APP_SETTING_KEYS.maxLeadRecipients);
  return Math.max(1, n); // min 1 (see business rule 1)
}

export async function getLeadExpiryHours(db: DbClient): Promise<number> {
  const n = await getIntSetting(db, APP_SETTING_KEYS.leadExpiryHours);
  return Math.max(1, n);
}

export async function getDefaultLeadTier(db: DbClient): Promise<number> {
  const n = await getIntSetting(db, APP_SETTING_KEYS.defaultLeadTier);
  return Math.min(3, Math.max(1, n));
}
