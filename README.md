# Landy's Pro

The contractor "pro portal" for a directory that connects landowners with land-service contractors. It is a **pay-per-lead engine with a light CRM** — not a marketplace. Money flows **contractor → platform** via a prepaid wallet in exchange for landowner contact info.

**Core loop:** landowner submits an estimate request → becomes a **Lead** → distributed to up to _N_ contractors → each notified contractor **Accepts** or **Declines** → on accept, the lead price is deducted from that contractor's wallet and the landowner's contact info is revealed. **Leads are shared:** multiple contractors can accept the same lead.

> Read [`DESIGN.md`](./DESIGN.md) before touching any UI — it is the single source of truth for look & feel.

---

## Stack

- **Next.js** (App Router, TypeScript strict) + **React 19**
- **PostgreSQL via Supabase**, **Prisma** ORM with tracked **migrations**
- **Tailwind CSS** + shadcn/ui-style components, themed to the land palette
- **Stripe / Twilio / Resend** behind clean interfaces in `lib/integrations/` — **mock by default** (log to console, simulate success). Real keys drop in with zero call-site changes.
- **Auth**: ships in a **dev auth mode** (no keys needed) with a **Clerk** drop-in seam.

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
prisma/                schema, migrations, seed
```

### Engineering guarantees

- **Money is always integer cents.** Convert to dollars only for display via `formatMoney()`.
- **All wallet changes go through `applyWalletTransaction*`** — an atomic, condition-guarded UPDATE (Postgres row lock) that writes a `WalletTransaction` and updates the balance together, and can never produce a negative balance. Nothing else mutates `walletBalanceCents`.
- **Domain logic is pure and testable** (`lib/domain/`): `distributeLead`, `acceptLeadMatch`, `declineLeadMatch`, `chargeForLead`, `refundLeadMatch`, `expireLeads`, `resolvePrice`.
- **Prices are snapshotted** onto the Lead at creation from the `PriceTier` matrix, so later edits don't change existing leads.

---

## Getting started

### 1. Prerequisites

- Node 18.18+ (Node 22 recommended)
- A Supabase project (free tier is fine)

### 2. Install

```bash
npm install
```

### 3. Configure env

Copy the example and fill in your Supabase connection strings:

```bash
cp env.example .env
```

Supabase gives you two strings (Project Settings → Database → Connection string):

- `DATABASE_URL` — the **pooled** connection (port 6543, `?pgbouncer=true&connection_limit=1`), used at runtime.
- `DIRECT_URL` — the **direct** connection (port 5432), used by Prisma migrations.

Everything else can stay as-is for local dev: the integration mocks are on by default (`STRIPE_MOCK`, `TWILIO_MOCK`, `RESEND_MOCK` = `true`).

Additional variables not in `env.example` (all optional, sensible defaults):

- `AUTH_MODE` — `dev` (default) or `clerk`. Dev mode needs no Clerk keys.
- `CRON_SECRET` — if set, the expiry cron endpoint requires `Authorization: Bearer <secret>`.

### 4. Run migrations + seed

```bash
npx prisma migrate deploy   # applies prisma/migrations to your Supabase DB
npm run db:seed             # seeds taxonomy, contractors, leads, pricing
```

(During active schema work use `npm run prisma:migrate` (`prisma migrate dev`) instead of `migrate deploy`.)

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

1. **Admin → New lead**: create a lead (price is snapshotted; it distributes to matching contractors and "sends" SMS + email — check your terminal for the mock output, including the tokenized accept link).
2. Copy the `/accept/<token>` link from the console and open it — the **no-login SMS accept screen**. Accept to charge the wallet and reveal contact.
3. **Contractor view**: switch the dev bar to a contractor of the matching trade to see the lead in their feed, accept/decline, and top up the wallet.
4. **Insufficient balance**: use a low/empty-wallet contractor (e.g. _Lone Star Fencing_ or _Still Waters Ponds_) to see the block + top-up prompt.
5. **Admin → Contractors → Manage**: manually add funds / refund (logged to the audit trail).

---

## Swapping mocks for real services

All integrations read config from env and are selected by a `*_MOCK` flag. Flip the flag to `false` and provide keys — **no call-site changes**.

| Service | Flag | Real provider stub | Install |
| --- | --- | --- | --- |
| Payments | `STRIPE_MOCK=false` | `StripePaymentsProvider` in `lib/integrations/payments.ts` (implemented) | `stripe` (installed) |
| SMS | `TWILIO_MOCK=false` | `TwilioSmsProvider` in `lib/integrations/sms.ts` | `npm i twilio` |
| Email | `RESEND_MOCK=false` | `ResendEmailProvider` in `lib/integrations/email.ts` | `npm i resend` |

For **Stripe**, the wallet is credited only from the verified webhook (`app/api/stripe/webhook/route.ts`) — never from the browser redirect (that redirect is mock-only). SMS/Email still have `TODO(real)` stubs.

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

1. `AUTH_MODE=clerk` and set the Clerk keys in `.env`.
2. Wire `getClerkSession()` in `lib/auth.ts` (there's a documented TODO) to map the Clerk user → `Contractor.clerkUserId` and admin role via `publicMetadata.role`.
3. Add `ClerkProvider` in `app/layout.tsx` and a `middleware.ts` with `clerkMiddleware`, plus `/sign-in` and `/sign-up` routes.
   The tokenized SMS accept flow stays **unauthenticated** by design.

---

## Deploy to Vercel

1. Push to GitHub and import the repo in Vercel.
2. Set env vars (`DATABASE_URL`, `DIRECT_URL`, app URL, and any real keys). Keep `*_MOCK=true` until services are wired.
3. Build command is `npm run build` (runs `prisma generate` first). Migrations run via `npx prisma migrate deploy` — run it against your Supabase DB from CI or locally.
4. Lead expiry: a Vercel Cron hits `/api/cron/expire-leads` (see `vercel.json`). Leads are also swept lazily whenever feeds load, so expiry is correct even without cron.

---

## Catalog & contractor assignment

Hierarchy is **Project → 3 tiers** (lead price by job scale). There is no separate “services” level in the product UI.

**PENDING CLIENT CONFIRMATION**

- Whether a contractor serves **one or multiple** projects.
- Whether contractors ever get **self-service** over which projects they receive.

**Default in this codebase:** multi-project assignment is supported; assignment is **admin-controlled only**. Contractors can edit name / phone / hours / about / logo, but not projects. Lead distribution matches on `ContractorProject` (assigned projects).

---

## Business rules (enforced in code)

1. Leads are **shared**, not exclusive — up to `maxLeadRecipients` (admin-configurable, min 1); all recipients may accept.
2. **Charge on accept**, never on distribution. Declining/ignoring is free.
3. **Never a negative balance** — insufficient funds blocks the accept and prompts top-up.
4. **Prices from the `PriceTier` matrix**, snapshotted at lead creation.
5. **Contact revealed only after acceptance.**
6. **Leads expire** after `leadExpiryHours`; expired matches can't be accepted.

## Phase-two seams (intentionally not built)

Reserved fields / TODOs exist for: Top Pro subscription and its _possible_ effect on lead-matching priority (`isTopPro` exists but does **not** affect distribution — confirm with client first), reviews, Mapbox land mapping, document vault, in-app chat, project management, and durable rate-limiting.
```
