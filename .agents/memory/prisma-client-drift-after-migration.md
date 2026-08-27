---
name: Prisma client drift after schema/migration changes
description: Why tsc/runtime can still show old model shapes right after a migration applies cleanly, and when to run `prisma generate`.
---

`prisma migrate deploy` only updates the database schema — it does not regenerate
`@prisma/client`. If new models/enums were added to `schema.prisma` and the
generated client wasn't regenerated since, `tsc --noEmit` and any running dev
server will report the new fields/models as nonexistent (e.g.
`Property 'successFee' does not exist on type 'PrismaClient'`), even though the
migration applied successfully and the tables are really there.

**Why:** the generated client is a build artifact checked against `schema.prisma`
at generation time, not against the live DB. `postinstall` and the production
`build` script (`prisma generate && next build`) both regenerate it, so a real
deploy build self-heals — but a `next dev` workflow left running since before
the schema change will not, until it's restarted after a manual `prisma generate`.

**How to apply:** whenever a deployment-readiness check finds new Prisma
models/enums in `schema.prisma` that a fresh `tsc --noEmit` reports as missing,
run `prisma generate` (safe, non-destructive) before concluding there's a real
type error, then re-run typecheck to confirm.
