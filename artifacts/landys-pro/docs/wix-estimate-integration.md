# Wix → Landy's Pro Estimate Integration

**Version:** 1.1.0  
**Endpoint path:** `/api/integrations/wix/estimate-requests`  
**OpenAPI spec:** `docs/openapi/wix-landys-pro.yaml`  
**Status:** Production-ready; feature flag must be enabled by operator before go-live.

---

## 1. Production base URL

```
{PRODUCTION_BASE_URL}
```

Replace with the confirmed production URL provided by the Landy's Pro operator (e.g. `https://cole-prolandy-project.replit.app`). Do not construct the URL yourself — ask the operator.

---

## 2. Estimate request endpoint

| Property | Value |
|---|---|
| Method | `POST` |
| URL | `{PRODUCTION_BASE_URL}/api/integrations/wix/estimate-requests` |
| Purpose | Persist a landowner estimate request for admin tier review before routing to contractors |
| Content-Type | `application/json` (required — any other value returns 415) |
| Feature flag | `WIX_ESTIMATE_INTEGRATION_ENABLED=true` must be set by operator |
| Auth header | `Authorization: Bearer <shared-secret>` |

---

## 3. Authentication

All requests must include a `Bearer` token in the `Authorization` header:

```
Authorization: Bearer <shared-secret>
```

The production secret is provided privately by the Landy's Pro operator. **Never publish the secret in documentation, logs, or source code.**

Requests with a missing or invalid secret return `401 unauthorized`.

---

## 4. Required headers

```
Content-Type: application/json
Authorization: Bearer <shared-secret>
```

---

## 5. Request schema

### Required fields

| Field | Type | Notes |
|---|---|---|
| `source` | string | `"general/get-three-estimates"` or `"direct-contractor-profile-request"` |
| `externalRequestId` | string | Your stable unique identifier for this request — used for idempotency |
| `email` | string | Landowner email address |
| `propertyZip` | string | 5-digit US ZIP code |
| `landTypeCode` | string | Active land type code (see section 7) |
| `projectTypeCode` | string | Active project type code (see section 7) |
| `budget` | string | Free-text budget range (e.g. `"$10,000-$20,000"`) — stored only, not used for tier assignment |
| `timeline` | string | Requested timeline (e.g. `"2026-10-01"` or `"Q4 2026"`) |
| `urgency` | string | Urgency description (e.g. `"Within 30 days"`) |
| `description` | string | Project description |

### Optional fields

| Field | Type | Notes |
|---|---|---|
| `firstName` | string | Landowner first name |
| `lastName` | string | Landowner last name |
| `phone` | string | Landowner phone number |
| `contractorCategoryCode` | string \| null | Preferred contractor category (see section 7) |

### Conditional fields

| Field | Type | Condition |
|---|---|---|
| `externalContractorId` | string | **Required** when `source` is `direct-contractor-profile-request`. **Prohibited** when `source` is `general/get-three-estimates`. |

Extra/unknown fields are rejected with `422 validation_error`.

---

## 6. Source values

### `general/get-three-estimates`
General estimate request. Admin assigns tier and routes to up to three contractors.

### `direct-contractor-profile-request`
Direct request targeting a specific Wix contractor. Must include `externalContractorId`.  
Requires a pre-existing `ExternalContractorIdentity` mapping (`source="wix"`, `externalId=<value>`) in the Landy's Pro database. Unresolved IDs create a held lead — **no general-matching fallback**.

---

## 7. Active taxonomy codes

Only codes with `archivedAt IS NULL` are accepted. Unknown or archived codes return `422 invalid_reference`.

Confirm active codes with the operator before go-live. Official codes seeded at launch:

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
| Culvert Install | `culvert-install` |
| Barndominium Building | `barndominium-building` |
| Brush Hogging | `brush-hogging` |
| Pond Building | `pond-building` |
| Cabin Construction | `cabin-construction` |
| Driveway Construction | `driveway-construction` |
| Water Well Drilling | `water-well-drilling` |
| Gated Entrance | `gated-entrance` |
| Drainage Improvement | `drainage-improvement` |
| Irrigation System Installation | `irrigation-system-installation` |
| Retaining Wall Construction | `retaining-wall-construction` |
| Utility Trenching | `utility-trenching` |
| Tree Removal & Stump Grinding | `tree-removal-stump-grinding` |
| Land Grading & Leveling | `land-grading-leveling` |

---

## 8. General estimate — example

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

---

## 9. Direct contractor request — example

Only send when a confirmed `ExternalContractorIdentity` mapping exists in production:

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
    "description": "Direct request for a specific contractor.",
    "externalContractorId": "KNOWN_WIX_CONTRACTOR_ID"
  }'
```

---

## 10. externalContractorId semantics

- Must match `ExternalContractorIdentity.externalId` where `source="wix"` in the Landy's Pro database.
- Contractor mappings are created manually by the Landy's Pro operator.
- Unresolved IDs → lead held with `contractorReviewRequired: true`. No general-matching fallback. Ever.
- Deactivated contractor → same hold behavior.

---

## 11. externalRequestId and idempotency

| Scenario | Behavior |
|---|---|
| Identical payload retry | 202 · same `leadId` · `"replay": true` |
| Same ID, different payload | 409 `idempotency_conflict` |
| New ID, any payload | 202 · new `leadId` · `"replay": false` |

- Safe to retry identical payloads on network timeout.
- Do **not** retry 409 — fix the payload mismatch first.
- Do **not** retry 422 — fix the validation error or taxonomy code first.
- Never reuse an `externalRequestId` across different business intents.

---

## 12. Success response

**HTTP 202 Accepted**

```json
{
  "ok": true,
  "data": {
    "leadId": "cm...",
    "replay": false,
    "reviewStatus": "pending_review",
    "blockers": ["tier_review"]
  }
}
```

For a direct request with an unresolved contractor, `blockers` will also include `"contractor_review"`.

---

## 13. Error responses

| HTTP | Error code | When |
|---:|---|---|
| 400 | `invalid_json` | Request body is not valid JSON |
| 401 | `unauthorized` | `Authorization` header missing or secret incorrect |
| 409 | `idempotency_conflict` | Same `externalRequestId`, different payload hash |
| 415 | `unsupported_media_type` | `Content-Type` is not `application/json` |
| 422 | `validation_error` | Zod schema failure — response includes `issues[]` with field-level detail |
| 422 | `invalid_reference` | `landTypeCode`, `projectTypeCode`, or `contractorCategoryCode` unknown or archived |
| 500 | `internal_error` | Unexpected server failure |
| 503 | `integration_disabled` | `WIX_ESTIMATE_INTEGRATION_ENABLED` flag is not `"true"` |

Error body shape:

```json
{
  "ok": false,
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "issues": [
      { "path": ["landTypeCode"], "message": "Required" }
    ]
  }
}
```

---

## 14. Retry policy

| Status | Retry? |
|---|---|
| Network timeout / 5xx | ✅ Safe — idempotent on same `externalRequestId` |
| 202 | ✅ Safe — returns same `leadId` |
| 401 | ❌ Fix secret first |
| 409 | ❌ Fix payload or use a new `externalRequestId` |
| 415 | ❌ Add `Content-Type: application/json` |
| 422 | ❌ Fix the validation/taxonomy error |

---

## 15. Tier assignment behavior

**Automatic tier assignment is NOT implemented.** Every Wix request enters manual admin tier review:

- Lead is created with `tier: null`, `priceCents: null`, `reviewStatus: PENDING_REVIEW`, `tierReviewRequired: true`.
- The `budget` text field is stored verbatim but **not parsed** for tier inference.
- No contractor matching, notifications, wallet charges, or expiry timers start until an admin finalizes the tier.
- Admin reviews and assigns tier via the Landy's Pro admin dashboard.

---

## 16. Direct contractor routing behavior

- A direct request routes only to the mapped contractor — **never** falls back to general matching.
- If the mapped contractor is deactivated between request and admin review, the lead remains held.
- Admin manually resolves held leads.

---

## 17. File attachments

**Attachment transport is not part of the production integration contract.** The endpoint accepts JSON only. Attachment-related fields in the request body are rejected with `422 validation_error`.

The `LeadAttachment` metadata model exists internally for future use.

---

## 18. Testing procedure

Run the following tests against the production endpoint before enabling live traffic:

1. **Missing auth** → expect `401 unauthorized`
2. **Valid general request** → expect `202`, note `leadId`
3. **Identical retry** → same `externalRequestId` + identical payload → expect `202` with `"replay": true` and the same `leadId`
4. **Conflict** → same `externalRequestId` + mutated payload → expect `409 idempotency_conflict`
5. **Invalid taxonomy** → unknown `landTypeCode` → expect `422 invalid_reference`
6. **Disabled flag** → test before operator enables flag → expect `503 integration_disabled`
7. **Direct contractor** → only run if a known `ExternalContractorIdentity` mapping exists in production

---

## 19. Production go-live checklist (Wix developer)

- [ ] Operator has enabled `WIX_ESTIMATE_INTEGRATION_ENABLED=true`
- [ ] Production secret received privately from operator — stored securely, not in source code
- [ ] Active taxonomy codes confirmed with operator (codes can be queried: `GET /api/estimate` returns active categories)
- [ ] General request tested (step 2 above)
- [ ] Idempotent retry tested (step 3 above)
- [ ] Conflict case tested (step 4 above)
- [ ] Direct routing tested **only** with a known mapped `externalContractorId`

---

## 20. Contractor sync (future)

The foundation for Wix contractor synchronization is implemented in `lib/integrations/contractors/`. The live HTTP adapter is **not yet implemented** — blocked pending Wix API information.

Fields that must **never** be overwritten by any future sync:
`walletBalanceCents`, Stripe customer/card fields, `clerkUserId`, `isPro`, wallet transactions, lead matches, pricing snapshots, promo/refund history, audit logs.
