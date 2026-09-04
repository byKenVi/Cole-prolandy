import { runMigrations, StripeSync } from "stripe-replit-sync";
import { landysEnvironment } from "@/lib/runtime-environment";

const DEVELOPMENT_EVENTS = [
  "checkout.session.completed",
  "payment_intent.succeeded",
] as const;

type ManagedWebhook = {
  url: string;
  webhookId: string;
  webhookSecret: string;
};

let setupPromise: Promise<ManagedWebhook> | null = null;

function developmentWebhookUrl(): string {
  const rawDomain =
    process.env.REPLIT_DEV_DOMAIN?.trim() ||
    process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (!rawDomain) {
    throw new Error("Replit Development domain is unavailable for Stripe webhook setup.");
  }
  const domain = rawDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${domain}/api/stripe/webhook`;
}

async function setupManagedWebhook(secretKey: string): Promise<ManagedWebhook> {
  if (landysEnvironment() !== "development") {
    throw new Error("Managed Preview webhook setup is Development-only.");
  }
  if (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("rk_test_")) {
    throw new Error("Managed Preview webhook requires the Replit Stripe test sandbox.");
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for managed Stripe webhook metadata.");
  }

  await runMigrations({ databaseUrl });

  const sync = new StripeSync({
    stripeSecretKey: secretKey,
    poolConfig: { connectionString: databaseUrl, max: 2 },
  });
  const url = developmentWebhookUrl();
  const endpoints = await sync.stripe.webhookEndpoints.list({ limit: 100 });
  const conflictingEndpoints = endpoints.data.filter(
    (endpoint) =>
      endpoint.status === "enabled" &&
      endpoint.url !== url &&
      endpoint.enabled_events.some(
        (event) =>
          event === "*" ||
          DEVELOPMENT_EVENTS.includes(event as (typeof DEVELOPMENT_EVENTS)[number]),
      ),
  );
  if (conflictingEndpoints.length > 0) {
    throw new Error(
      "Replit Stripe sandbox is not isolated: another enabled webhook can receive " +
        `Landy's Development events (${conflictingEndpoints.map((item) => item.url).join(", ")}).`,
    );
  }

  const webhook = await sync.findOrCreateManagedWebhook(url, {
    enabled_events: [...DEVELOPMENT_EVENTS],
    description: "Landy's Pro Development success-fee webhook",
  });
  const accountId = await sync.getAccountId();
  const result = await sync.postgresClient.query(
    `SELECT secret
       FROM "stripe"."_managed_webhooks"
      WHERE id = $1 AND account_id = $2
      LIMIT 1`,
    [webhook.id, accountId],
  );
  const webhookSecret = (result.rows[0] as { secret?: string } | undefined)?.secret;
  if (!webhookSecret?.startsWith("whsec_")) {
    throw new Error("Replit managed webhook did not provide a signing secret.");
  }

  return { url, webhookId: webhook.id, webhookSecret };
}

export function ensureDevelopmentStripeManagedWebhook(
  secretKey: string,
): Promise<ManagedWebhook> {
  setupPromise ??= setupManagedWebhook(secretKey).catch((error) => {
    setupPromise = null;
    throw error;
  });
  return setupPromise;
}