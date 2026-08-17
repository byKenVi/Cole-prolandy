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

- **Required going forward:** `budgetCents` (integer cents, e.g. `1000000` = $10,000)
- **Compatibility:** plain `budget` text is parsed only for unambiguous single amounts (`$5,000`, `5000`, `5000.00`)
- **Rejected:** ranges, fuzzy language (`10k`, `around`, `not sure`)

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
- **Categories:** use official Landy's labels in `contractorsCategory[]` (exact normalized match)
- **Project types:** use official labels in `projectType[]` (exact normalized match)
- **Status:** `Active` / inactive semantics — inactive contractors are soft-deactivated locally (financial data preserved)

## Out of scope

- Generic Wix Contact Form endpoint

## Landy's Pro responsibilities

- Lead distribution
- First-N purchase enforcement (concurrency-safe)
- Wallet charging / Stripe
- Admin pricing & budget tier thresholds
- Attachment ingestion & access control
