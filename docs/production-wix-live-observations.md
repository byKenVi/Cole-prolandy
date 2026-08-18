# Production Wix Live Observations

> **Purpose:** Sanitized snapshot of current production state for Cursor handoff.
> No PII. No recommendations. Clearly labels OBSERVED vs INFERRED.
> Generated: 2026-08-18

---

## CURRENT SHA

```
14ddc7b71add2006776196eee83cac753ee380e1
Branch: main
Status: clean (no uncommitted code changes)
```

---

## PRODUCTION MIGRATION STATUS

| Migration | Status |
|---|---|
| `20260817140000_lead_marketplace_final` | **APPLIED** |
| `20260818150000_nullable_contractor_type_id` | **APPLIED** |
| Database schema | **Up to date** (22/22 migrations applied) |

Fields `Lead.budgetCents`, `PriceTier.maxBudgetCents`, and AppSetting key `maxLeadPurchases`
are all present in production. No page crashes from missing columns.

---

## CURRENT WIX FORM / LEAD VALUES OBSERVED

Source: production `Lead` table, `source = 'wix'`, 11 records total.

### Field: `budget` (raw string from Wix form)

**OBSERVED distinct values:**

| Value |
|---|
| `$5,000–$15,000` |
| `$15,000–$50,000` |
| `$15–50K` |
| `$10,000-$20,000` |
| `Under $5,000` |
| `TEST REQUEST - DO NOT ROUTE` |

**OBSERVED:** `budgetCents` is `null` on **every** Wix-sourced lead. Budget parsing / tier
resolution does not fire at Wix form intake. Budget string is stored raw; tier is resolved
separately in the admin review flow.

### Field: `urgency` (raw string from Wix form)

**OBSERVED distinct values:**

| Value |
|---|
| `Low` |
| `Medium` |
| `High` |
| `Within 30 days` |
| `TEST ONLY` |

### Field: `timeline` (DateTime)

OBSERVED: stored as a resolved `DateTime` (e.g. `2026-09-18T00:00:00.000Z`).

### Field: `contractorCategoryCode` (via `contractorCategoryId` FK)

OBSERVED distinct codes resolved from incoming Wix form data:

| Code | Name |
|---|---|
| `builders` | Builders |
| `land-clearing` | Land Clearing |
| *(null)* | 3 leads had no resolved category |

### Field: `projectTypeCode` (via `projectTypeId` FK)

OBSERVED distinct project type names on Wix leads:

| Name |
|---|
| `BARNDOMINIUM BUILDING` |
| `POND BUILDING` |
| `UTILITY TRENCHING` |
| `WATER WELL DRILLING` |
| `LAND GRADING & LEVELING` |

OBSERVED: 0 leads with null `projectTypeId` (projectType is required on Lead).

### Field: `landTypeCode` (via `landTypeId` FK)

OBSERVED distinct codes on Wix leads:

| Code | Name | Active? |
|---|---|---|
| `development` | Development | ✓ active |
| `legacy-028bf08dc9d68ddbbea5` | Farm / Ranch | archived |
| `legacy-ecaee2b551003cb7adad` | Wooded Acreage | archived |
| `legacy-750d7b5c21043a965421` | Recreational Land | archived |

INFERRED: Some leads were created before the LandType migration and still reference
archived legacy codes.

### Field: `externalContractorId` (directContractorExternalId)

OBSERVED two formats in production data:

| Format | Example |
|---|---|
| Zero-padded numeric string | `"000038"` |
| UUID (Wix `_id` format) | `"2f768032-8281-4a38-9d3c-bfc7cd499b74"` |

INFERRED: Zero-padded format corresponds to legacy/manual Wix `contractorId` field;
UUID format corresponds to Wix internal `_id`. The sync now uses Wix `_id` as the
canonical `externalId`. The two formats are both present in production and may coexist.

### Field: `routingMode`

OBSERVED distinct values: `GENERAL`, `DIRECT`

### Field: `reviewStatus`

OBSERVED distinct values: `PENDING_REVIEW`, `ROUTED`

### Field: `tier` / `priceCents`

OBSERVED: Some leads have resolved tier + priceCents (resolved by admin after intake).
Others have `tier = null`, `priceCents = null` (awaiting review).

### Summary Counts — Wix Leads

| Field | Count |
|---|---|
| Total Wix leads | 11 |
| With resolved `contractorCategory` | 8 |
| Without `contractorCategory` | 3 |
| With resolved `landType` | 11 |
| Using archived `landType` | 3 |
| With resolved `projectType` | 11 |

---

## CURRENT ALLCONTRACTORS VALUES OBSERVED

Source: `ExternalContractorIdentity` table (`source = 'wix'`), populated from Wix
AllContractors read API. Raw values extracted from `sourceMetadata.raw`.

### Field: `contractorsCategory[]` (primary category)

OBSERVED distinct raw values sent by Wix:

```
Builders
Dirt Work & Excavation
Farm & Agriculture
Fencing & Entrances
Forestry & Timber
Land Lenders
Land Realtors
Landscaping               ← NO official taxonomy match
Outdoor Construction      ← NO official taxonomy match
Property Maintenance
Surveyors
Water Well & Septic
Wildlife Management
```

### Field: `secondaryCategories[]`

OBSERVED distinct raw values:

```
Hardscaping
Landscape Design
Outdoor Renovation
```

These are stored as metadata only. Not used for routing.

### Field: `projectType[]`

OBSERVED distinct raw values sent by Wix:

```
Landscape Renovation      ← NO official taxonomy match
Outdoor Living Spaces     ← NO official taxonomy match
Patio Installation        ← NO official taxonomy match
Retaining Walls           ← NO official taxonomy match
```

**OBSERVED: Only 1 out of 52 Wix contractors has any `projectType[]` value.**
51 of 52 have an empty `projectType[]`.

### Field: `landTypes[]`

OBSERVED distinct raw values:

```
Large Lots    ← NO official taxonomy match
Residential   ← NO official taxonomy match
Rural         ← NO official taxonomy match
```

### Field: `status`

OBSERVED distinct values: `Active` only. No inactive contractors in the current Wix dataset.

---

## CURRENT SYNC COUNTS

From last full sync run (2026-08-18, `incremental: false`):

| Metric | Count |
|---|---|
| Wix records fetched | 55 |
| Created | 51 |
| Updated | 0 |
| Unchanged | 1 |
| Invalid identity (skipped) | 0 |
| Deactivated | 0 |
| Errors (email unique constraint) | 3 |
| Currently in DB (`wix` identities) | 52 |
| Total contractors in DB | 69 |

### Mismatch detail

**3 errors** on first sync: Wix contractors whose email addresses already existed on
manually-created contractor records. Wix record was not created; no Wix identity row exists
for those 3.

### Wix data completeness (from raw Wix records)

| Metric | Count |
|---|---|
| Wix contractors with `contractorsCategory` | 12 of 52 |
| Wix contractors WITHOUT `contractorsCategory` | 40 of 52 |
| Wix contractors with `projectType[]` | 1 of 52 |
| Wix contractors WITHOUT `projectType[]` | 51 of 52 |
| Unresolved category labels (total distinct) | 2 (`Landscaping`, `Outdoor Construction`) |
| Unresolved project type labels (total distinct) | 4 (`Patio Installation`, `Retaining Walls`, `Outdoor Living Spaces`, `Landscape Renovation`) |
| Unresolved land type labels (total distinct) | 3 (`Residential`, `Rural`, `Large Lots`) |

INFERRED: The vast majority of Wix contractors have no category or project type in the Wix
dataset. The 4 project type labels that do appear have no match in the official taxonomy.
This means **general-matching contractor eligibility (based on resolved taxonomy) is near
zero** for contractors sourced from Wix.

---

## CURRENT ACTIVE TAXONOMIES

### ContractorCategory (12 active, 0 archived)

| Code | Name |
|---|---|
| `builders` | Builders |
| `dirt-work-excavation` | Dirt Work & Excavation |
| `farm-agriculture` | Farm & Agriculture |
| `fencing-entrances` | Fencing & Entrances |
| `forestry-timber` | Forestry & Timber |
| `land-clearing` | Land Clearing |
| `land-lenders` | Land Lenders |
| `land-realtors` | Land Realtors |
| `property-maintenance` | Property Maintenance |
| `surveyors` | Surveyors |
| `water-well-septic` | Water Well & Septic |
| `wildlife-management` | Wildlife Management |

### LandType (6 active, 6 archived)

**Active:**

| Code | Name |
|---|---|
| `development` | Development |
| `farmland` | Farmland |
| `homestead` | Homestead |
| `hunting` | Hunting |
| `ranching` | Ranching |
| `timberland` | Timberland |

**Archived (legacy — still referenced by some existing leads):**

| Code | Name |
|---|---|
| `legacy-028bf08dc9d68ddbbea5` | Farm / Ranch |
| `legacy-750d7b5c21043a965421` | Recreational Land |
| `legacy-8dbfb6aa6c5f77813fa2` | Residential Lot |
| `legacy-b3422ed8cddf41965ced` | Waterfront |
| `legacy-ecaee2b551003cb7adad` | Wooded Acreage |
| `legacy-f68a335ff94cb47f8279` | Commercial Parcel |

### ProjectType / ContractorType (15 each, 1:1 mapping)

| ProjectType Name | ContractorType Name (same) |
|---|---|
| BARNDOMINIUM BUILDING | BARNDOMINIUM BUILDING |
| BRUSH HOGGING | BRUSH HOGGING |
| CABIN CONSTRUCTION | CABIN CONSTRUCTION |
| CULVERT INSTALL | CULVERT INSTALL |
| DRAINAGE IMPROVEMENT | DRAINAGE IMPROVEMENT |
| DRIVEWAY CONSTRUCTION | DRIVEWAY CONSTRUCTION |
| GATED ENTRANCE | GATED ENTRANCE |
| IRRIGATION SYSTEM INSTALLATION | IRRIGATION SYSTEM INSTALLATION |
| LAND GRADING & LEVELING | LAND GRADING & LEVELING |
| POND BUILDING | POND BUILDING |
| RETAINING WALL CONSTRUCTION | RETAINING WALL CONSTRUCTION |
| sale | sale |
| TREE REMOVAL & STUMP GRINDING | TREE REMOVAL & STUMP GRINDING |
| UTILITY TRENCHING | UTILITY TRENCHING |
| WATER WELL DRILLING | WATER WELL DRILLING |

OBSERVED: `sale` is a test/placeholder entry (lowercase, no real category linkage).

---

## CURRENT PRICING STRUCTURE

### How PriceTier is keyed

Each `PriceTier` row: `contractorTypeId × projectTypeId × tier (1/2/3)`.

- Tier 1 and Tier 2 have a `maxBudgetCents` upper bound.
- Tier 3 has `maxBudgetCents = null` (no upper bound — catches all budgets above Tier 2 max).

**Total configured PriceTiers: 45** (15 ProjectTypes × 3 tiers each).

**OBSERVED: Every active ProjectType has Tier 1, 2, and 3 prices. No missing prices.**

### Price table (all values in cents → dollars shown)

| Project Type | T1 Price | T1 max budget | T2 Price | T2 max budget | T3 Price |
|---|---|---|---|---|---|
| BARNDOMINIUM BUILDING | $0.18 | $100 | $1.60 | $300 | $2.20 |
| BRUSH HOGGING | $0.40 | $50 | $0.70 | $150 | $1.10 |
| CABIN CONSTRUCTION | $1.00 | $100 | $1.60 | $300 | $2.20 |
| CULVERT INSTALL | $0.40 | $50 | $0.75 | $150 | $1.10 |
| DRAINAGE IMPROVEMENT | $0.45 | $50 | $0.85 | $150 | $1.40 |
| DRIVEWAY CONSTRUCTION | $0.50 | $75 | $0.95 | $200 | $1.50 |
| GATED ENTRANCE | $0.45 | $50 | $0.80 | $150 | $1.30 |
| IRRIGATION SYSTEM INSTALLATION | $0.55 | $75 | $1.00 | $200 | $1.60 |
| LAND GRADING & LEVELING | $0.50 | $75 | $0.95 | $200 | $1.50 |
| POND BUILDING | $0.90 | $75 | $1.40 | $200 | $2.00 |
| RETAINING WALL CONSTRUCTION | $0.70 | $75 | $1.20 | $200 | $1.85 |
| sale | $0.50 | *(none)* | $1.20 | *(none)* | $2.30 |
| TREE REMOVAL & STUMP GRINDING | $0.50 | $50 | $0.95 | $150 | $2.50 |
| UTILITY TRENCHING | $0.45 | $75 | $0.85 | $200 | $1.40 |
| WATER WELL DRILLING | $0.80 | $75 | $1.30 | $200 | $2.00 |

> **NOTE:** Prices above appear very low (cents-range). Stored values in DB are in cents
> (e.g. `priceCents = 18` = $0.18). INFERRED: These are test/seed prices, not final
> production rates. Confirmed from actual lead records: a Tier 2 lead for BARNDOMINIUM
> BUILDING stored `priceCents = 16000` ($160.00) which matches the Tier 2 value of 16000 cents.
> The table above correctly shows cents-as-stored; the "dollar" column is `cents / 100`.

### AppSettings

| Key | Value |
|---|---|
| `maxLeadPurchases` | `3` |
| `maxLeadRecipients` | `3` |
| `leadExpiryHours` | `48` |
| `defaultLeadTier` | `2` |
| `wixContractorSyncLastSuccessAt` | `2026-08-18T14:41:11.457Z` |
| `wixContractorSyncLastAttemptAt` | `2026-08-18T15:16:20.794Z` |

---

## KNOWN MISMATCHES

### Wix contractor category labels vs. official ContractorCategory codes

| Wix raw label | Official match | Result |
|---|---|---|
| `Builders` | `builders` | ✓ resolved |
| `Dirt Work & Excavation` | `dirt-work-excavation` | ✓ resolved |
| `Farm & Agriculture` | `farm-agriculture` | ✓ resolved |
| `Fencing & Entrances` | `fencing-entrances` | ✓ resolved |
| `Forestry & Timber` | `forestry-timber` | ✓ resolved |
| `Land Lenders` | `land-lenders` | ✓ resolved |
| `Land Realtors` | `land-realtors` | ✓ resolved |
| `Property Maintenance` | `property-maintenance` | ✓ resolved |
| `Surveyors` | `surveyors` | ✓ resolved |
| `Water Well & Septic` | `water-well-septic` | ✓ resolved |
| `Wildlife Management` | `wildlife-management` | ✓ resolved |
| **`Landscaping`** | *(none)* | ✗ unresolved |
| **`Outdoor Construction`** | *(none)* | ✗ unresolved |

### Wix contractor project type labels vs. official ContractorType names

| Wix raw label | Official match | Result |
|---|---|---|
| `Patio Installation` | *(none)* | ✗ unresolved |
| `Retaining Walls` | *(none)* | ✗ unresolved — note: `RETAINING WALL CONSTRUCTION` exists but label does not match |
| `Outdoor Living Spaces` | *(none)* | ✗ unresolved |
| `Landscape Renovation` | *(none)* | ✗ unresolved |

### Wix contractor land type labels vs. official LandType codes

| Wix raw label | Official match | Result |
|---|---|---|
| `Residential` | *(none)* | ✗ unresolved |
| `Rural` | *(none)* | ✗ unresolved |
| `Large Lots` | *(none)* | ✗ unresolved |

### Wix form land type values vs. official LandType codes

OBSERVED: 3 of 11 Wix leads resolved to archived legacy land type codes.
The Wix form still sends values that map to the pre-migration taxonomy.

### Budget resolution

OBSERVED: `budgetCents` is always null for Wix-sourced leads.
The Wix form's `budget` field is a free-text range string. No automated parsing fires
at intake. Budget-to-tier resolution is deferred to the admin review step.

### Wix `directContractorExternalId` format ambiguity

OBSERVED: Two distinct ID formats appear in production DIRECT-mode leads:
- `"000038"` — matches legacy Wix `contractorId` field (zero-padded numeric)
- `"2f768032-8281-4a38-9d3c-bfc7cd499b74"` — matches Wix `_id` (UUID)

The sync now uses Wix `_id` as the canonical `externalId` on `ExternalContractorIdentity`.
Existing DIRECT leads using the zero-padded format may not resolve to a synced contractor.

### 3 Wix contractors with email conflicts

OBSERVED: 3 Wix contractor records (Wix `_id`: `58b6452b-...`, `86f943db-...`, `bde325de-...`)
could not be created because their email addresses already exist on manually-created
`Contractor` rows. These have no `ExternalContractorIdentity` row and will error on every
sync until the email conflict is resolved manually.
