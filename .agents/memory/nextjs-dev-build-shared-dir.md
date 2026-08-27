---
name: Next.js dev and build share .next/ — don't run both at once
description: Running `next build` while a `next dev` workflow is live in the same app dir corrupts both.
---

`next dev` and `next build` both write to `.next/` in the app directory by
default. Running a manual production build (e.g. as part of a deployment
readiness check) while the dev workflow is still running against the same
directory causes both to fail with `ENOENT`/`Cannot find module './NNNN.js'`
errors, since one process deletes/rewrites files the other has open or expects.

**Why:** observed directly — running `next build` alongside a live
`artifacts/landys-pro: web` dev workflow broke the dev server (manifest files
missing, chunk require errors) and also made the build itself throw an
unhandled rejection mid-build.

**How to apply:** before running a standalone `next build` verification, stop
the dev workflow for that app first (or accept that it will need a restart
afterward). After the build finishes, `rm -rf .next` and restart the dev
workflow so it regenerates its own dev-mode artifacts — production build
output and dev output are not interchangeable.
