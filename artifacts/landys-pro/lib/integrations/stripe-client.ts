/**
 * Stripe client via Replit's managed Stripe connector.
 *
 * Credentials are fetched fresh on every call from Replit's connector API —
 * never cached, because the connector can rotate keys at any time.
 *
 * Replit supplies an isolated test-mode sandbox to Development and switches the
 * same connector to the linked account only in a published deployment. Local
 * Cursor and standalone staging environments continue to use explicit keys.
 */
import Stripe from "stripe";
import { landysEnvironment } from "@/lib/runtime-environment";

function assertSafeStripeKey(secretKey: string): void {
  if (
    landysEnvironment() !== "production" &&
    !secretKey.startsWith("sk_test_") &&
    !secretKey.startsWith("rk_test_")
  ) {
    throw new Error("Non-production environments require a Stripe test-mode credential.");
  }
}

async function getStripeCredentials(): Promise<{
  secretKey: string;
  webhookSecret?: string;
  publishableKey?: string;
}> {
  const environment = landysEnvironment();
  if (environment === "local" || environment === "staging") {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secretKey) {
      throw new Error(`${environment} requires STRIPE_SECRET_KEY.`);
    }
    assertSafeStripeKey(secretKey);
    if (!webhookSecret?.startsWith("whsec_")) {
      throw new Error(`${environment} requires STRIPE_WEBHOOK_SECRET.`);
    }
    return { secretKey, webhookSecret };
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
  // Build tools may not have connector identity. Runtime Development and
  // Production processes do; fail closed rather than crossing environments.
    const envKey = process.env.STRIPE_SECRET_KEY;
    if (environment === "production" && envKey) {
      assertSafeStripeKey(envKey);
      return { secretKey: envKey, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET };
    }
    throw new Error(
      "Stripe connector not available. " +
        "Ensure the Stripe integration is connected via the Integrations tab.",
    );
  }

  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!resp.ok) {
    throw new Error(`Failed to fetch Stripe credentials: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  const settings = data.items?.[0]?.settings;

  // Connector field is "secret" (not "secret_key") — confirmed from connector schema.
  const secretKey = settings?.secret ?? settings?.secret_key ?? process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "Stripe connector is attached but has no credentials. " +
        "Complete the Stripe connection in the Integrations tab.",
    );
  }
  assertSafeStripeKey(secretKey);

  const webhookSecret =
    settings?.webhook_secret ??
    (environment === "production" ? process.env.STRIPE_WEBHOOK_SECRET : undefined);

  return {
    secretKey,
    webhookSecret,
    publishableKey: settings?.publishable ?? settings?.publishable_key,
  };
}

/**
 * Returns a fresh authenticated Stripe client.
 * Do NOT cache — tokens can rotate between requests.
 */
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  if (landysEnvironment() === "development") {
    const { ensureDevelopmentStripeManagedWebhook } = await import(
      "@/lib/integrations/stripe-managed-webhook"
    );
    await ensureDevelopmentStripeManagedWebhook(secretKey);
  }
  return new Stripe(secretKey);
}

/** Server-startup access for Development managed webhook registration. */
export async function getStripeSecretKey(): Promise<string> {
  return (await getStripeCredentials()).secretKey;
}

/**
 * Returns the Stripe webhook signing secret for verifying incoming events.
 */
export async function getStripeWebhookSecret(): Promise<string> {
  const { secretKey, webhookSecret } = await getStripeCredentials();
  if (!webhookSecret && landysEnvironment() === "development") {
    const { ensureDevelopmentStripeManagedWebhook } = await import(
      "@/lib/integrations/stripe-managed-webhook"
    );
    return (await ensureDevelopmentStripeManagedWebhook(secretKey)).webhookSecret;
  }
  if (!webhookSecret) {
    throw new Error(
      "Stripe webhook secret not available from connector or STRIPE_WEBHOOK_SECRET env var.",
    );
  }
  return webhookSecret;
}
