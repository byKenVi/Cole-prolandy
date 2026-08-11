# Replit Agent — Landy's Pro Production Deployment Handoff

**This is an existing production deployment. Do not rebuild or re-architect working systems. Your job is deployment/configuration/integration validation.**

---

## A. EXACT SOURCE VERSION

| Item | Value |
|---|---|
| GitHub repository | `https://github.com/byKenVi/Cole-prolandy.git` |
| Branch | `main` |
| Minimum integration commit | `3819f0a24b050cd0e1d093e141284cfe3fe44c02` (audit fixes + handoff) |
| Deploy procedure | Pull `origin/main` and deploy `HEAD` — verify with `git rev-parse HEAD` |
| Handoff document commit | `f90d336cae71b9c8aafde101c671c4fe90ccba8e` |
| Active application directory | `artifacts/landys-pro/` |
| Package name | `@workspace/landys-pro` |
| Package manager | `pnpm` (workspace monorepo) |
| Lockfile | `pnpm-lock.yaml` (repository root) |
| Node requirement (package.json) | `>=22 <23` |
| Replit module (`.replit`) | `nodejs-24` (runtime may differ from engines field; do not downgrade working Replit Node without operator approval) |

### Directories that are NOT runtime application code

Do **not** treat these as the Landy's Pro app to build, migrate, or modify:

- `.migration-backup/` — historical backup only
- `artifacts/api-server/` — Replit path proxy (forwards unmatched `/api/*` to Next.js on port 21066)
- `artifacts/mockup-sandbox/` — unrelated artifact
- `lib/db/`, `lib/api-*` — workspace libraries not used by Landy's Pro runtime

### Checkout procedure

```bash
git fetch origin
git checkout main
git pull origin main
git rev-parse HEAD
```

**STOP** if `git rev-parse HEAD` is older than `3819f0a24b050cd0e1d093e141284cfe3fe44c02`. Do not deploy from an ambiguous branch state.

---

## B. BEFORE-PULL REPLIT SAFETY

Before pulling GitHub changes, inspect:

1. `git status` — note any uncommitted Replit-only modifications
2. Current deployed HEAD: `git rev-parse HEAD`
3. Replit configuration: `.replit`, `artifacts/landys-pro/.replit-artifact/artifact.toml`, `replit.md`
4. Replit Secrets vs committed `.env.example` variable **names** (never log secret values)

**Do not** blindly run `git reset --hard` over unknown Replit changes.

If Replit contains uncommitted production-specific changes, **STOP and report them** before overwriting anything.

---

## C. DEPENDENCY / BUILD CONFIGURATION

From `artifacts/landys-pro/.replit-artifact/artifact.toml`:

| Step | Command |
|---|---|
| Install (repo root) | `pnpm install` |
| Prisma generate | Runs via `postinstall` on `@workspace/landys-pro`; also runs inside `build` |
| Production build | `pnpm --filter @workspace/landys-pro run build` |
| Production start | `pnpm --filter @workspace/landys-pro run start` |
| Dev | `pnpm --filter @workspace/landys-pro run dev` |
| Production PORT | `21066` (proxied to `/` on Replit) |

Build script (`artifacts/landys-pro/package.json`): `prisma generate && next build`

Start script: `next start -H 0.0.0.0 -p ${PORT:-3000}` with `PORT=21066` in production.

### Replit proxy architecture

- Next.js Landy's Pro listens on **port 21066**
- `artifacts/api-server` may intercept some `/api/*` routes; unhandled API routes are proxied to Next.js (see `.agents/memory/api-server-proxy.md`)
- Wix endpoint path: `/api/integrations/wix/estimate-requests` — must reach Next.js route handler

### Verification commands (from `artifacts/landys-pro/`)

```bash
pnpm test          # vitest run — 25 files
pnpm run typecheck # tsc --noEmit
pnpm run lint      # eslint
pnpm run build     # prisma generate && next build
```

---

## D. ENVIRONMENT VARIABLES

Source of truth: `artifacts/landys-pro/.env.example` and code references.

**Never commit or print secret values.** Configure secrets in Replit Secrets.

### Core

| Variable | Purpose | Client? | Required prod? | Wix? | Notes |
|---|---|---:|---:|---:|---|
| `NEXT_PUBLIC_APP_URL` | Public origin for SMS accept links | Yes | Yes | No | Must be HTTPS in production (`lib/app-url.ts`) |
| `DATABASE_URL` | Pooled Supabase Postgres (port 6543) | No | Yes | No | Runtime queries |
| `DIRECT_URL` | Direct Postgres (port 5432) | No | Yes | No | Prisma migrate/introspect |

### Auth (Clerk)

| Variable | Purpose | Client? | Required prod? | Wix? | Notes |
|---|---|---:|---:|---:|---|
| `AUTH_MODE` | Must be `"clerk"` in production | No | Yes | No | Fail-closed if not clerk in prod |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Yes | Yes | No | |
| `CLERK_PUBLISHABLE_KEY` | Replit-managed publishable key | No | Alt | No | Middleware prefers this over NEXT_PUBLIC |
| `CLERK_SECRET_KEY` | Clerk secret | No | Yes | No | Replit Secret |
| `CLERK_PROXY_URL` | Clerk FAPI proxy | No | Replit prod | No | Already set in `.replit` userenv.production |
| `ADMIN_EMAILS` | Bootstrap admin emails | No | Yes | No | Comma-separated |

### Payments (Stripe)

| Variable | Purpose | Client? | Required prod? | Wix? | Notes |
|---|---|---:|---:|---:|---|
| `STRIPE_MOCK` | `"false"` for real Stripe | No | Yes | No | Production Replit sets `"false"` |
| `STRIPE_SECRET_KEY` | Stripe API secret | No | When not mock | No | Replit Secret |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature | No | When not mock | No | Replit Secret only (not in `.replit` userenv) |

### SMS / Email

| Variable | Purpose | Client? | Required prod? | Wix? | Notes |
|---|---|---:|---:|---:|---|
| `TWILIO_MOCK` | `"false"` for real SMS | No | Yes | No | |
| `TWILIO_ACCOUNT_SID` | Twilio SID | No | When not mock | No | |
| `TWILIO_AUTH_TOKEN` | Twilio token | No | When not mock | No | |
| `TWILIO_FROM` | E.164 sender | No | When not mock | No | |
| `TWILIO_MESSAGING_SERVICE_SID` | Optional A2P MG SID | No | Optional | No | |
| `RESEND_MOCK` | `"false"` for real email | No | Yes | No | |
| `RESEND_API_KEY` | Resend API key | No | When not mock | No | |
| `RESEND_FROM` | Verified from address | No | When not mock | No | |

### Storage

| Variable | Purpose | Client? | Required prod? | Wix? | Notes |
|---|---|---:|---:|---:|---|
| `SUPABASE_URL` | Supabase project URL | No | Yes | No | Contractor logos |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only storage admin | No | Yes | No | Never NEXT_PUBLIC |

### Security

| Variable | Purpose | Client? | Required prod? | Wix? | Notes |
|---|---|---:|---:|---:|---|
| `FORM_SPAM_PROTECTION` | Estimate honeypot/rate limit | No | Forced ON in prod | No | |
| `FORM_RATE_LIMIT_PER_HOUR` | Per-IP estimate limit | No | Recommended | No | Default 10 |
| `CRON_SECRET` | Bearer for `/api/cron/expire-leads` | No | Yes in prod | No | Fail-closed if unset |

### **NEW — Wix estimate integration**

| Variable | Purpose | Client? | Required prod? | Required for Wix? | Notes |
|---|---|---:|---:|---:|---|
| `WIX_ESTIMATE_INTEGRATION_ENABLED` | Feature flag; must be `"true"` to accept Wix POSTs | No | No until go-live | Yes | Default/false = 503 `integration_disabled` |
| `WIX_ESTIMATE_API_SECRET` | Shared bearer secret for server-to-server auth | No | Yes at go-live | Yes | **Replit Secret. No default in production. No fallback.** |

Authentication implementation: `hasValidBearerSecret()` in `lib/integrations/wix/estimate-contract.ts` — compares SHA-256 digests with `timingSafeEqual`.

Header: `Authorization: Bearer <WIX_ESTIMATE_API_SECRET>`

---

## E. DATABASE / PRISMA MIGRATIONS

### Production command

From repository conventions (`artifacts/landys-pro/package.json`):

```bash
cd artifacts/landys-pro
pnpm run prisma:deploy
```

This runs `prisma migrate deploy` — **use this on production**.

**Do NOT** use on production:

- `prisma migrate dev`
- `prisma migrate reset`
- `prisma db push` as a substitute for committed migrations

### HARD STOP before production migrate

Per `docs/integration-open-items.md` — **Production taxonomy migration gate: MANUAL QA REQUIRED**

Before `prisma migrate deploy` against production:

1. Run read-only preflight: `pnpm --filter @workspace/landys-pro run preflight:taxonomy` (requires read-only `DATABASE_URL`)
2. Review legacy taxonomy archival outcomes with operator
3. Confirm approved prices for tiers 1–3 on every activated official project
4. Rehearse on recent redacted backup
5. Verify production backup
6. Obtain explicit operator approval

### New migrations introduced by Wix integration work

| Migration | Purpose |
|---|---|
| `20260810190000_seed_required_app_settings` | Inserts `maxLeadRecipients` (default 3) and `leadExpiryHours` (default 48) with `ON CONFLICT DO NOTHING` |
| `20260810193000_official_taxonomy_bridge` | Adds `code`/`archivedAt` to ProjectType/LandType; creates ContractorCategory; seeds 12/6/14 official codes; archives unmatched legacy rows (non-destructive); preserves legacy FK references |
| `20260810203000_external_contractor_identity` | Creates `ExternalContractorIdentity` table `(source, externalId)` → `Contractor` |
| `20260810213000_safe_lead_intake` | Adds lead review/routing columns; makes tier/price/expiry nullable for pending intake; marks existing leads `ROUTED`; adds `(source, externalRequestId)` unique index |
| `20260810231500_lead_attachment_metadata` | Creates `LeadAttachment` metadata table only — **no upload transport** |

All migrations are additive or archival (no `DELETE FROM`, no `DROP TABLE` on business data). Legacy referenced records are preserved with `legacy-*` codes and `archivedAt` set.

### After migration

```bash
pnpm --filter @workspace/landys-pro run prisma:generate
cd artifacts/landys-pro && npx prisma migrate status
```

Read-only sanity checks:

- Count active ProjectType/LandType/ContractorCategory rows
- Confirm existing leads still have tier/price where previously routed
- Confirm `AppSetting` keys exist

---

## F. OFFICIAL TAXONOMIES

Seeded by migration `20260810193000_official_taxonomy_bridge` (guaranteed after migrate deploy on fresh/additive DB). Display names are admin-editable; **codes are immutable**.

### Contractor categories (12)

| Display name | Code |
|---|---|
| Land Clearing | `land-clearing` |
| Surveyors | `surveyors` |
| Builders | `builders` |
| Dirt Work & Excavation | `dirt-work-excavation` |
| Fencing & Entrances | `fencing-entrances` |
| Water Well & Septic | `water-well-septic` |
| Forestry & Timber | `forestry-timber` |
| Property Maintenance | `property-maintenance` |
| Wildlife Management | `wildlife-management` |
| Farm & Agriculture | `farm-agriculture` |
| Land Lenders | `land-lenders` |
| Land Realtors | `land-realtors` |

### Land types (6)

| Display name | Code |
|---|---|
| Development | `development` |
| Farmland | `farmland` |
| Timberland | `timberland` |
| Ranching | `ranching` |
| Homestead | `homestead` |
| Hunting | `hunting` |

### Project types (14)

| Display name | Code |
|---|---|
| CULVERT INSTALL | `culvert-install` |
| BARNDOMINIUM BUILDING | `barndominium-building` |
| BRUSH HOGGING | `brush-hogging` |
| POND BUILDING | `pond-building` |
| CABIN CONSTRUCTION | `cabin-construction` |
| DRIVEWAY CONSTRUCTION | `driveway-construction` |
| WATER WELL DRILLING | `water-well-drilling` |
| GATED ENTRANCE | `gated-entrance` |
| DRAINAGE IMPROVEMENT | `drainage-improvement` |
| IRRIGATION SYSTEM INSTALLATION | `irrigation-system-installation` |
| RETAINING WALL CONSTRUCTION | `retaining-wall-construction` |
| UTILITY TRENCHING | `utility-trenching` |
| TREE REMOVAL & STUMP GRINDING | `tree-removal-stump-grinding` |
| LAND GRADING & LEVELING | `land-grading-leveling` |

### Legacy records

- Unmatched legacy ProjectType/LandType rows receive `archivedAt` and `legacy-<hash>` codes — **not deleted**
- Legacy rows remain referenced by historical leads but are **rejected for new intake** (`archivedAt: null` filter)
- Do not delete old referenced records

---

## G. WIX ESTIMATE ENDPOINT (implementation reference)

| Property | Value |
|---|---|
| Method | `POST` |
| Path | `/api/integrations/wix/estimate-requests` |
| Full URL | `{NEXT_PUBLIC_APP_URL}/api/integrations/wix/estimate-requests` |
| Content-Type | `application/json` (required; else 415) |
| Feature flag | `WIX_ESTIMATE_INTEGRATION_ENABLED=true` (else 503) |
| Auth | `Authorization: Bearer <WIX_ESTIMATE_API_SECRET>` (else 401) |
| Handler | `app/api/integrations/wix/estimate-requests/route.ts` |
| Business logic | `createOfficialEstimateRequest()` in `lib/services/lead-intake.ts` |

### Request schema (strict JSON — extra keys rejected)

**Required:** `source`, `externalRequestId`, `email`, `propertyZip`, `landTypeCode`, `projectTypeCode`, `budget`, `timeline`, `urgency`, `description`

**Optional:** `firstName`, `lastName`, `phone`, `contractorCategoryCode` (nullable)

**Conditional:** `externalContractorId` — required when `source` is `direct-contractor-profile-request`; prohibited when `source` is `general/get-three-estimates`

**Source values:**

- `general/get-three-estimates` — general matching after admin tier review
- `direct-contractor-profile-request` — direct contractor routing

**Taxonomy:** only active (`archivedAt IS NULL`) codes accepted; unknown → 422 `invalid_reference`

### Idempotency

- Key: `(source="wix", externalRequestId)` unique in database
- Payload hash: SHA-256 of canonical JSON from validated Zod output (`wixEstimatePayloadHash`)
- Identical retry → 202 with `replay: true`, same `leadId`
- Same `externalRequestId` with different payload → 409 `idempotency_conflict`

### Tier / routing behavior at intake

- Lead created with `tier: null`, `priceCents: null`, `reviewStatus: PENDING_REVIEW`, `tierReviewRequired: true`
- **No** automatic tier assignment from budget/urgency
- **No** contractor matching, notifications, expiry, or charges at intake
- Admin assigns tier via `finalizeLeadReview()` → `finalizeLeadForRouting()`

### Direct contractor behavior

- Maps via `ExternalContractorIdentity` where `source="wix"` and `externalId=externalContractorId`
- Unresolved/deactivated contractor → held with `contractorReviewRequired: true`; **never** falls back to general matching
- Resolved active contractor → single match on finalize

### HTTP responses

| Status | Code | When |
|---:|---|---|
| 202 | — | Created or idempotent replay |
| 400 | `invalid_json` | Malformed JSON |
| 401 | `unauthorized` | Bad/missing bearer |
| 409 | `idempotency_conflict` | Same externalRequestId, different payload |
| 415 | `unsupported_media_type` | Not application/json |
| 422 | `validation_error` | Zod failure (includes `issues[]`) |
| 422 | `invalid_reference` | Unknown/inactive taxonomy |
| 500 | `internal_error` | Unexpected failure |
| 503 | `integration_disabled` | Feature flag off |

Success body:

```json
{
  "ok": true,
  "data": {
    "leadId": "…",
    "replay": false,
    "reviewStatus": "pending_review",
    "blockers": ["tier_review"]
  }
}
```

OpenAPI: `docs/openapi/wix-landys-pro.yaml` v1.1.0

---

## H. WIX DEVELOPER DOCUMENTATION DELIVERABLE

After production deployment succeeds, produce a **final Wix developer handoff** using the **actual production base URL** (`NEXT_PUBLIC_APP_URL`). Do not ask the Wix developer to inspect Landy's Pro source code.

Include all sections below (use `{PRODUCTION_BASE_URL}` placeholder until URL confirmed):

### 1. Production base URL

`{PRODUCTION_BASE_URL}` — e.g. `https://cole-prolandy-project.replit.app`

### 2. Estimate request endpoint

- **Method:** POST
- **URL:** `{PRODUCTION_BASE_URL}/api/integrations/wix/estimate-requests`
- **Purpose:** Persist estimate request for admin tier review before routing

### 3. Authentication

```
Authorization: Bearer <shared-secret>
```

TECHMA/Landy's Pro operator privately provides the production secret. **Never** publish the secret in documentation.

### 4. Headers

```
Content-Type: application/json
Authorization: Bearer <shared-secret>
```

### 5–7. Request schema / required vs optional / taxonomy codes

See section G and `docs/wix-estimate-integration.md`.

### 8. Source values

- `general/get-three-estimates`
- `direct-contractor-profile-request`

### 9. General example

```bash
curl -sS -X POST "{PRODUCTION_BASE_URL}/api/integrations/wix/estimate-requests" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SECRET_HERE" \
  -d '{
    "source": "general/get-three-estimates",
    "externalRequestId": "estimate-2026-000123",
    "firstName": "Jordan",
    "lastName": "Lee",
    "phone": "+15125550100",
    "email": "jordan@example.com",
    "propertyZip": "78701",
    "contractorCategoryCode": "builders",
    "landTypeCode": "development",
    "projectTypeCode": "culvert-install",
    "budget": "$10,000-$20,000",
    "timeline": "2026-10-01",
    "urgency": "Within 30 days",
    "description": "Install a new culvert at the main property entrance."
  }'
```

### 10. Direct contractor example

Only use when a real `ExternalContractorIdentity` mapping exists in production:

```bash
curl -sS -X POST "{PRODUCTION_BASE_URL}/api/integrations/wix/estimate-requests" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SECRET_HERE" \
  -d '{
    "source": "direct-contractor-profile-request",
    "externalRequestId": "direct-2026-000456",
    "email": "jordan@example.com",
    "propertyZip": "78701",
    "landTypeCode": "development",
    "projectTypeCode": "culvert-install",
    "budget": "$10,000-$20,000",
    "timeline": "2026-10-01",
    "urgency": "Within 30 days",
    "description": "Direct request for mapped contractor.",
    "externalContractorId": "KNOWN_WIX_CONTRACTOR_ID"
  }'
```

### 11. externalContractorId semantics

Must match `ExternalContractorIdentity.externalId` where `source="wix"`. Unmapped IDs create a held lead — no general matching fallback.

### 12. externalRequestId / idempotency

- Retries with identical JSON → same `leadId`, `replay: true`
- Same ID, different payload → 409
- Do not reuse IDs across different business intents (source is included in payload hash)

### 13–14. Success and error responses

Document all status codes from section G.

### 15. Retry policy

- Safe to retry identical payloads on network failure (idempotent)
- Do not retry 409 conflicts without fixing payload
- Do not retry 422 validation/reference errors without correction

### 16. Tier behavior

**Automatic Tier 1/2/3 assignment is NOT implemented.** All Wix requests enter manual admin tier review. Budget text is stored but not used for tier inference.

### 17. Direct contractor behavior

Direct requests never fall back to unrelated general matching.

### 18. File upload status

**Attachment transport is not yet part of the production integration contract.** JSON-only; attachment fields are rejected.

### 19. Testing procedure

Run: authenticated general request, idempotent retry, invalid secret (401), invalid taxonomy (422), intentional 409 conflict, direct request only if safe test external ID exists.

### 20. Production go-live checklist for Wix developer

- [ ] Operator enabled `WIX_ESTIMATE_INTEGRATION_ENABLED=true`
- [ ] Production secret received privately
- [ ] Active taxonomy codes confirmed with operator
- [ ] General request + retry tested
- [ ] Conflict case tested
- [ ] Direct routing tested only with known mapped ID

---

## I. WIX CONTRACTOR SYNCHRONIZATION REQUIREMENTS

Status in code: foundation **IMPLEMENTED**; live Wix HTTP adapter **NOT IMPLEMENTED** (`docs/wix-contractor-sync-requirements.md`)

Request from Wix developer (capabilities/information — not assumed to exist):

- API base endpoint and authentication
- Stable contractor external ID field
- List/retrieval mechanism with pagination
- Active/deactivated state if available
- Change detection (webhook or updated-since)
- Profile fields, categories, project/service data, service area, media

### Landy's Pro protected fields (must never be overwritten by sync)

From `PROTECTED_CONTRACTOR_FIELDS` in `lib/integrations/contractors/contract.ts`:

- `walletBalanceCents`, Stripe customer/card fields
- `clerkUserId`, `isPro`
- Wallet transactions, lead matches, pricing snapshots, promo/refund history, audit logs

---

## J. DEPLOYMENT TESTS

Run from `artifacts/landys-pro/`:

```bash
pnpm test
pnpm run typecheck
pnpm run lint
pnpm run build
```

### Production smoke tests (record PASS/FAIL/NOT TESTED)

**Admin:** login, dashboard, pricing, project types, contractor categories, land types, lead review queue, settings (`maxLeadRecipients`)

**Public estimate:** `/estimate` loads; DB-backed active taxonomies; submit test request if policy allows

**Contractor:** login, dashboard, lead feed, pre-purchase masking, wallet, accepted-lead contact reveal

**Financial:** Do not create random production charges. Use established Stripe test/safe procedures only.

**Wix API:**

- Missing auth → 401
- Valid authenticated general request → 202
- Idempotent replay → same leadId
- Invalid taxonomy → 422
- Direct flow only with known mapped external ID

---

## K. EXISTING BUSINESS RULES — DO NOT REGRESS

Do **not** alter without explicit operator approval:

- Atomic lead acceptance (`acceptLeadMatch` in `lib/domain/leads.ts`)
- Wallet integer-cent arithmetic (`applyWalletTransactionInTx`)
- Negative-balance protection (guarded debit)
- Stripe webhook idempotency (`creditTopUp`)
- Lead price snapshot immutability after routing
- Contact masking before purchase / reveal after purchase
- Clerk contractor email linkage
- SMS/email notification boundaries
- `maxLeadRecipients` from `AppSetting` (default 3, admin-configurable)

---

## L. KNOWN BLOCKERS / NON-COMPLETED ITEMS

| Item | Status |
|---|---|
| Wix contractor HTTP adapter | NOT IMPLEMENTED — BLOCKED BY WIX |
| Wix attachment transport | NOT IMPLEMENTED — BLOCKED BY WIX |
| Automatic tier assignment from budget | BLOCKED BY BUSINESS RULE — manual admin review |
| Production taxonomy preflight gate | MANUAL QA REQUIRED before migrate |
| Wix production credentials/end-to-end test | MANUAL QA REQUIRED before enabling flag |
| Public file upload on `/estimate` | NOT IMPLEMENTED (UI shows blocked message) |
| `LeadAttachment` metadata model | IMPLEMENTED (internal only, no transport) |

---

## M. FINAL REPLIT REPORT TEMPLATE

End your deployment work with:

```
DEPLOYED COMMIT
- branch: main
- minimum integration SHA: 3819f0a24b050cd0e1d093e141284cfe3fe44c02
- deployed HEAD: (output of git rev-parse HEAD after pull)

CONFIGURATION
- configured: [list]
- missing: [list]

MIGRATIONS
- applied: yes/no
- reason if not:

TEST RESULTS
- pnpm test: [pass/fail + count]
- typecheck: [pass/fail]
- lint: [pass/fail]
- build: [pass/fail]

PRODUCTION SMOKE TESTS
- [each item]: PASS | FAIL | NOT TESTED (reason)

WIX ESTIMATE API
- production URL: [url]
- status: disabled | enabled | tested

WIX DEVELOPER DOCUMENTATION
- [link or attached]

CONTRACTOR SYNC
- foundation: deployed
- external blockers: [list]

OPEN BUSINESS RULES
- tier automation: unresolved

MANUAL ACTIONS REQUIRED
- [owner]: [action]
```

Do not claim "production ready" unless every check that can be performed has passed.

---

## PROHIBITED ACTIONS

Do **not**:

- Redesign or re-architect working systems
- Create a second lead pipeline or pricing engine
- Modify financial logic unnecessarily
- Invent Wix API fields, secrets, upload formats, or tier rules
- Run `prisma migrate reset` on production
- Delete legacy taxonomy rows
- Silently overwrite Replit-only configuration
- Claim tests passed without running them
- Claim blocked external integration is complete

If GitHub repository state conflicts with Replit environment, **STOP and report** before destructive action.
