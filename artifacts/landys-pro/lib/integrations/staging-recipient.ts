import { landysEnvironment, isLocal, isStaging } from "@/lib/runtime-environment";

type OverrideName =
  | "LOCAL_NOTIFICATION_EMAIL"
  | "LOCAL_NOTIFICATION_PHONE"
  | "DEVELOPMENT_NOTIFICATION_EMAIL"
  | "DEVELOPMENT_NOTIFICATION_PHONE"
  | "STAGING_NOTIFICATION_EMAIL"
  | "STAGING_NOTIFICATION_PHONE";

function requiredOverride(name: OverrideName): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required in this environment; refusing to contact the original recipient.`);
  }
  return value;
}

/**
 * Production keeps the original destination.
 * Local (LANDYS_ENV=local) and staging always redirect to safe overrides (fail-closed).
 */
export function safeEmailRecipient(original: string): string {
  if (isLocal()) return requiredOverride("LOCAL_NOTIFICATION_EMAIL");
  if (landysEnvironment() === "development") {
    return requiredOverride("DEVELOPMENT_NOTIFICATION_EMAIL");
  }
  if (isStaging()) return requiredOverride("STAGING_NOTIFICATION_EMAIL");
  return original;
}

/** Same isolation rules as email, for SMS. */
export function safeSmsRecipient(original: string): string {
  if (isLocal()) return requiredOverride("LOCAL_NOTIFICATION_PHONE");
  if (landysEnvironment() === "development") {
    return requiredOverride("DEVELOPMENT_NOTIFICATION_PHONE");
  }
  if (isStaging()) return requiredOverride("STAGING_NOTIFICATION_PHONE");
  return original;
}
