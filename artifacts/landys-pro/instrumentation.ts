import { assertAuthConfigFailClosed } from "@/lib/auth";
import {
  assertLocalRuntimeConfig,
  assertStagingRuntimeConfig,
  landysEnvironment,
} from "@/lib/runtime-environment";

/**
 * Next.js server-startup hook. Runs once when the server boots (Node runtime).
 * We use it as a fail-closed gate: refuse to start in production unless real
 * Clerk auth is configured, so the app can never boot with insecure dev auth.
 */
export async function register() {
  assertAuthConfigFailClosed();
  assertStagingRuntimeConfig();
  assertLocalRuntimeConfig();

  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DATABASE_URL) {
    // Seed settings, success-fee tiers and taxonomy when they are missing.
    // Never fatal: the app has in-code defaults for every setting.
    try {
      const { prisma } = await import("@/lib/prisma");
      const { ensureReferenceData } = await import("@/lib/ops/bootstrap");
      const result = await ensureReferenceData(prisma);
      const inserted = Object.values(result).reduce((sum, n) => sum + n, 0);
      if (inserted > 0) console.log("[bootstrap] reference data inserted", result);
    } catch (error) {
      console.error("[bootstrap] reference data check failed", error);
    }
  }

  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    landysEnvironment() === "development" &&
    process.env.STRIPE_MOCK === "false"
  ) {
    const { getStripeSecretKey } = await import("@/lib/integrations/stripe-client");
    const { ensureDevelopmentStripeManagedWebhook } = await import(
      "@/lib/integrations/stripe-managed-webhook"
    );
    const secretKey = await getStripeSecretKey();
    try {
      await ensureDevelopmentStripeManagedWebhook(secretKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[stripe-development] real test payments disabled until webhook isolation is safe: ${message}`,
      );
    }
  }
}
