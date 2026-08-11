# Landy's Pro — Wix Estimate Submission API

**Version:** 1.1.0
**Production base URL:** `https://cole-prolandy-project.replit.app`
**Endpoint:** `POST /api/integrations/wix/estimate-requests`
**OpenAPI spec:** `docs/openapi/wix-estimate-integration.yaml`

> **Implementation vs activation status**
>
> The full endpoint contract described in this document is implemented and
> deployed. Production traffic is controlled by a feature flag set by
> Landy's / TECHMA. Until that flag is activated, all requests return
> **503 integration_disabled**. The contract itself will not change when the
> flag is enabled.

---

## 1. Authentication

All requests must carry a `Bearer` token:

```
Authorization: Bearer <WIX_ESTIMATE_API_SECRET>
```

The actual credential will be provided **privately** by Landy's / TECHMA.
**Do not put the secret in source code, logs, or this document.**

Authentication is verified with a timing-safe comparison (SHA-256 hash of
the supplied token vs. the stored secret). Any request with a missing,
malformed, or incorrect token receives:

```
HTTP 401
{ "ok": false, "error": { "code": "unauthorized", "message": "Invalid bearer credentials." } }
```

---

## 2. Required headers

```
Content-Type: application/json
Authorization: Bearer <WIX_ESTIMATE_API_SECRET>
```

Any `Content-Type` other than `application/json` returns **415
unsupported_media_type** before the body is read.

---

## 3. Request

```
POST https://cole-prolandy-project.replit.app/api/integrations/wix/estimate-requests
Content-Type: application/json
Authorization: Bearer <WIX_ESTIMATE_API_SECRET>
```

The body must be valid JSON. An unparseable body returns **400 invalid_json**.
Unknown or extra fields are rejected with **422 validation_error** — the
schema is strict.

### 3a. Required fields

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `source` | string | `"general/get-three-estimates"` or `"direct-contractor-profile-request"` | See section 5 |
| `externalRequestId` | string | min 1 char, max 160 chars (trimmed) | Your stable unique ID; used for idempotency |
| `email` | string | valid email format, max 320 chars | Landowner email |
| `propertyZip` | string | 5-digit (`12345`) or ZIP+4 (`12345-6789`) | Property ZIP code |
| `landTypeCode` | string | min 1 char, max 80 chars | Must match an active code — see section 6 |
| `projectTypeCode` | string | min 1 char, max 80 chars | Must match an active code — see section 6 |
| `budget` | string | min 1 char, max 280 chars | Free-text budget description — stored verbatim, not parsed |
| `timeline` | string | **`YYYY-MM-DD` format only** | Must be a valid calendar date, e.g. `"2026-10-01"` |
| `urgency` | string | min 1 char, max 280 chars | Urgency description, e.g. `"Within 30 days"` |
| `description` | string | min 10 chars, max 4000 chars | Project description |

### 3b. Optional fields

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `firstName` | string \| null | max 80 chars | Landowner first name |
| `lastName` | string \| null | max 80 chars | Landowner last name |
| `phone` | string \| null | max 40 chars | Landowner phone |
| `contractorCategoryCode` | string \| null | min 1 char, max 80 chars if provided | Preferred contractor category — see section 6 |

### 3c. Conditional field

| Field | Type | Constraints | Condition |
|---|---|---|---|
| `externalContractorId` | string | min 1 char, max 160 chars | **Required** when `source` is `"direct-contractor-profile-request"`. **Prohibited** when `source` is `"general/get-three-estimates"`. |

---

## 4. Idempotency

Idempotency is keyed on `externalRequestId`. The payload is hashed with
SHA-256 of `JSON.stringify(payload)` (the full parsed object).

| Scenario | Behavior |
|---|---|
| Same `externalRequestId` + identical payload | `202` — same `leadId`, `"replay": true` |
| Same `externalRequestId` + different payload | `409 idempotency_conflict` |
| New `externalRequestId` | `202` — new `leadId`, `"replay": false` |

**Retry rules:**

| Status | Safe to retry? |
|---|---|
| Network timeout / 5xx | Yes — retry with the identical payload and the same `externalRequestId` |
| 202 | Yes — returns the same `leadId` |
| 401 | No — fix the secret first |
| 409 | No — resolve the payload conflict or use a new `externalRequestId` |
| 415 | No — add `Content-Type: application/json` |
| 422 | No — fix the validation error or taxonomy code before retrying |

---

## 5. Source values and flows

### `"general/get-three-estimates"`

Standard intake. The lead enters admin tier review, after which Landy's
routes it to eligible contractors.

- `externalContractorId` must **not** be present in the body.

### `"direct-contractor-profile-request"`

Targets a specific contractor by their Wix external ID.

- `externalContractorId` is **required**.
- The value must match an `ExternalContractorIdentity` record in Landy's
  database (`source="wix"`, `externalId=<value>`). These mappings are
  created by the Landy's operator — coordinate with Landy's / TECHMA to
  confirm which contractor IDs are registered before sending direct requests.
- If no mapping is found, or the mapped contractor is deactivated, the lead
  is created in a **held state** (`contractorReviewRequired: true`). There
  is **no automatic fallback to general matching**.

---

## 6. Taxonomy codes

`landTypeCode`, `projectTypeCode`, and `contractorCategoryCode` must each
match an **active** (non-archived) code in the Landy's database. Unknown or
archived codes return `422 invalid_reference`.

Confirm active codes with Landy's / TECHMA before go-live — codes may be
added or archived over time.

### Contractor category codes (optional field — 12 active)

| Display name | Code |
|---|---|
| Builders | `builders` |
| Dirt Work & Excavation | `dirt-work-excavation` |
| Farm & Agriculture | `farm-agriculture` |
| Fencing & Entrances | `fencing-entrances` |
| Forestry & Timber | `forestry-timber` |
| Land Clearing | `land-clearing` |
| Land Lenders | `land-lenders` |
| Land Realtors | `land-realtors` |
| Property Maintenance | `property-maintenance` |
| Surveyors | `surveyors` |
| Water Well & Septic | `water-well-septic` |
| Wildlife Management | `wildlife-management` |

### Land type codes (6 active)

| Display name | Code |
|---|---|
| Development | `development` |
| Farmland | `farmland` |
| Homestead | `homestead` |
| Hunting | `hunting` |
| Ranching | `ranching` |
| Timberland | `timberland` |

### Project type codes (14 active)

| Display name | Code |
|---|---|
| Barndominium Building | `barndominium-building` |
| Brush Hogging | `brush-hogging` |
| Cabin Construction | `cabin-construction` |
| Culvert Install | `culvert-install` |
| Drainage Improvement | `drainage-improvement` |
| Driveway Construction | `driveway-construction` |
| Gated Entrance | `gated-entrance` |
| Irrigation System Installation | `irrigation-system-installation` |
| Land Grading & Leveling | `land-grading-leveling` |
| Pond Building | `pond-building` |
| Retaining Wall Construction | `retaining-wall-construction` |
| Tree Removal & Stump Grinding | `tree-removal-stump-grinding` |
| Utility Trenching | `utility-trenching` |
| Water Well Drilling | `water-well-drilling` |

---

## 7. Tier assignment and review behavior

**There is no automatic tier assignment.**

Every request — general or direct — enters manual admin review:

- Lead is created with `tier: null` and `priceCents: null`.
- `reviewStatus` is always `"pending_review"` at intake.
- `tierReviewRequired: true` is always set.
- No contractor matching, notifications, wallet charges, or expiry timers
  start until an admin assigns a tier and routes the lead in the Landy's Pro
  admin dashboard.
- The `budget` field is stored verbatim for admin reference. It is not parsed
  or used for tier inference.

---

## 8. Success response

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

Direct request where contractor could not be resolved at intake — lead held
for admin review:

```json
{
  "ok": true,
  "data": {
    "leadId": "cm...",
    "replay": false,
    "reviewStatus": "pending_review",
    "blockers": ["tier_review", "contractor_review"]
  }
}
```

Idempotent replay — same `externalRequestId`, identical payload:

```json
{
  "ok": true,
  "data": {
    "leadId": "cm...",
    "replay": true,
    "reviewStatus": "pending_review",
    "blockers": ["tier_review"]
  }
}
```

---

## 9. Error responses

All errors use the same envelope:

```json
{
  "ok": false,
  "error": {
    "code": "<error_code>",
    "message": "<human-readable description>"
  }
}
```

Validation errors include an `issues` array:

```json
{
  "ok": false,
  "error": {
    "code": "validation_error",
    "message": "Request validation failed.",
    "issues": [
      { "path": "timeline", "message": "Please choose a valid timeline date" },
      { "path": "externalContractorId", "message": "Direct contractor requests require externalContractorId." }
    ]
  }
}
```

`path` is a dot-separated string (e.g. `"timeline"`, `"externalContractorId"`),
not an array.

### Error code reference

| HTTP | Code | When |
|---|---|---|
| 400 | `invalid_json` | Body is not parseable as JSON |
| 401 | `unauthorized` | `Authorization` header missing, malformed, or secret is wrong |
| 409 | `idempotency_conflict` | Same `externalRequestId`, different payload |
| 415 | `unsupported_media_type` | `Content-Type` is not `application/json` |
| 422 | `validation_error` | Zod schema failure — `issues[]` contains field-level detail |
| 422 | `invalid_reference` | `landTypeCode`, `projectTypeCode`, or `contractorCategoryCode` not found or archived |
| 500 | `internal_error` | Unexpected server failure |
| 503 | `integration_disabled` | Feature flag not yet enabled by Landy's operator |

---

## 10. Example — general estimate request

```bash
curl -sS -X POST "https://cole-prolandy-project.replit.app/api/integrations/wix/estimate-requests" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <WIX_ESTIMATE_API_SECRET>" \
  -d '{
    "source": "general/get-three-estimates",
    "externalRequestId": "estimate-2026-000123",
    "firstName": "Jordan",
    "lastName": "Lee",
    "phone": "+15125550100",
    "email": "jordan@example.com",
    "propertyZip": "78701",
    "contractorCategoryCode": "land-clearing",
    "landTypeCode": "development",
    "projectTypeCode": "pond-building",
    "budget": "$10,000–$20,000",
    "timeline": "2026-10-01",
    "urgency": "Within 30 days",
    "description": "Install a retention pond at the main parcel entrance."
  }'
```

Expected response:

```json
HTTP 202
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

---

## 11. Example — direct contractor profile request

Only send when Landy's / TECHMA has confirmed a registered
`externalContractorId` mapping for the target contractor:

```bash
curl -sS -X POST "https://cole-prolandy-project.replit.app/api/integrations/wix/estimate-requests" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <WIX_ESTIMATE_API_SECRET>" \
  -d '{
    "source": "direct-contractor-profile-request",
    "externalRequestId": "direct-2026-000456",
    "firstName": "Jordan",
    "lastName": "Lee",
    "phone": "+15125550100",
    "email": "jordan@example.com",
    "propertyZip": "78701",
    "landTypeCode": "development",
    "projectTypeCode": "pond-building",
    "budget": "$10,000–$20,000",
    "timeline": "2026-10-01",
    "urgency": "Within 30 days",
    "description": "Direct request for a specific contractor to build a retention pond.",
    "externalContractorId": "CONFIRMED_WIX_CONTRACTOR_ID"
  }'
```

If the contractor ID resolves: `blockers` will be `["tier_review"]`.
If the contractor ID is not yet mapped or the contractor is deactivated:
`blockers` will be `["tier_review", "contractor_review"]` — lead is held
for admin resolution. No general fallback occurs.

---

## 12. File attachments

Attachment transport is not yet part of the production integration contract.
Please do not send file data until Landy's confirms the agreed transfer
mechanism.

The schema is strict — any attachment-related fields in the body will be
rejected with `422 validation_error`.

---

## 13. Testing checklist

Run this sequence against the production endpoint before enabling live
traffic.

1. **Integration disabled** — valid request before flag is enabled → `503 integration_disabled`
2. **Missing auth** — omit `Authorization` header → `401 unauthorized`
3. **Wrong secret** — incorrect token → `401 unauthorized`
4. **Wrong content-type** — `Content-Type: text/plain` → `415 unsupported_media_type`
5. **Invalid JSON** — malformed body → `400 invalid_json`
6. **Missing required field** — omit `timeline` → `422 validation_error`, `path: "timeline"`
7. **Invalid timeline format** — `"timeline": "Q4 2026"` → `422 validation_error`
8. **Unknown taxonomy code** — `"landTypeCode": "swampland"` → `422 invalid_reference`
9. **General with contractor ID** — include `externalContractorId` on general source → `422 validation_error`
10. **Direct without contractor ID** — omit `externalContractorId` on direct source → `422 validation_error`
11. **Extra field** — add any unknown field → `422 validation_error`
12. **Valid general request** → `202`, note the `leadId`
13. **Idempotent retry** — identical payload, same `externalRequestId` → `202`, same `leadId`, `"replay": true`
14. **Conflict** — same `externalRequestId`, different `description` → `409 idempotency_conflict`
15. **Direct contractor request** — only after confirming a mapped `externalContractorId` with Landy's

---

## 14. Information required from Wix developer

The following information is needed to implement contractor synchronisation
from Wix into Landy's Pro. These are **requested capabilities** — we are not
assuming Wix already provides them in any specific form. Please share
whatever is available and indicate where a capability is not yet offered.

| Item | What we need |
|---|---|
| **API / base endpoint** | Base URL for Wix contractor data API |
| **Authentication** | Auth method (API key, OAuth token, etc.) and how credentials are issued |
| **Stable contractor external ID** | The field Wix uses as a permanent, immutable identifier per contractor — the value Wix should include in `externalContractorId` |
| **List / retrieval** | How to retrieve the full contractor list (endpoint, method) |
| **Pagination** | Pagination mechanism (cursor, page/size, offset) and max page size |
| **Response schema** | Full response field names and types for contractor records |
| **Active / deactivated status** | Whether a contractor active/deactivated status field is available and what values it uses |
| **Change notification** | Webhook or `updated_since` / `modified_after` filter to retrieve only changed records |
| **Contractor category** | How the contractor's service category is represented (field name, possible values) |
| **Project / service types** | How a contractor's offered project or service types are represented |
| **Service area / geography** | Whether contractors have a service-area or geographic-coverage field, and its format |
| **Profile / media fields** | Which profile fields are available (bio/about, business hours, logo/photo URLs, etc.) |
