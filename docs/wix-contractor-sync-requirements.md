# Wix contractor synchronization requirements

## Current status

- Internal provider-neutral identity and sync foundation: `IMPLEMENTED`
- Typechecked foundation and policy boundary: `VERIFIED`
- Wix network adapter, endpoint, polling, webhook, or scheduled job:
  `BLOCKED BY WIX`
- Claim of live contractor synchronization: `NOT IMPLEMENTED`

No code currently calls Wix for contractor data.

## Implemented normalized contract

A future documented provider adapter may translate external data into these
Landy's Pro domain fields:

- `source`
- `externalId`
- optional profile: `name`, `email`, `phone`, `aboutSection`,
  `businessHours`
- optional `contractorCategoryCode`
- optional list of `projectTypeCodes`

External identities are uniquely keyed by `(source, externalId)` and link to one
internal contractor. Repeated calls return deterministic `created`, `updated`,
`unchanged`, or `unresolved` results.

Dry-run is the default. A write requires an explicit policy with
`allowCreate` and an allowlist of writable profile/taxonomy fields. The default
policy owns no fields and cannot create contractors.

Incomplete creates and unknown or archived taxonomy codes return `unresolved`;
the service never fabricates required values or assignments. Deactivated
contractors are held for administrative review.

## Protected Landy's Pro data

The normalized contract cannot write:

- wallet balances
- Stripe customer, card, payment-method, or payment-intent data
- wallet transactions
- lead matches or lead purchases
- lead pricing snapshots
- promotions or refunds
- Clerk user IDs
- Pro entitlement
- audit history
- financial history

The Prisma store updates only the normalized profile fields allowed by policy,
category/project assignments when explicitly owned, identity sync metadata, and
a new audit record for that sync operation.

## Ownership decision required

Before a Wix adapter can write, the project owner must approve a field-by-field
ownership policy:

- whether Wix may create a new Landy's Pro contractor
- whether Wix or Landy's Pro owns name, email, phone, about text, and business
  hours
- whether Wix may change contractor category
- whether Wix may change project-service assignments
- behavior when Wix omits or clears a previously supplied field
- behavior when Wix and Landy's Pro changed the same field
- deactivation, reactivation, and deletion semantics

Until approved, the only safe provider policy is dry-run with no writable
fields.

## Wix information still required

Provide official Wix developer documentation or a reviewed contract covering:

- API base URL and environment separation
- authentication type, credential issuance, rotation, and expiry
- exact contractor resource and field schema
- stable external contractor identifier
- pagination and maximum page size
- filtering and incremental change mechanism
- timestamp/version semantics and ordering guarantees
- webhook schema, signatures, retries, and replay behavior, if webhooks exist
- rate limits and retry headers
- error schema and retryable status codes
- deletion, archival, suspension, and restoration behavior
- partial failure behavior for batches
- sandbox/test data and production enablement process

Do not infer these details from Wix UI labels or example payloads.

## Adapter acceptance criteria

After documentation and ownership approval, the Wix adapter must:

1. translate the documented payload into the normalized contract without
   business writes of its own;
2. use reviewed fixtures derived from official documentation;
3. support documented pagination, retries, and incremental changes;
4. run a bounded dry-run first and expose field-level differences;
5. preserve protected fields under all payloads;
6. remain independently disableable;
7. record batch and item outcomes without logging contractor secrets or
   unnecessary PII;
8. pass idempotency, partial-failure, stale-update, deactivation, rollback, and
   protected-field tests.
