# Landy's Pro

The contractor "pro portal" for a directory that connects landowners with land-service contractors. It is a **pay-per-lead engine with a light CRM** — not a marketplace. Money flows **contractor → platform** via a prepaid wallet in exchange for landowner contact info.

**Core loop:** landowner submits an estimate request → becomes a **Lead** → distributed to up to _N_ contractors → each notified contractor **Accepts** or **Declines** → on accept, the lead price is deducted from that contractor's wallet and the landowner's contact info is revealed. **Leads are shared:** multiple contractors can accept the same lead.

> Read [`DESIGN.md`](./DESIGN.md) before touching any UI — it is the single source of truth for look & feel.

---

## Stack

- **Next.js** (App Router, TypeScript strict) + **React 19**
- **PostgreSQL via Supabase**, **Prisma** ORM with tracked **migrations**
- **Tailwind CSS** + shadcn/ui-style components, themed to the land palette
- **Stripe / Twilio / Resend** behind tested provider interfaces; production
  deployment checks refuse mock mode.
- **Auth**: Clerk in production, with an isolated no-key dev mode for local work.

---

## Project structure

```
app/
  (contractor)/        contractor screens: home, leads/[id], wallet, profile
  accept/[token]/      tokenized SMS accept screen (no login)
  admin/               leads, contractors, view-as, pricing, settings
  estimate/            public landowner estimate form (the Wix boundary)
  api/estimate/        POST intake endpoint
  api/stripe/webhook/  real top-up source of truth (mock-aware)
  api/cron/expire-leads/  expiry sweep (Vercel Cron)
  actions/             server actions (leads, wallet, admin, onboarding, dev)
lib/
  domain/              PURE business logic (no Next imports) + unit tests
  integrations/        payments/sms/email interfaces + mock & real providers
  services/            lead-intake pipeline (create + distribute + notify)
  money.ts, auth.ts, notifications.ts, prisma.ts, ...
components/            UI primitives + domain components
prisma/                schema and immutable migrations
```

### Engineering guarantees

- **Money is always integer cents.** Convert to dollars only for display via `formatMoney()`.
- **All wallet changes go through `applyWalletTransaction*`** — an atomic, condition-guarded UPDATE (Postgres row lock) that writes a `WalletTransaction` and updates the balance together, and can never produce a negative balance. Nothing else mutates `walletBalanceCents`.
- **Domain logic is pure and testable** (`lib/domain/`): `distributeLead`, `acceptLeadMatch`, `declineLeadMatch`, `chargeForLead`, `refundLeadMatch`, `expireLeads`, `resolvePrice`.
- **Prices are snapshotted** onto the Lead at creation from the `PriceTier` matrix, so later edits don't change existing leads.

---

## Getting started

### 1. Prerequisites

- Node 22
- A Supabase project (free tier is fine)

### 2. Install

```bash
npm install
```

### 3. Configure env

Copy the example and fill in your Supabase connection strings:

```bash
cp .env.example .env
```

Supabase gives you two strings (Project Settings → Database → Connection string):

- `DATABASE_URL` — the **pooled** connection (port 6543, `?pgbouncer=true&connection_limit=1`), used at runtime.
- `DIRECT_URL` — the **direct** connection (port 5432), used by Prisma migrations.

Everything else can stay as-is for local dev: the integration mocks are on by default (`STRIPE_MOCK`, `TWILIO_MOCK`, `RESEND_MOCK` = `true`).

### 4. Run migrations

```bash
npx prisma migrate deploy
```

Business data is not seeded. Configure projects, their three prices, land types,
and contractors from Admin Settings. During schema work use
`npm run prisma:migrate`.

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000. Use the **Dev bar** at the top to switch between **Contractor** and **Admin**, pick the active contractor, or (as admin) **View as** any contractor.

### 6. Tests

```bash
npm test
```

Covers the money + lead logic: `applyWalletTransaction`, `chargeForLead`, insufficient-balance block, refund, shared-lead multi-accept, idempotent accept, decline rules, and expiry.

---

## Try the full loop

1. **Admin → Settings**: create a project with all three lead prices, add land
   types, then create and assign a contractor.
2. **Admin → New lead**: create a lead; its price is snapshotted and notifications
   are sent to matching contractors.
3. Open the tokenized accept link from the SMS/email. Accept to charge the
   wallet and reveal contact.
4. **Admin → Contractors → Manage**: manually add funds / refund (logged to the audit trail).

---

## Swapping mocks for real services

All integrations read config from env and are selected by a `*_MOCK` flag. Flip the flag to `false` and provide keys — **no call-site changes**.

| Service | Flag | Production provider |
| --- | --- | --- | --- |
| Payments | `STRIPE_MOCK=false` | Stripe Checkout + verified webhook |
| SMS | `TWILIO_MOCK=false` | Twilio |
| Email | `RESEND_MOCK=false` | Resend |

For **Stripe**, the wallet is credited only from the verified webhook
(`app/api/stripe/webhook/route.ts`) — never from the browser redirect.

### Stripe payments — real mode & local testing

Payments are **fully implemented** (`lib/integrations/payments.ts` + `lib/services/stripe-webhook.ts`). All dev/testing uses **Stripe TEST MODE** — no real money is ever moved. Live keys (`sk_live_`) are only swapped in at launch.

**1. Use test keys in `.env`:**

```
STRIPE_MOCK="false"
STRIPE_SECRET_KEY="sk_test_..."         # from Stripe Dashboard → Developers → API keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."       # from `stripe listen`, see below
```

Leave `STRIPE_MOCK="true"` (the default) to develop with no keys at all — top-ups are simulated and credited by the mock-complete route.

**2. Test cards** (any future expiry, any CVC, any ZIP):

| Card | Result |
| --- | --- |
| `4242 4242 4242 4242` | Payment succeeds |
| `4000 0000 0000 0002` | Generic decline |
| `4000 0000 0000 9995` | Insufficient funds decline |

**3. Test webhooks locally with the Stripe CLI:**

```bash
stripe login
# Forward events to the local webhook and print a signing secret:
stripe listen --forward-to localhost:3000/api/stripe/webhook
# → copy the printed whsec_... into STRIPE_WEBHOOK_SECRET, then restart `npm run dev`

# Simulate a successful top-up:
stripe trigger checkout.session.completed
```

**4. Prove the idempotency guard.** Fire the **same event twice** and confirm the wallet is credited **only once**:

```bash
stripe trigger checkout.session.completed   # credits once
stripe trigger checkout.session.completed   # a NEW event → credits again (different payment)
```

To replay the *exact same* event id (a true duplicate, as Stripe retries do), resend it from the CLI/Dashboard event log — the second delivery is deduped via the `ProcessedStripeEvent` table (unique event id) and the unique `stripePaymentIntentId`, so the balance does not change. This is covered by `lib/services/stripe-webhook.test.ts`.

The flow: contractor picks a preset ($50/$100/$250) or custom amount (min $10, max $10,000) → Stripe Checkout Session (customer created on first top-up, id stored on `Contractor`) → success redirect shows a pending state → **webhook credits the wallet**. Never credited on the redirect.

### Enabling Clerk auth

1. Set `AUTH_MODE=clerk`, the Clerk keys, and `ADMIN_EMAILS`.
2. Configure Clerk's allowed/callback domains for the deployed hostname.
3. Restart/rebuild after changing auth variables because middleware reads them
   at build time. The tokenized SMS accept flow stays unauthenticated by design.

---

## Deploy to Vercel

1. Push to GitHub and import the repo in Vercel.
2. Set every production variable from `.env.example`; all `*_MOCK` values must be `false`.
3. Build command is `npm run build` (runs `prisma generate` first). Migrations run via `npx prisma migrate deploy` — run it against your Supabase DB from CI or locally.
4. Lead expiry: a Vercel Cron hits `/api/cron/expire-leads` (see `vercel.json`). Leads are also swept lazily whenever feeds load, so expiry is correct even without cron.

---

## Run and deploy on Replit (without framework conversion)

This repository contains a committed `.replit`, `replit.nix`, `replit.md`, and
authoritative Agent instructions. They pin the app to **Next.js + Node 22** and
prevent Replit Agent from replacing it with a generic React/Vite project.

### One-time import

1. In Replit, choose **Import → GitHub** and select this repository. Do not
   create a React template and do not ask Agent to rebuild the project.
2. Keep the repository root unchanged. Replit must detect `.replit` and run
   `npm ci`; if it generates `src/main.jsx`, `vite.config.*`, or another app,
   cancel the change and re-import from GitHub.
3. Add all production values from `.env.example` in **Replit Secrets**. Never
   upload or commit `.env`. Do not define `NODE_ENV`; Next.js sets it.
4. Set `NEXT_PUBLIC_APP_URL` to the final HTTPS Replit/custom-domain URL.
5. Run `npm run deploy:check` in the Replit shell. It fails early and lists
   missing variable names without printing secret values.
6. Use the **Run** button for development. It runs the existing Next.js app on
   `0.0.0.0:3000`.

### Publish

- Choose **Autoscale** (recommended) or **Reserved VM**, never Static
  Deployment: the app requires Server Actions, API routes, auth, webhooks, and
  database access.
- Build: `npm ci && npm run replit:build`
- Run: `npm run replit:start`
- The build applies committed Prisma migrations to the external Supabase
  database and then runs `next build`.
- Contractor logos use Supabase Storage, not Replit's temporary filesystem.
  Add `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY`.
- Update Clerk allowed domains and Stripe's webhook endpoint to
  `https://YOUR_DOMAIN/api/stripe/webhook`, then use the resulting production
  webhook secret in Replit Secrets.
- For lead expiry outside Vercel, add `APP_URL` and `CRON_SECRET` to GitHub
  Actions repository secrets. `.github/workflows/expire-leads.yml` calls the
  protected endpoint daily.

### Keep local, GitHub, and Replit synchronized

GitHub `main` is the source of truth:

1. Make and test changes locally.
2. Commit and `git push origin main`.
3. In the existing Replit App, open Git and **Pull/Sync**. Do not re-import and
   do not create a second Replit project.
4. Re-run/redeploy only when dependencies, server code, or public build-time
   variables changed. Normal pulled source changes appear in the development
   preview after Next.js reloads.

If changes are also made in Replit, commit and push them before editing the same
files locally; otherwise normal Git merge conflicts can occur.

---

## Catalog & contractor assignment

Hierarchy is **Project → 3 tiers**. Projects, prices, land types, and contractor
assignments are database-backed and managed by admins. Contractors can serve
multiple projects but cannot change their own assignments.

---

## Business rules (enforced in code)

1. Leads are **shared**, not exclusive — up to `maxLeadRecipients` (admin-configurable, min 1); all recipients may accept.
2. **Charge on accept**, never on distribution. Declining/ignoring is free.
3. **Never a negative balance** — insufficient funds blocks the accept and prompts top-up.
4. **Prices from the `PriceTier` matrix**, snapshotted at lead creation.
5. **Contact revealed only after acceptance.**
6. **Leads expire** after `leadExpiryHours`; expired matches can't be accepted.
