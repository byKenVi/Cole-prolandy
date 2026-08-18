# Live Wix Taxonomy v3

Current production intake taxonomy for Landy's Pro (August 2026).

## Contractor categories

| Code | Wix label |
|---|---|
| `general-contractor` | General Contractor |
| `roofing` | Roofing |
| `plumbing` | Plumbing |
| `electrical` | Electrical |
| `hvac` | HVAC |
| `landscaping` | Landscaping |
| `flooring` | Flooring |
| `painting` | Painting |
| `kitchen-bath` | Kitchen & Bath |
| `foundation-concrete` | Foundation & Concrete |
| `other` | Other |

API normalization accepts canonical codes **or** exact Wix labels.

## Work types

Stored in `WorkType` (separate from legacy land `ProjectType`).

| Code | Wix label |
|---|---|
| `new-build` | New Build |
| `renovation-remodel` | Renovation / Remodel |
| `repair` | Repair |
| `addition` | Addition |
| `installation` | Installation |
| `maintenance` | Maintenance |
| `inspection` | Inspection |

Wix estimate field remains `projectTypeCode` for compatibility; values normalize to `WorkType`.

## Land types

| Code | Wix label |
|---|---|
| `residential` | Residential |
| `commercial` | Commercial |
| `multi-family` | Multi-family |
| `rural-land` | Rural / Land |

## Budget bands

| Code | Wix labels (examples) |
|---|---|
| `UNDER_5K` | Under $5K, Under $5,000 |
| `BETWEEN_5K_15K` | $5–15K, $5,000–$15,000 |
| `BETWEEN_15K_50K` | $15–50K, $15,000–$50,000 |
| `OVER_50K` | $50K+, Over $50,000 |

Resolution order:

1. Explicit `budgetCents` → infer band → admin-configured band→tier mapping
2. Recognized `budgetBand` / budget label → band→tier mapping
3. Otherwise preserve lead with `BUDGET_RESOLUTION_REQUIRED`

Never fabricate `budgetCents` from a band.

## Timeline

| Code | Wix label |
|---|---|
| `asap` | ASAP |
| `within-2-weeks` | Within 2 weeks |
| `within-1-month` | Within 1 month / Within 30 days |
| `1-3-months` | 1-3 months |
| `3-plus-months` | 3+ months |
| `just-researching` | Just researching |

Legacy date strings (`YYYY-MM-DD`) are still stored on `Lead.timeline`.

## Urgency

| Code | Wix label |
|---|---|
| `emergency` | Emergency |
| `high` | High |
| `medium` | Medium |
| `low` | Low |

Historical free-text urgency values remain on `Lead.urgency`.

## Matching (general leads)

1. **Category required** — contractor must have resolved category matching the lead.
2. **Work type** — if contractor has resolved work types, lead work type must match; if contractor has **no** work types, treat as category generalist.
3. Contractors **without** category: synced, visible in admin, eligible for **direct** profile leads only.
4. **`Other` category** — distribute only to active `other` contractors; if none, hold with `OTHER_CATEGORY_CLASSIFICATION_REQUIRED` (admin may reclassify and redistribute).
5. **First 3 purchases** — unchanged marketplace behavior.
6. **Direct `_id`** — targeted contractor only, `maxPurchases = 1`, no general fallback.

## Pricing

- Legacy land `ProjectType` pricing remains for historical leads.
- Live intake uses `WorkTypePriceTier` (tier 1/2/3 per work type).
- Band→tier mapping is admin-configurable per work type (`BudgetBandTierMapping`).
- Placeholder prices (`priceCents = 0`) block routing with `PRICING_REQUIRED` until Cole configures Admin Pricing.

## Legacy taxonomies

Prior contractor categories, land types, and project types are **archived**, not deleted. Historical leads retain FK references and display correctly.
