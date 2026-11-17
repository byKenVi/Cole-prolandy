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
      const inserted = Object.values(result).reduce<number>((sum, n) => sum + Number(n), 0);
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

/**
 * Unhandled server errors (page renders, server actions, route handlers):
 * log them and email the admins, at most once per route every 30 minutes, so
 * a broken page in production is noticed without an external monitoring tool.
 */
const lastAlertAt = new Map<string, number>();

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string },
) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[server-error]", request.method, request.path, message);
  // Keep the import inside this exact check so webpack drops it from the edge bundle.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV !== "production") return;
    const key = context.routePath ?? request.path;
    const now = Date.now();
    if (now - (lastAlertAt.get(key) ?? 0) < 30 * 60_000) return;
    lastAlertAt.set(key, now);
    try {
      const { notifyAdmins } = await import("@/lib/notifications");
      await notifyAdmins({
        kind: "server_error",
        title: `Server error on ${key}`,
        lines: [
          `${request.method} ${request.path.split("?")[0]} failed: ${message.slice(0, 300)}`,
          "Check the Replit deployment logs for details. Further errors on this page are muted for 30 minutes.",
        ],
      });
    } catch (alertError) {
      console.error("[server-error] admin alert failed", alertError);
    }
  }
}

