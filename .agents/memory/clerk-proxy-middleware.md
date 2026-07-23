---
name: Clerk proxy middleware wiring
description: How the Clerk FAPI proxy is wired in this monorepo and why NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must not be baked at build time.
---

## Rule
`clerkProxyMiddleware` (from `.local/skills/clerk-auth/templates/api-server/src/middlewares/clerkProxyMiddleware.ts`) must be mounted in `artifacts/api-server/src/app.ts` at `CLERK_PROXY_PATH` (`/api/__clerk`) **before** CORS and body parsers.

`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` must **not** appear in `next.config.ts`'s `env` block.

**Why:**
In production, Replit sets `CLERK_PROXY_URL` so Clerk JS routes all auth calls through `/api/__clerk`. Without the proxy middleware, those calls have no forwarder to Clerk's FAPI → `<SignIn />` renders blank.

The `env` block runs at **build time**. Replit only injects production secrets (`pk_live_...`) at **runtime**, not during the build. So baking `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY` in `next.config.ts` always bakes `pk_test_...` into the production bundle, causing the "development keys" warning and potential auth failure.

**How to apply:**
- `@clerk/nextjs` reads `CLERK_PUBLISHABLE_KEY` server-side at request time and propagates it to the client through React SSR context via the `publishableKey` prop on `ClerkProvider`. No `NEXT_PUBLIC_` env var needed.
- The `clerkProxyMiddleware` no-ops in `NODE_ENV !== 'production'` so it's safe to mount unconditionally.
