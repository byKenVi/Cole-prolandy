/**
 * Stripe client via Replit's managed Stripe connector.
 *
 * Credentials are fetched fresh on every call from Replit's connector API —
 * never cached, because the connector can rotate keys at any time.
 *
 * STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET env vars are no longer required;
 * all credentials come through the connector.
 */
import Stripe from "stripe";

async function getStripeCredentials(): Promise<{ secretKey: string; webhookSecret?: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    // Connector infrastructure not available — fall back to env var.
    const envKey = process.env.STRIPE_SECRET_KEY;
    if (envKey) {
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

  // Webhook secret: connector field is "webhook_secret", fall back to env var.
  const webhookSecret = settings?.webhook_secret ?? process.env.STRIPE_WEBHOOK_SECRET;

  return { secretKey, webhookSecret };
}

/**
 * Returns a fresh authenticated Stripe client.
 * Do NOT cache — tokens can rotate between requests.
 */
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

/**
 * Returns the Stripe webhook signing secret for verifying incoming events.
 */
export async function getStripeWebhookSecret(): Promise<string> {
  const { webhookSecret } = await getStripeCredentials();
  if (!webhookSecret) {
    throw new Error(
      "Stripe webhook secret not available from connector or STRIPE_WEBHOOK_SECRET env var.",
    );
  }
  return webhookSecret;
}
