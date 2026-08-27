---
name: Destructive-action burst guard
description: Contractor deactivate/delete and lead refund are gated by a DB-backed burst guard (lib/domain/destructive-guard.ts) — what it does and why it's shaped this way.
---

## What it does
`assertNoDestructiveBurst({ actorId, action })` counts `AuditLog` rows for the
same actor + exact action within a short rolling window and throws
`DestructiveBurstError` (a `DomainError`) past a threshold. It's called at the
top of `deactivateContractor`, `deleteContractor`, and `refundLead` in
`app/actions/admin.ts`, before the target row is even looked up.

## Why this shape
- **DB-backed, not in-memory** — must work across autoscale instances; an
  in-process counter would reset per instance and miss a burst spread across
  them.
- **Scoped to actor + exact action, not a global rate limit** — a real admin
  doing normal one-off admin work should never see it. It only fires on rapid
  repetition of the *same* destructive action by the *same* actor, which is
  what an automated sweep looks like and a human clicking through a UI does
  not.
- **Not a blanket rate limiter** — added specifically because a real incident
  (see `shared-dev-prod-database-risk.md`) demonstrated the failure mode it
  prevents; it isn't a default hardening measure applied without cause.
- Each guarded action has its own counter (keyed by its exact `action`
  string), so tripping the guard on one action (e.g. delete) does not block a
  different action (e.g. deactivate) for the same admin.

## Testing pattern
Covered by two test styles — reuse both patterns for future destructive
actions:
1. `lib/domain/destructive-guard.test.ts` — isolated unit test of the guard
   helper itself (mocks `@/lib/prisma`'s `auditLog.count`).
2. `app/actions/contractor-destructive-guard.test.ts` — integration-style test
   through the real server actions (mocks `@/lib/auth`'s `requireAdmin` and
   `@/lib/prisma`), verifying a single action still succeeds normally and a
   burst is refused. This is the pattern to copy when adding the guard to a
   new destructive action, rather than validating it by driving the real UI
   against real data.
