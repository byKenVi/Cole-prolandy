---
name: pnpm pin on Replit
description: Why the workspace packageManager version must match the pnpm runtime supplied by Replit.
---

Keep the root `packageManager` pnpm version aligned with the pnpm version installed by the Replit runtime.

**Why:** A newer pin caused pnpm to repeatedly invoke `pnpm add pnpm@...` while trying to self-manage the requested version. The recursion aborted package operations and prevented every pnpm-backed workflow from starting.

**How to apply:** Before changing the pnpm pin or debugging a workflow that loops on `pnpm add pnpm@...`, compare the root pin with `pnpm --version`. Prefer the Replit-supplied version unless the runtime/toolchain is intentionally upgraded as one coordinated change.