import { assertLocalSupabaseIsolation } from "@/lib/ops/database-safety";

export type LandysEnvironment = "local" | "development" | "staging" | "production";

export function landysEnvironment(): LandysEnvironment {
  const configured = process.env.LANDYS_ENV?.trim().toLowerCase();
  if (configured === "local") return "local";
  if (configured === "staging") return "staging";
  if (configured === "production") return "production";
  if (configured === "development") return "development";
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export function isLocal(): boolean {
  return landysEnvironment() === "local";
}

export function isStaging(): boolean {
  return landysEnvironment() === "staging";
}

/** Local Cursor QA or the separate staging Repl — never production. */
export function isIsolatedQaEnvironment(): boolean {
  return isLocal() || isStaging();
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

/** Local boot checks — soft for AUTH_MODE=dev; strict when using real Stripe/Clerk. */
export function assertLocalRuntimeConfig(): void {
  if (!isLocal()) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  const host = new URL(appUrl).hostname.toLowerCase();
  if (host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".local")) {
    throw new Error(
      'LANDYS_ENV=local requires NEXT_PUBLIC_APP_URL on localhost / 127.0.0.1 / *.local.',
    );
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const directUrl = process.env.DIRECT_URL?.trim();
  const expectedProjectRef = process.env.LOCAL_SUPABASE_PROJECT_REF?.trim();
  if (!databaseUrl || !directUrl || !expectedProjectRef) {
    throw new Error(
      "Local runtime requires DATABASE_URL, DIRECT_URL, and LOCAL_SUPABASE_PROJECT_REF.",
    );
  }
  assertLocalSupabaseIsolation({
    databaseUrl,
    directUrl,
    expectedProjectRef,
    supabaseUrl: process.env.SUPABASE_URL,
  });

  if (!process.env.LOCAL_NOTIFICATION_EMAIL?.trim()) {
    throw new Error("LOCAL_NOTIFICATION_EMAIL is required in local mode.");
  }
  if (!process.env.LOCAL_NOTIFICATION_PHONE?.trim()) {
    throw new Error("LOCAL_NOTIFICATION_PHONE is required in local mode.");
  }

  if (process.env.STRIPE_MOCK === "false") {
    if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
      throw new Error("Local Stripe requires sk_test_ (or set STRIPE_MOCK=true).");
    }
  }

  if (process.env.AUTH_MODE === "clerk") {
    const pk =
      process.env.CLERK_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    if (!pk?.startsWith("pk_test_")) {
      throw new Error("Local Clerk mode requires a pk_test_ publishable key.");
    }
    if (!process.env.CLERK_SECRET_KEY?.startsWith("sk_test_")) {
      throw new Error("Local Clerk mode requires an sk_test_ secret key.");
    }
  }
}

export function stagingPublicUrl(): URL {
  if (!isStaging()) throw new Error("This operation is staging-only.");
  return requireStagingUrl();
}
