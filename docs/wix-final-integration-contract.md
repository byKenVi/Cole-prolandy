# Wix Final Integration Contract

This document describes the **final** Landy's Pro ↔ Wix contract after the lead marketplace implementation.

## Canonical contractor identity

- **Required:** Wix Data Item `_id` (UUID)
- **Send as:** `externalContractorId` on direct estimate requests
- **Stored as:** `ExternalContractorIdentity.externalId` with `source = "wix"`
- **Deprecated aliases:** `contractorId` (CTR-…), `proPortalId` (PP-…) — stored in sync metadata only; may be resolved temporarily with an audit warning

## Estimate intake

**Endpoint:** `POST /api/integrations/wix/estimate-requests`

### General lead (`source: general/get-three-estimates`)

Landy's Pro:

1. Validates payload
2. Resolves `budgetCents` → tier → lead price snapshot
3. Snapshots `maxPurchases` (default 3, admin-configurable)
4. Distributes offers to **all** eligible contractors
5. Allows **first N purchasers** (default 3) to buy access; then lead is `SOLD_OUT`

Wix must **not** implement recipient selection or purchase limits.

### Direct request (`source: direct-contractor-profile-request`)

- `externalContractorId` = Wix `_id`
- `maxPurchases = 1`
- Exactly one contractor offer; no fallback to general matching

### Budget

Resolution order:

1. **`budgetCents`** (integer cents) when provided — maps to band, then admin-configured band→tier
2. **`budgetBand` or recognized band label** in `budget` (e.g. `Under $5K`, `$5,000–$15,000`) — band→tier mapping
3. Otherwise lead is preserved with **`BUDGET_RESOLUTION_REQUIRED`** (no distribution)

**Never** fabricates exact `budgetCents` from a band label.

Legacy compatibility: unambiguous single amounts in `budget` (`$5,000`, `5000.00`) still parse to `budgetCents`.

### Taxonomy (live v3)

See `docs/live-wix-taxonomy-v3.md`. API fields accept **canonical codes or exact Wix labels**:

- `contractorCategoryCode` — 11 live categories (e.g. `roofing`, `General Contractor`)
- `projectTypeCode` — live **work types** (e.g. `repair`, `New Build`) — field name unchanged for Wix compatibility
- `landTypeCode` — `residential`, `commercial`, `multi-family`, `rural-land`
- `timeline` — structured labels (`ASAP`, `Within 2 weeks`, …) or legacy `YYYY-MM-DD`
- `urgency` — `Emergency`, `High`, `Medium`, `Low`

Historical land `ProjectType` values remain valid for legacy leads only.

### Attachments (optional)

```json
"attachments": [
  {
    "downloadUrl": "https://…",
    "fileName": "property-photo.jpg",
    "mimeType": "image/jpeg",
    "sizeBytes": 123456
  }
]
```

- Max **5** files, **20 MB** each, **HTTPS** only
- Landy's Pro downloads server-side into **private** Supabase storage
- Contractors access attachments **after** successful purchase only

## Contractor sync

- **Collection:** `AllContractors`
- **Query:** `POST https://www.wixapis.com/wix-data/v2/items/query`
- **Canonical ID:** `_id`
- **Categories:** live v3 labels in `contractorsCategory[]` (see `docs/live-wix-taxonomy-v3.md`)
- **Work types:** live labels in `projectType[]` normalize to `WorkType` (contractors with no work types are category generalists)
- Taxonomy gaps are field-level diagnostics — they **never** block contractor upsert
- **Status:** `Active` / inactive semantics — inactive contractors are soft-deactivated locally (financial data preserved)

## Out of scope

- Generic Wix Contact Form endpoint

## Landy's Pro responsibilities

- Lead distribution
- First-N purchase enforcement (concurrency-safe)
- Wallet charging / Stripe
- Admin pricing: legacy `ProjectType` matrix + live **`WorkTypePriceTier`** and **`BudgetBandTierMapping`**
- Attachment ingestion & access control
