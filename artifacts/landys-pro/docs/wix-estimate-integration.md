# Landy's Pro — Wix Estimate Submission API

**Version:** 1.1.0  
**Production base URL:** `https://cole-prolandy-project.replit.app`  
**Endpoint:** `POST /api/integrations/wix/estimate-requests`

> **Implementation vs activation status**
>
> The full endpoint contract described in this document is implemented and deployed.
> Production traffic is controlled by a feature flag set by Landy's / TECHMA.
> Until that flag is activated, all requests return **503 integration_disabled**.
> The contract itself will not change when the flag is enabled.

---

## 1. Authentication

All requests must carry a `Bearer` token:

```
Authorization: Bearer <WIX_ESTIMATE_API_SECRET>
```

The actual credential will be provided **privately** by Landy's / TECHMA.
**Do not put the secret in source code, logs, or this document.**

Authentication is verified with a timing-safe comparison.
Any request with a missing, malformed, or incorrect token receives:

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

Any `Content-Type` other than `application/json` returns **415 unsupported_media_type** before the body is read.

---

## 3. Request

```
POST https://cole-prolandy-project.replit.app/api/integrations/wix/estimate-requests
Content-Type: application/json
Authorization: Bearer <WIX_ESTIMATE_API_SECRET>
```

The body must be valid JSON. An unparseable body returns **400 invalid_json**.  
Unknown/extra fields are rejected with **422 validation_error** (the schema is strict).

### 3a. Fields

#### Required

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `source` | string | `"general/get-three-estimates"` or `"direct-contractor-profile-request"` | See section 5 |
| `externalRequestId` | string | min 1 char, max 160 chars (after trim) | Your stable unique ID; used for idempotency |
| `email` | string | valid email format, max 320 chars | Landowner email |
| `propertyZip` | string | 5-digit (`12345`) or ZIP+4 (`12345-6789`) | Property ZIP code |
| `landTypeCode` | string | min 1 char, max 80 chars | Must match an active code — see section 6 |
| `projectTypeCode` | string | min 1 char, max 80 chars | Must match an active code — see section 6 |
| `budget` | string | min 1 char, max 280 chars | Free-text budget description — stored verbatim, not parsed |
| `timeline` | string | **`YYYY-MM-DD` format only** | Must be a valid calendar date; e.g. `"2026-10-01"` |
| `urgency` | string | min 1 char, max 280 chars | Urgency description; e.g. `"Within 30 days"` |
| `description` | string | min 10 chars, max 4000 chars | Project description |

#### Optional

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `firstName` | string \| null | max 80 chars | Landowner first name |
| `lastName` | string \| null | max 80 chars | Landowner last name |
| `phone` | string \| null | max 40 chars | Landowner phone |
| `contractorCategoryCode` | string \| null | min 1 char, max 80 chars if provided | Preferred contractor category — see section 6 |

#### Conditional

| Field | Type | Constraints | Condition |
|---|---|---|---|
| `externalContractorId` | string | min 1 char, max 160 chars | **Required** when `source` is `"direct-contractor-profile-request"`. **Prohibited** when `source` is `"general/get-three-estimates"`. |

---

## 4. Idempotency

Idempotency is keyed on `externalRequestId`.

| Scenario | Behavior |
|---|---|
| Same `externalRequestId` + **identical payload** | `202` — same `leadId` returned, `"replay": true` |
| Same `externalRequestId` + **different payload** | `409 idempotency_conflict` |
| New `externalRequestId` | `202` — new `leadId` created, `"replay": false` |

The payload is hashed with SHA-256 of `JSON.stringify(payload)` (the full parsed body, not the raw bytes).

**Retry rules:**

| Status | Safe to retry? |
|---|---|
| Network timeout / 5xx | ✅ Yes — retry with the **identical** payload and same `externalRequestId` |
| 202 | ✅ Yes — returns same `leadId` |
| 401 | ❌ Fix the secret first |
| 409 | ❌ Do not retry — you must resolve the payload conflict or use a new `externalRequestId` |
| 415 | ❌ Add `Content-Type: application/json` |
| 422 | ❌ Fix the validation error or taxonomy code before retrying |

---

## 5. Source values and flows

### `"general/get-three-estimates"`

General estimate request. The lead enters admin tier review, after which Landy's routes it to eligible contractors.

- `externalContractorId` must **not** be included.

### `"direct-contractor-profile-request"`

Request targeting a specific contractor by their Wix external ID.

- `externalContractorId` is **required**.
- The value must match a `ExternalContractorIdentity` record in Landy's database (`source="wix"`, `externalId=<value>`). These mappings are created by the Landy's operator — coordinate with Landy's / TECHMA to confirm which contractor IDs are registered before sending direct requests.
- If no mapping is found, or the mapped contractor is deactivated, the lead is created in a **held state** (`contractorReviewRequired: true`). There is **no automatic fallback to general matching**.

---

## 6. Taxonomy codes

`landTypeCode`, `projectTypeCode`, and `contractorCategoryCode` must match an **active** (non-archived) code in the Landy's database. Unknown or archived codes return `422 invalid_reference`.

You can retrieve the current active codes at any time:

```bash
GET https://cole-prolandy-project.replit.app/api/estimate
```

This returns the live active taxonomy without authentication.

The codes seeded at launch are listed below. Confirm with the Landy's / TECHMA operator before go-live — codes may be added or archived.

### Land type codes

| Display name | Code |
|---|---|
| Development | `development` |
| Farmland | `farmland` |
| Homestead | `homestead` |
| Hunting | `hunting` |
| Ranching | `ranching` |
| Timberland | `timberland` |

### Project type codes

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

### Contractor category codes (optional field)

| Display name | Code |
|---|---|
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

---

## 7. Tier assignment and review behavior

**There is no automatic tier assignment.**

Every request — general or direct — enters manual admin review:

- Lead is created with `tier: null`, `priceCents: null`.
- `reviewStatus` is always `"pending_review"` on intake.
- `tierReviewRequired: true` is always set on intake.
- No contractor matching, notifications, wallet charges, or expiry timers start until an admin assigns a tier and routes the lead in the Landy's Pro admin dashboard.
- The `budget` field is stored verbatim for the admin to reference. It is not parsed or used for tier inference.

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

For a direct request where the contractor could not be resolved at intake time, `blockers` will also contain `"contractor_review"`:

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

For an idempotent replay (same `externalRequestId`, identical payload):

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

All errors follow the same envelope:

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
      { "path": "landTypeCode", "message": "Required" },
      { "path": "externalContractorId", "message": "Direct contractor requests require externalContractorId." }
    ]
  }
}
```

Note: `path` is a dot-separated string (e.g. `"timeline"`, `"externalContractorId"`), not an array.

### Error code reference

| HTTP | Code | When |
|---:|---|---|
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

Only send when Landy's / TECHMA has confirmed a registered `externalContractorId` mapping for the contractor:

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

If the contractor ID resolves, `blockers` will be `["tier_review"]`.  
If the contractor ID is not yet mapped or the contractor is deactivated, `blockers` will be `["tier_review", "contractor_review"]` — the lead is held for admin resolution.

---

## 12. File attachments

Attachment transport is not yet part of the production integration contract.
Please do not send file data until Landy's confirms the agreed transfer mechanism.

The schema is strict — any attachment-related fields in the body will be rejected with `422 validation_error`.

---

## 13. Testing checklist

Run the following sequence against the production endpoint before enabling live traffic.

1. **Integration disabled** — send a valid request before the flag is enabled → expect `503 integration_disabled`
2. **Missing auth** — omit the `Authorization` header → expect `401 unauthorized`
3. **Wrong secret** — send an incorrect token → expect `401 unauthorized`
4. **Wrong content-type** — send `Content-Type: text/plain` → expect `415 unsupported_media_type`
5. **Invalid JSON** — send a malformed body → expect `400 invalid_json`
6. **Missing required field** — omit `timeline` → expect `422 validation_error` with `path: "timeline"`
7. **Invalid timeline format** — send `"timeline": "Q4 2026"` → expect `422 validation_error`
8. **Unknown taxonomy code** — send `"landTypeCode": "swampland"` → expect `422 invalid_reference`
9. **General request with contractor ID** — include `externalContractorId` on a general source → expect `422 validation_error`
10. **Direct request without contractor ID** — omit `externalContractorId` on a direct source → expect `422 validation_error`
11. **Valid general request** — expect `202`, note `leadId`
12. **Idempotent retry** — repeat identical payload with same `externalRequestId` → expect `202`, same `leadId`, `"replay": true`
13. **Conflict** — same `externalRequestId`, different `description` → expect `409 idempotency_conflict`
14. **Direct contractor request** — only run when a known mapped `externalContractorId` is confirmed with Landy's

---

## 14. Information required from Wix developer

The following information is needed to implement contractor synchronisation from Wix into Landy's Pro.
These are **requested capabilities** — we are not assuming Wix already provides them in any specific form.
Please share whatever is available and indicate where a capability is not yet offered.

| Item | What we need |
|---|---|
| **API / base endpoint** | Base URL for Wix contractor data API |
| **Authentication** | Auth method (API key, OAuth token, etc.) and how credentials are issued |
| **Stable contractor external ID** | The field Wix uses as a permanent, immutable identifier per contractor — the value Wix should include in `externalContractorId` |
| **List / retrieval** | How to retrieve the full contractor list (endpoint, method) |
| **Pagination** | Pagination mechanism (cursor, page/size, offset) and max page size |
| **Response schema** | Full response field names and types for contractor records |
| **Active / deactivated status** | Whether a contractor-active or deactivated status field is available, and what values it uses |
| **Change notification** | Webhook or `updated_since` / `modified_after` filter to retrieve only changed records |
| **Contractor category** | How the contractor's service category is represented in the response (field name, possible values) |
| **Project / service types** | How a contractor's offered project or service types are represented |
| **Service area / geography** | Whether contractors have a service-area or geographic-coverage field, and its format |
| **Profile / media fields** | Which profile fields are available (bio/about, business hours, logo/photo URLs, etc.) |

Please send this information to Landy's / TECHMA at your earliest convenience so contractor sync implementation can proceed.
