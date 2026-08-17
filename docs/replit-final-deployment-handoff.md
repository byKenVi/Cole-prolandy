# Replit Final Deployment Handoff — Wix Lead Marketplace

## Commit

**SHA:** `2eaadfb14359210487ca2bf87159cf3795c97730`

Message: `feat: finalize wix sync and lead marketplace flow`

## Migrations

Apply additive migration:

`20260817140000_lead_marketplace_final`

```bash
cd artifacts/landys-pro
npx prisma generate
npx prisma migrate deploy
```

**Do not** run `prisma migrate reset` or `db push` against production.

## New / updated environment variables

```env
# Existing estimate intake
WIX_ESTIMATE_INTEGRATION_ENABLED="true"
WIX_ESTIMATE_API_SECRET="…"

# Contractor sync
WIX_SITE_ID="…"
WIX_API_AUTHORIZATION="…"   # exact header value verified against live Wix
WIX_CONTRACTOR_COLLECTION_ID="AllContractors"

# Cron (existing)
CRON_SECRET="…"

# Supabase private attachments
SUPABASE_URL="…"
SUPABASE_SERVICE_ROLE_KEY="…"
```

## Deprecated settings

- `maxLeadRecipients` — replaced by **`maxLeadPurchases`** (Admin → Settings)
- `defaultLeadTier` — no longer used by intake (budget → tier is automatic)

## Deploy commands

```bash
cd artifacts/landys-pro
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm start
```

## Scheduled jobs

Configure Replit (or external cron) **hourly**:

```http
GET /api/cron/wix-contractor-sync
Authorization: Bearer <CRON_SECRET>
```

Existing lead expiry sweep remains:

```http
GET /api/cron/expire-leads
Authorization: Bearer <CRON_SECRET>
```

## Smoke tests

1. Admin → Contractors → **Sync Wix contractors now** — expect created/updated counts
2. POST Wix estimate with `budgetCents` + optional `attachments[]` — expect auto-route or `budget_review` blocker
3. General lead with 10+ eligible contractors — verify 10+ offers in Admin lead detail
4. Accept lead from 3 contractors — 4th must show sold out, no charge
5. Direct request with Wix `_id` — exactly one offer, `maxPurchases = 1`

## Rollback

- Migration is additive; rollback is code revert + leave new columns unused
- Do **not** delete historical leads, wallet transactions, or identities

## Production validation

- [ ] `npm test` green in CI/local
- [ ] Wix estimate endpoint returns 201/202
- [ ] Contractor sync completes without logging secrets
- [ ] Admin pricing shows tier budget thresholds + lead prices
- [ ] Sold-out magic link shows unavailable state (no charge)
