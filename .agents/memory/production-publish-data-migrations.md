---
name: Production publish data migrations
description: Replit Publish schema sync versus Prisma migrations that also insert required reference data.
---

Replit Publish may synchronize the complete Production schema without populating Prisma's migration ledger or executing data inserts embedded in migration SQL.

**Why:** A fresh native Production database matched Development structurally after Publish, but had zero migration ledger entries and empty taxonomy, settings, and fee-tier tables.

**How to apply:** Before handoff, verify reference-row counts separately from schema diff. Since agent Production SQL access is read-only, use an existing approved Production initializer or an operator-controlled supported path; never copy Development fixtures or add startup DDL.