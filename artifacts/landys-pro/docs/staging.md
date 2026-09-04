# Landy's Pro staging runbook

Staging must be a **separate Replit app/Repl** created from the same repository
and approved commit as production. Replit exposes development and production
configuration for one Repl; a third, independently published URL requires a
second Repl/deployment. Do not repurpose the existing production deployment.

## One-time setup

1. Create a new Repl named clearly with `staging` (for example,
   `landys-pro-staging`) from the same Git repository.
2. Provision a separate empty PostgreSQL database. Do not clone production
   operational data.
3. In the staging Repl, configure these staging-only secrets:
   - `STAGING_DATABASE_URL` — staging PostgreSQL connection
   - `STAGING_ADMIN_EMAIL`
   - `STAGING_CONTRACTOR_EMAILS` — at least three comma-separated Clerk test users
   - Clerk test/development keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
     `CLERK_SECRET_KEY`)
   - Stripe test keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)
   - a unique `WIX_ESTIMATE_API_SECRET`
   - a unique `CRON_SECRET`
   - `STAGING_NOTIFICATION_EMAIL` and `STAGING_NOTIFICATION_PHONE`
4. Configure non-secret staging variables:
   - `LANDYS_ENV=staging`
   - `AUTH_MODE=clerk`
   - `STAGING_PUBLIC_URL=https://<staging-host>`
   - `NEXT_PUBLIC_APP_URL=https://<staging-host>`
   - `STRIPE_MOCK=false`
   - `RESEND_MOCK=false` (or `true` to log only)
   - `TWILIO_MOCK=false` only when the override phone is verified; otherwise `true`
   - `WIX_ESTIMATE_INTEGRATION_ENABLED=true`
5. The staging app runtime still needs `DATABASE_URL` set to the same staging
   database value. Never copy production values.
6. Run `pnpm --filter @workspace/landys-pro staging:migrate`. It runs
   `prisma migrate deploy` only when the target is empty or already carries the
   staging marker.
7. Run `pnpm --filter @workspace/landys-pro staging:reseed`.

The reset/reseed command refuses to run unless `LANDYS_ENV=staging`, the public
hostname contains `staging`, the dedicated staging DB secret exists, and the target
database carries `AppSetting(environmentName=staging)`.

## Integrations

### Clerk

Use a Clerk development/test instance and create test users matching
`STAGING_ADMIN_EMAIL` and `STAGING_CONTRACTOR_EMAILS`. Startup fails closed when
staging is given live Clerk keys.

### Stripe

Create a Stripe **test-mode** webhook endpoint:

`https://<staging-host>/api/stripe/webhook`

Use the endpoint signing secret as staging's `STRIPE_WEBHOOK_SECRET`. Staging
never reads the Replit Stripe connector; it requires an explicit `sk_test_` key,
so production charges are impossible through the staging deployment.

### Wix / Landys.co

Do not redirect the production Wix form. Test the exact same internal intake
contract by POSTing a fixture to:

`POST https://<staging-host>/api/integrations/wix/estimate-requests`

with `Authorization: Bearer <staging WIX_ESTIMATE_API_SECRET>`. This is strategy
B from the staging work order: a controlled staging intake endpoint. It uses the
same schema validation, idempotency, lead creation, matching, and notification
code as the production Wix integration.

### Email and SMS

In staging, every destination is replaced by `STAGING_NOTIFICATION_EMAIL` or
`STAGING_NOTIFICATION_PHONE`. If either required override is missing, the send
fails closed rather than contacting the original contractor/landowner.

### Cron

Configure an hourly request to:

`GET https://<staging-host>/api/cron/follow-ups`

with `Authorization: Bearer <staging CRON_SECRET>`. The separate URL and database
ensure only staging follow-ups are processed.

## Repeatable test data

`staging:reseed` creates:

- one owner/admin row (from `STAGING_ADMIN_EMAIL`)
- three category/work-type contractors with zero wallet balance
- canonical live-v3 categories, work types, land types, budget mappings from
  migrations, and current success-fee tiers
- open and accepted opportunities
- Won / Awaiting Contractor Payment, Fee Due, and Fee Paid examples
- landowner confirmation and mismatch examples

It creates no wallet transactions, wallet balances, purchased leads, legacy
price tiers, or pay-per-lead transactions.

Reset only: `pnpm --filter @workspace/landys-pro staging:reset`

Reset and seed: `pnpm --filter @workspace/landys-pro staging:reseed`

## Cursor → staging → production

Use a simple two-branch promotion flow:

1. Develop on a short-lived feature branch in Cursor.
2. Open/merge a reviewed PR into `main`.
3. Pin the approved commit SHA and pull that exact SHA into the staging Repl.
4. Run `staging:migrate` when migrations changed, then `staging:reseed` as needed.
5. Run browser/functional QA against the staging URL only.
6. Record the approved commit SHA.
7. Pull/deploy that **same SHA** to the production Repl; do not merge additional
   code between staging approval and production publish.
8. Apply production migrations only when that SHA contains migrations.
9. Never run a staging seed/reset command in production and never seed production.

Production cleanup is intentionally outside this runbook and must be separately
approved.