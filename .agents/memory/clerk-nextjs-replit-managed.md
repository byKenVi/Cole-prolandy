---
name: Clerk + Next.js App Router — Replit-managed setup
description: Non-obvious wiring required when using Replit-managed Clerk with @clerk/nextjs in a Next.js 15 App Router project inside the pnpm workspace.
---

## The problem

`setupClerkWhitelabelAuth()` sets three secrets:
- `CLERK_SECRET_KEY` (overwrites any existing value)
- `CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_PUBLISHABLE_KEY`

It does NOT set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, which `@clerk/nextjs`'s `ClerkProvider` reads automatically. If a stale personal `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` secret exists, the server uses it while `CLERK_SECRET_KEY` is from a different Clerk tenant → mismatched keys → "Invalid hook call" + hydration failure on every page load.

## Fix 4 — Clerk FAPI proxy URL for production — CRITICAL

Without a proxy URL, Clerk JS in the browser calls Clerk's FAPI directly, which fails for non-DNS-verified `.replit.app` domains → blank sign-in page.

**Do NOT pass `proxyUrl` as a prop to `ClerkProvider`** — `@clerk/nextjs` accesses `window` at module load time when `proxyUrl` is supplied, causing `window is not defined` during static page prerendering and a broken deployment build.

**Correct approach for Next.js:**
1. Set `CLERK_PROXY_URL` as a **production env var** (via `setEnvVars`) to `https://<domain>/api/__clerk`.
2. In `next.config.ts` `env` block: `NEXT_PUBLIC_CLERK_PROXY_URL: process.env.CLERK_PROXY_URL ?? ""`
   - Bakes `""` locally (empty = dev Clerk hits FAPI directly, correct) and `"https://..."` in deployment builds (correct).
3. `middleware.ts` clerkMiddleware: `proxyUrl: process.env.CLERK_PROXY_URL || undefined` is safe here (runtime, not prerender).
4. **Do not** add `proxyUrl` prop to `<ClerkProvider>` — Clerk reads `NEXT_PUBLIC_CLERK_PROXY_URL` from the baked bundle automatically.
5. **@clerk/shared pnpm patch is required** — `proxyUrlToAbsoluteURL` in `@clerk/shared/dist/runtime/proxy-B_Yui2Mf.js` and `.mjs` accesses `window.location.origin` without an SSR guard. Without the patch, any non-empty `NEXT_PUBLIC_CLERK_PROXY_URL` causes `window is not defined` during static page prerendering. Patch adds `typeof window !== "undefined"` guard. Patch file: `patches/@clerk__shared@3.47.8.patch`, wired via `pnpm.patchedDependencies` in root `package.json`.

## Fix 1 — explicit publishableKey in layout.tsx

```tsx
const publishableKey =
  process.env.CLERK_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  "";

return clerk ? (
  <ClerkProvider publishableKey={publishableKey} ...>
    {tree}
  </ClerkProvider>
) : tree;
```

## Fix 2 — explicit publishableKey in middleware.ts

```ts
const clerkHandler = clerkMiddleware(
  async (auth, req) => { ... },
  {
    publishableKey:
      process.env.CLERK_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  },
);
```

## Fix 3 — NEXT_PUBLIC_CLERK_KEYLESS_DISABLED in next.config.ts (CRITICAL)

In `@clerk/nextjs` ≥ 6.x, `canUseKeyless = true` when `NODE_ENV=development`. This causes
`NextClientClerkProvider` to call `detectKeylessEnvDriftAction()` from inside `useLayoutEffect`
**without** `React.startTransition` — a React 19 invariant violation that crashes every page
with "Invalid hook call" + "Hydration failed", even when a valid publishableKey is supplied.

Fix: bake `NEXT_PUBLIC_CLERK_KEYLESS_DISABLED=true` via next.config.ts env:

```ts
env: {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY ?? ...,
  NEXT_PUBLIC_CLERK_KEYLESS_DISABLED: "true",  // disables keyless code path
},
```

**Why:** `KEYLESS_DISABLED=true` → `canUseKeyless=false` → skips the problematic
`detectKeylessEnvDriftAction()` call and the `LazyCreateKeylessApplication` wrapper that
uses `React.useActionState` — both of which violate React 19 hook rules in dev mode.
After changing this, delete `.next/` and restart the dev server.

## Supporting changes in next.config.ts

Forward `CLERK_PUBLISHABLE_KEY` → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` for the client bundle.
System env vars take precedence over this on the server, so the explicit prop in layout.tsx is still required.

## Also fix `clerkMiddleware()` in middleware.ts

See Fix 2 above. Without this, every Clerk auth check fails at the middleware level → the
Replit iframe proxy shows "artifact encountered an error".

## Restart requirement

After changing Clerk keys, `AUTH_MODE`, or any of the above, **delete `.next/`** and restart
the dev server — middleware inlines env at compile time and HMR does not pick up the change.

## Stripe

The Replit Stripe OAuth connector does NOT inject `STRIPE_SECRET_KEY` as an env var — it's for
querying Stripe data through the proxy only. The app needs `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET` as raw Replit Secrets supplied by the user from the Stripe dashboard.
