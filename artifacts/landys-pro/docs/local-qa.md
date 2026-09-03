# Local Cursor QA — Landy's Pro

Isolated local environment for developing and QAing the **current success-fee
model** without touching Replit production.

## Workflow

```
DEVELOP in Cursor
  → pnpm dev:reseed
  → browser QA on localhost
  → typecheck / tests / build
  → approve commit SHA
  → push main → Replit production pull/deploy
  → minimal production smoke QA
```

Never seed production. Never point `DATABASE_URL` at production from Cursor.

## Windows note

Root `preinstall` is Node-based (`scripts/ensure-pnpm.cjs`) so Cursor PowerShell
works without Git Bash/`sh`. If an older clone still fails with `'sh' is not
recognized`, pull the latest `package.json` fix first.

## One-time setup

### 1. Dedicated Supabase DEV

Put the disposable DEV `DATABASE_URL` and `DIRECT_URL` in the repository-root
`.env`. Put the non-secret DEV project ref in
`artifacts/landys-pro/.env.local` as `LOCAL_SUPABASE_PROJECT_REF`.

The production Supabase ref is hard-blocked in code. Runtime and destructive
commands also require pooled/direct URLs to resolve to the explicit DEV ref.

### 2. Environment file

Keep secrets in root `.env` and local-only settings/recipient overrides in
`artifacts/landys-pro/.env.local`. Root commands load both, with root `.env`
authoritative for database and integration credentials.

Critical values:

| Variable | Purpose |
|---|---|
| `LANDYS_ENV=local` | Enables local boot checks + notification overrides |
| `LOCAL_SUPABASE_PROJECT_REF` | Explicit disposable DEV project allowlist |
| `DATABASE_URL` / `DIRECT_URL` | Dedicated Supabase DEV database |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only DEV Storage credential |
| `LOCAL_NOTIFICATION_EMAIL` | All emails redirect here |
| `LOCAL_NOTIFICATION_PHONE` | All SMS redirect here |
| `AUTH_MODE=clerk` | Real Clerk test-mode authentication |

### 3. Migrate + seed

```bash
pnpm dev:reseed
pnpm dev:storage
```

Destructive commands refuse to run unless:

- `LANDYS_ENV=local`
- pooled/direct/Storage URLs match `LOCAL_SUPABASE_PROJECT_REF`
- the production Supabase project ref is absent
- `AppSetting(environmentName=local)` is present (set by migrate)

## Commands

| Command | What it does |
|---|---|
| `pnpm dev:reseed` | verify isolation, migrate, reset, and seed |
| `pnpm dev:storage` | initialize and smoke-test DEV Storage |
| `pnpm dev` | Start Next on http://localhost:3000 |
| `pnpm dev:wix-intake` | POST controlled Wix fixture to local API |
| `pnpm --filter @workspace/landys-pro test:e2e` | localhost browser smoke |

## Auth (Clerk)

Root `.env` uses `AUTH_MODE=clerk` with `pk_test_` / `sk_test_` keys. Seeded
Admin access is matched from `ADMIN_EMAILS`; a seeded Contractor is claimed by
signing in with the first `LOCAL_CONTRACTOR_EMAILS` address.

Live Clerk keys are refused when `LANDYS_ENV=local`.

## Stripe (test mode)

Root `.env` uses `STRIPE_MOCK=false` with a test-mode key.

Webhook forwarding:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# copy whsec_… into STRIPE_WEBHOOK_SECRET, restart next
```

Flow to exercise: Won → confirm landowner paid → Fee **DUE** → Pay Landy's →
test card `4242…` → Fee **PAID**.

## Email / SMS

When `LANDYS_ENV=local`, every outbound email/SMS is redirected to
`LOCAL_NOTIFICATION_*`. Missing overrides **fail closed** (throw) — real
contractors/landowners are never contacted.

Keep `RESEND_MOCK=true` / `TWILIO_MOCK=true` unless you intentionally want to
receive messages at the override address/phone.

## Wix / Landys.co

Do **not** point production Wix at localhost.

With the app running and `WIX_ESTIMATE_INTEGRATION_ENABLED=true`:

```bash
pnpm dev:wix-intake
```

This POSTs a representative payload to
`/api/integrations/wix/estimate-requests` and exercises validation → taxonomy →
lead → matching → opportunities.

## Seed coverage

- Admin owner row
- 4 contractors across live-v3 categories/work types (wallet = $0)
- Open / accepted / passed / max-acceptance opportunities
- Lost job; Won awaiting payment; Fee Due; Paid (Stripe + manual)
- Confirmations: pending, confirmed, mismatch
- ~12 PAID fees across 90 days for the Success fees collected chart (7d / 30d / 90d)

No wallet transactions, purchase prices, or pay-per-lead tiers.

## Playwright

```bash
pnpm exec playwright install   # once
pnpm test:e2e
```

`playwright.config.ts` defaults to `http://localhost:3000` and refuses
production hostnames.

## Production cleanup (later)

Use the existing operational reset **on Replit only after local approval**:

```bash
pnpm ops:success-fee-reset          # dry-run
pnpm ops:success-fee-reset:execute  # after review
```

That path also refuses obvious production DB fingerprints when possible.
