# Wix integration verification report

Date: 2026-08-10  
Automated tester: Cursor agent  
Environment: Windows 11 workspace, Node 22.17.0

## Automated verification

- `VERIFIED` — unit suite: 19 files, 131 tests passed.
- `VERIFIED` — TypeScript: `tsc --noEmit` passed.
- `VERIFIED` — ESLint: completed with no errors or warnings.
- `VERIFIED` — production build: Next.js 15.5.20 compiled, typechecked,
  generated static pages, and emitted the Wix route successfully.
- `VERIFIED` — Prisma Client generation completed.
- `VERIFIED` — Prisma schema validation passed.
- `VERIFIED` — OpenAPI YAML parsed and contains the implemented
  `/api/integrations/wix/estimate-requests` path.
- `VERIFIED` — tests cover wallet charging/idempotency, Stripe event
  idempotency, contact reveal behavior, expiry, safe unresolved distribution
  gating, sync dry-run/idempotency/protected writes, Wix request validation,
  bearer authentication, direct-request requirements, and payload hashing.

The local dependency tree exposed an esbuild host/binary mismatch after the
workspace package manager attempted automatic dependency repair. Verification
used an isolated official esbuild 0.27.3 Windows binary matching Vitest's
installed host package. No repository dependency manifest or lockfile was
changed for that workaround.

One notification mock used an arrow function as a constructor, which Vitest
4 rejects. The test mock was changed to a constructable function; production
notification code was unchanged.

## Migration and production gate

Status: `MANUAL QA REQUIRED`

The migrations were not executed against production. No production database
connection or migration approval was available.

The Prisma schema is valid, and migration files are additive. Production
execution remains gated by:

- read-only production taxonomy export and row-by-row identity review;
- approval of legacy archival outcomes;
- approved prices for every activated official project;
- rehearsal on a recent redacted backup;
- verified production backup;
- explicit migration approval.

## Manual contractor portal regression

Tester: not assigned  
Execution environment: not available  
Setup/input: requires a migrated test database, Clerk test users, Stripe test
configuration, and optional Twilio test configuration.

No item below was executed, so none is marked passed.

### Contractor login

Status: `MANUAL QA REQUIRED`  
Expected: an active contractor signs in and reaches the contractor portal.  
Actual: not executed; no migrated test environment and Clerk test user were
available.

### Dashboard

Status: `MANUAL QA REQUIRED`  
Expected: dashboard loads wallet and resolved lead data without unresolved
requests appearing.  
Actual: not executed; required test data was unavailable.

### Lead feed

Status: `MANUAL QA REQUIRED`  
Expected: only matched, resolved, unexpired leads appear.  
Actual: not executed; required test data was unavailable.

### Masked contact before purchase

Status: `MANUAL QA REQUIRED`  
Expected: landowner name, phone, and email remain hidden before acceptance.  
Actual: not executed; required matched lead was unavailable.

### Insufficient wallet behavior

Status: `MANUAL QA REQUIRED`  
Expected: acceptance is blocked without a charge and the top-up path is shown.  
Actual: not executed; Stripe test setup and contractor wallet fixture were
unavailable.

### Wallet top-up

Status: `MANUAL QA REQUIRED`  
Expected: Stripe test payment credits the wallet exactly once.  
Actual: not executed; Stripe test credentials and webhook delivery were
unavailable.

### Lead acceptance

Status: `MANUAL QA REQUIRED`  
Expected: a pending match becomes accepted and contact is revealed.  
Actual: not executed; required contractor session and lead fixture were
unavailable.

### Exact snapshot-price deduction

Status: `MANUAL QA REQUIRED`  
Expected: the wallet deduction equals the lead's immutable price snapshot.  
Actual: not executed; required accepted lead fixture was unavailable.

### Duplicate acceptance prevention

Status: `MANUAL QA REQUIRED`  
Expected: repeated acceptance returns the accepted result without another
charge.  
Actual: not executed manually; automated idempotency tests passed.

### Contact reveal after purchase

Status: `MANUAL QA REQUIRED`  
Expected: supplied contact fields are visible after valid acceptance, while
optional missing fields display as unavailable.  
Actual: not executed; required accepted lead fixture was unavailable.

### Accepted lead history

Status: `MANUAL QA REQUIRED`  
Expected: accepted leads remain visible with their snapshot price and contact.  
Actual: not executed; required contractor history fixture was unavailable.

### SMS magic-link path

Status: `MANUAL QA REQUIRED`  
Expected: a valid token opens a resolved lead and duplicate acceptance remains
idempotent.  
Actual: not executed; no usable Twilio test provider/configuration was
available.

## Deferred capabilities

- Attachments: `BLOCKED BY WIX` and `NOT IMPLEMENTED`.
- Live Wix contractor synchronization: `BLOCKED BY WIX` and `NOT IMPLEMENTED`.
- Automated tier assignment: `BLOCKED BY BUSINESS RULE` and `NOT IMPLEMENTED`.
- Production deployment and production migration: `MANUAL QA REQUIRED`.
