export type LandysEnvironment = "development" | "staging" | "production";

export function landysEnvironment(): LandysEnvironment {
  const configured = process.env.LANDYS_ENV?.trim().toLowerCase();
  if (configured === "staging") return "staging";
  if (configured === "production") return "production";
  if (configured === "development") return "development";
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export function isStaging(): boolean {
  return landysEnvironment() === "staging";
}

function requireStagingUrl(): URL {
  const raw = process.env.STAGING_PUBLIC_URL?.trim();
  if (!raw) throw new Error("STAGING_PUBLIC_URL is required when LANDYS_ENV=staging.");
  const url = new URL(raw);
  if (url.protocol !== "https:") {
    throw new Error("STAGING_PUBLIC_URL must use HTTPS.");
  }
  if (!url.hostname.toLowerCase().includes("staging")) {
    throw new Error("STAGING_PUBLIC_URL hostname must clearly contain 'staging'.");
  }
  return url;
}

/**
 * Fail-closed staging boot validation. Production is deliberately untouched.
 * Staging runs Next.js with NODE_ENV=production, so LANDYS_ENV is the explicit
 * deployment discriminator.
 */
export function assertStagingRuntimeConfig(): void {
  if (!isStaging()) return;

  const stagingUrl = requireStagingUrl();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl || new URL(appUrl).origin !== stagingUrl.origin) {
    throw new Error("NEXT_PUBLIC_APP_URL must match STAGING_PUBLIC_URL in staging.");
  }
  if (process.env.AUTH_MODE !== "clerk") {
    throw new Error('Staging requires AUTH_MODE="clerk".');
  }
  const clerkPublishableKey =
    process.env.CLERK_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!clerkPublishableKey?.startsWith("pk_test_")) {
    throw new Error("Staging requires a Clerk test/development publishable key.");
  }
  if (!process.env.CLERK_SECRET_KEY?.startsWith("sk_test_")) {
    throw new Error("Staging requires a Clerk test/development secret key.");
  }
  if (process.env.STRIPE_MOCK === "false" && !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
    throw new Error("Staging real-payment mode requires a Stripe sk_test_ key.");
  }
  if (process.env.WIX_ESTIMATE_INTEGRATION_ENABLED === "true" && !process.env.WIX_ESTIMATE_API_SECRET) {
    throw new Error("Staging Wix intake requires its own WIX_ESTIMATE_API_SECRET.");
  }
}

export function stagingPublicUrl(): URL {
  if (!isStaging()) throw new Error("This operation is staging-only.");
  return requireStagingUrl();
}