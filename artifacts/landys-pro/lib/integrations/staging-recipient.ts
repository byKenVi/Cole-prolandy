import { isStaging } from "@/lib/runtime-environment";

function requiredOverride(name: "STAGING_NOTIFICATION_EMAIL" | "STAGING_NOTIFICATION_PHONE"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required in staging; refusing to contact the original recipient.`);
  }
  return value;
}

/** Production/development keep the original destination. Staging always redirects. */
export function safeEmailRecipient(original: string): string {
  return isStaging() ? requiredOverride("STAGING_NOTIFICATION_EMAIL") : original;
}

/** Production/development keep the original destination. Staging always redirects. */
export function safeSmsRecipient(original: string): string {
  return isStaging() ? requiredOverride("STAGING_NOTIFICATION_PHONE") : original;
}