---
name: Shared dev/test/production database risk
description: This project's DATABASE_URL/DIRECT_URL secrets are flat (not per-environment) — dev workflow, vitest, the Playwright testing subagent, and the deployed production app all read the same database. Read before running any bulk or destructive flow through the testing subagent.
---

## What happened
On Aug 26-27 2026, 66 of ~70 real contractors were deactivated in a ~2.5 hour
automated burst (~3s cadence) through the genuine `deactivateContractor` admin
action, authenticated as a real admin. No deploy had happened yet at the time
(production logs for the window were empty), so the mutations went straight
into the database everyone shares. The best-supported explanation (not a
100%-confirmed trace) is an automated/testing browser session that swept the
admin contractor list rather than touching one seeded row.

## Why this is possible here
`viewEnvVars` confirmed secrets in this project (including `DATABASE_URL` /
`DIRECT_URL`) are flat/global, not environment-scoped, and the `testing`
skill's own docs state the Playwright subagent "uses the same development
database as you and the user." There is no separate throwaway DB for
dev/tests here — anything a script or tester does to real-looking rows is a
real, permanent mutation.

## How to apply
- Never write a test plan (for the testing subagent, or any ad-hoc script)
  that iterates/sweeps every row of an admin list to exercise a destructive
  action (deactivate, delete, refund, bulk-update). Scope destructive test
  steps to one clearly-marked, pre-created test record, and say so explicitly
  in the task text.
- If a task must validate "does the bulk-guard/rate-limit trip correctly,"
  prefer a mocked-DB unit/integration test (see `destructive-guard.md`) over
  driving the real UI/server actions repeatedly against real data.
- If the user ever wants real environment isolation, the durable fix is
  provisioning a separate dev/test database — that's an infra/cost decision
  requiring explicit user sign-off, not something to do unilaterally.
