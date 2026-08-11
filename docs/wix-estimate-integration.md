# Wix estimate request integration

Status: `IMPLEMENTED` in Landy's Pro. Production use remains disabled until
credentials, active taxonomy codes, and an end-to-end Wix test are verified.

Contract version: `1.1.0`

Contract date: `2026-08-10`

## Endpoint

- Method: `POST`
- Path: `/api/integrations/wix/estimate-requests`
- Base URL: the environment-specific Landy's Pro origin supplied by the Landy's
  Pro operator. Do not hardcode a preview or production hostname.
- Content type: `application/json`
- Authentication: `Authorization: Bearer <shared-secret>`
- Feature switch: Landy's Pro must set
  `WIX_ESTIMATE_INTEGRATION_ENABLED=true`.

The shared secret is server-only. It must never be placed in browser code, a
public Wix page, URL parameters, logs, or analytics.

## Related public endpoint

The browser form at `/estimate` submits to `POST /api/estimate` with
`schemaVersion: 2` and the same unresolved-tier intake behavior as this Wix
endpoint (without `externalRequestId`). Requests without `schemaVersion: 2`
receive `422` / `schema_version_required`.

## Request

The JSON object is strict. Undocumented properties, including any attachment or
upload property, are rejected.

Required fields:

- `source`: `"general/get-three-estimates"` or
  `"direct-contractor-profile-request"`
- `externalRequestId`: stable unique Wix-side request identifier, 1–160 chars
- `email`: valid email address
- `propertyZip`: US five-digit ZIP or ZIP+4
- `landTypeCode`: active Landy's Pro land-type code
- `projectTypeCode`: active Landy's Pro project-type code
- `budget`: free text, 1–280 chars
- `timeline`: calendar date in `YYYY-MM-DD`
- `urgency`: free text, 1–280 chars
- `description`: project description, 10–4000 chars

Optional fields:

- `firstName`: string or `null`, maximum 80 chars
- `lastName`: string or `null`, maximum 80 chars
- `phone`: string or `null`, maximum 40 chars
- `contractorCategoryCode`: active Landy's Pro contractor-category code or
  `null`
- `externalContractorId`: required only when `source` is
  `"direct-contractor-profile-request"`; prohibited for
  `"general/get-three-estimates"`

Example:

```json
{
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
}
```

## Taxonomy codes

Only active database rows are accepted. Display labels may change; codes are
immutable.

Contractor category codes:

- `land-clearing`
- `surveyors`
- `builders`
- `dirt-work-excavation`
- `fencing-entrances`
- `water-well-septic`
- `forestry-timber`
- `property-maintenance`
- `wildlife-management`
- `farm-agriculture`
- `land-lenders`
- `land-realtors`

Land type codes:

- `development`
- `farmland`
- `timberland`
- `ranching`
- `homestead`
- `hunting`

Project type codes:

- `culvert-install`
- `barndominium-building`
- `brush-hogging`
- `pond-building`
- `cabin-construction`
- `driveway-construction`
- `water-well-drilling`
- `gated-entrance`
- `drainage-improvement`
- `irrigation-system-installation`
- `retaining-wall-construction`
- `utility-trenching`
- `tree-removal-stump-grinding`
- `land-grading-leveling`

Some seeded projects remain archived until all three approved prices are
configured. Confirm the production active-code list with the Landy's Pro
operator before Wix is enabled.

## Processing and routing

Every accepted request is persisted for review with a tier blocker. Landy's Pro
does not infer a tier from budget, urgency, description, keywords, or AI.
Unresolved requests have no price, match, notification, charge, or expiry.

`general/get-three-estimates` requests are routed through the existing shared
matching logic only after an admin chooses a tier.
`direct-contractor-profile-request` requests resolve `externalContractorId`
against the provider-neutral external identity whose internal provider source
is `"wix"`. An unknown or deactivated contractor is held for review; it never
falls through to general matching.

## Idempotency and retries

Idempotency is keyed by the persisted integration source and
`externalRequestId`, which is `("wix", externalRequestId)` for this endpoint.

For this endpoint, the persisted integration source is always `"wix"`; the
request's business `source` value is included in the payload hash. Therefore
changing a request from general to direct while reusing an ID is a conflict,
not a second lead.

- The first valid request returns HTTP `202`.
- An identical retry returns the original `leadId` with `replay: true`.
- Reusing the same ID with a changed validated payload returns HTTP `409`.
- Retry network failures and HTTP `500` with bounded exponential backoff.
- Do not retry `401`, `409`, `415`, or `422` without correcting the request.
- HTTP `503` means the integration is disabled; contact the Landy's Pro
  operator.

Successful response:

```json
{
  "ok": true,
  "data": {
    "leadId": "internal-lead-id",
    "replay": false,
    "reviewStatus": "pending_review",
    "blockers": ["tier_review"]
  }
}
```

An identical replay uses the same HTTP `202` response and original lead ID:

```json
{
  "ok": true,
  "data": {
    "leadId": "internal-lead-id",
    "replay": true,
    "reviewStatus": "pending_review",
    "blockers": ["tier_review"]
  }
}
```

Error response:

```json
{
  "ok": false,
  "error": {
    "code": "validation_error",
    "message": "Request validation failed.",
    "issues": [
      {
        "path": "propertyZip",
        "message": "Invalid string: must match pattern"
      }
    ]
  }
}
```

Authentication failure example (`401`):

```json
{
  "ok": false,
  "error": {
    "code": "unauthorized",
    "message": "Invalid bearer credentials."
  }
}
```

Conflicting retry example (`409`):

```json
{
  "ok": false,
  "error": {
    "code": "idempotency_conflict",
    "message": "The external request ID was already used with a different payload."
  }
}
```

Implemented status codes are `202`, `400`, `401`, `409`, `415`, `422`, `500`,
and `503`. See `docs/openapi/wix-landys-pro.yaml` for the machine-readable
contract.

## Test and production procedure

1. Obtain a non-production Landy's Pro base URL and server secret.
2. Confirm the active category, land, and project codes with the operator.
3. Enable `WIX_ESTIMATE_INTEGRATION_ENABLED` only in the test environment.
4. Submit one general request and repeat the identical JSON.
5. Confirm both responses contain the same `leadId` and the retry reports
   `replay: true`.
6. Change one field while keeping the same `externalRequestId`; confirm `409`.
7. Confirm the admin review queue contains one unresolved lead with no matches
   and no expiry.
8. Test direct routing with a reviewed external identity and with an unknown ID.
9. Rotate to a separately generated production secret, configure the production
   origin, and repeat the approved smoke test.

## Attachments

Transport status: `BLOCKED BY WIX` and `NOT IMPLEMENTED`.

The endpoint accepts JSON only and advertises no file, multipart, base64, or URL
attachment field. Landy's Pro has an internal private-object metadata model for
zero-to-many lead attachments, but no Wix request can create those records.
Transport, private storage, retention, authorization, failure, and cleanup rules
must be approved before this API contract changes.
