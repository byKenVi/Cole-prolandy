# Integration open items

Use only these completion terms: `IMPLEMENTED`, `VERIFIED`,
`MANUAL QA REQUIRED`, `BLOCKED BY WIX`, `BLOCKED BY BUSINESS RULE`, and
`NOT IMPLEMENTED`.

## Production taxonomy migration gate

Status: `MANUAL QA REQUIRED`

The read-only export command is `pnpm preflight:taxonomy` from
`artifacts/landys-pro`. It excludes landowner/contractor PII, wallet balances,
Stripe data, and secrets.

Before production taxonomy backfill, archival decisions, or migration execution:

1. run the export against a read-only production connection;
2. review every ContractorType/ProjectType bridge, LandType, PriceTier,
   contractor assignment count, lead reference count, and required AppSetting;
3. assign each legacy taxonomy row a reviewed `preserve ID`, `archive`, or
   `requires review` outcome;
4. confirm every newly active project has approved prices for tiers 1–3;
5. rehearse migrations on a recent redacted backup;
6. take and verify a production database backup;
7. obtain explicit production migration approval.

The gate does not block additive development code, tests, documentation, or the
disabled Wix route.

## Tier assignment

Status: `BLOCKED BY BUSINESS RULE`

No approved project-specific budget bands, boundaries, gap/overlap rules,
versioning, or fallback behavior were supplied. Official requests remain in
tier review. Budget, urgency, description, keywords, and AI are not used to
guess a tier.

Required decision:

- exact structured budget bands per project and tier
- inclusive/exclusive boundary behavior
- gap and overlap validation
- version/effective-date behavior
- manual override and fallback behavior

## Attachments

Status: `BLOCKED BY WIX`

Implementation status: `NOT IMPLEMENTED`

No LeadAttachment model, upload UI, upload endpoint, request property, multipart
support, base64 support, or attachment-URL support exists.

Required decisions:

- Wix transport contract
- accepted MIME types and size/count limits
- private storage provider and failure behavior
- retention and cleanup
- deduplication
- authorization before and after lead purchase
- signed-access behavior
- privacy and audit requirements

## Wix contractor adapter

Status: `BLOCKED BY WIX`

The provider-neutral identity, dry-run planner, ownership boundary, transactional
store, and tests are implemented. Live sync remains `NOT IMPLEMENTED` until the
API/auth/schema/pagination/change contract and ownership matrix described in
`docs/wix-contractor-sync-requirements.md` are supplied.

## Wix estimate production configuration

Status: `MANUAL QA REQUIRED`

Code is disabled unless `WIX_ESTIMATE_INTEGRATION_ENABLED=true`. Production
requires:

- approved production origin
- generated and securely delivered bearer secret
- confirmed active production taxonomy codes
- one successful general request and identical retry
- one intentional idempotency conflict
- one known and one unknown direct-contractor test
- confirmation that unresolved requests have no matches, notifications, charge,
  or expiry

## Manual contractor portal regression

Status: `MANUAL QA REQUIRED`

Automated checks do not replace the required human flows. Record environment,
date, tester, setup/input, expected result, and actual result for contractor
login, dashboard, feed, masking, insufficient wallet, top-up, acceptance,
snapshot deduction, duplicate prevention, contact reveal, accepted history, and
the SMS magic-link path when a usable provider is configured.
