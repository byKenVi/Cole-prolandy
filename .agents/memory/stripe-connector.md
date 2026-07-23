---
name: Stripe connector migration
description: How Stripe credentials are obtained after switching from manual env vars to the Replit Stripe connector.
---

## Rule
Stripe credentials (secret key + webhook secret) are fetched from the Replit connector API via `lib/integrations/stripe-client.ts` (`getUncachableStripeClient()` and `getStripeWebhookSecret()`). **Never cache the client** — connector tokens can rotate.

`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` env vars are still supported as a fallback for local development without the connector attached, but are no longer the primary source.

**Why:**
The Replit Stripe connector (ID: `conn_stripe_01KY58J6K9QM0DA15ZDFVG0AR6`) replaces personal API keys so Replit manages the credentials in production. The connector API (`https://${REPLIT_CONNECTORS_HOSTNAME}/api/v2/connection?include_secrets=true&connector_names=stripe`) returns `settings.secret_key` and `settings.webhook_secret`.

**How to apply:**
- `lib/integrations/payments.ts` → `getStripe()` calls `getUncachableStripeClient()` (dynamic import)
- `lib/services/stripe-webhook.ts` → `constructStripeEvent()` calls `getStripeWebhookSecret()`
- Mock flags (`STRIPE_MOCK=false` in production) must be set for live payments; without it, `createPaymentsProvider()` falls back to mock mode which no-ops all payments.
- This app uses a custom wallet-based payment flow, NOT `stripe-replit-sync`. Do not add `stripe-replit-sync` managed webhooks — the existing webhook handling in `app/api/stripe/webhook/route.ts` is intentional.
- Stripe webhook endpoint ID: `we_1Tw2owE6TxMHJbOhIeqGVBYN` for `https://cole-prolandy-project.replit.app/api/stripe/webhook`.
- Webhook signing secret is stored as `STRIPE_WEBHOOK_SECRET` production env var (NOT a Replit Secret). The personal `STRIPE_WEBHOOK_SECRET` Replit Secret overrides this until the user deletes it.
- `STRIPE_SECRET_KEY` env var is NOT required — the connector (`settings.secret_key`) is the only source. Do not add it back.
- `findOrCreateManagedWebhook` from `stripe-replit-sync` does NOT work from CodeExecution sandbox (returns null); use direct Stripe API fetch instead.
