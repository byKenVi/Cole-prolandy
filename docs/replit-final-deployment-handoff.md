# Replit Final Deployment Handoff — Wix Lead Marketplace

## Commit

**SHA:** `2eaadfb14359210487ca2bf87159cf3795c97730`

Message: `feat: finalize wix sync and lead marketplace flow`

## Migrations

Apply additive migrations (in order):

1. `20260817140000_lead_marketplace_final`
2. `20260818150000_nullable_contractor_type_id` (if not already applied)
3. **`20260818180000_live_wix_taxonomy_v3`** — live categories, work types, budget bands, band→tier defaults

```bash
cd artifacts/landys-pro
npx prisma generate
npx prisma migrate deploy
```

See `docs/live-wix-taxonomy-v3.md` for taxonomy and matching rules.

**Post-migrate:** configure **`WorkTypePriceTier`** prices in Admin → Pricing. Placeholder rows (`priceCents = 0`) block live lead routing with `PRICING_REQUIRED` until set.

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
2. POST Wix estimate with budget band label (`Under $5K`) or `budgetCents` — expect auto-route when pricing configured, else `pricing_review` or `budget_review`
3. General lead with category + eligible contractors — verify category-matched offers (work-type specialists + category generalists)
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
