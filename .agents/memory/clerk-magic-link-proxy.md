---
name: Clerk magic link 403 in proxy setup
description: Root cause and fix for Clerk magic link failing on first click for fresh browsers in the Replit proxy environment.
---

## The Bug
Magic link click from a fresh browser (no `__client_uat` cookie) → blank 403 page.
Second click, or any click after visiting the site once, works fine.

## Root Cause
Deployment logs show: `GET /api/__clerk/v1/tickets/accept` returns 403 from Clerk FAPI.

Clerk v5 middleware performs a "handshake" for fresh browsers (no `__client_uat` cookie):
1. Middleware redirects to `/api/__clerk/v1/client/handshake?redirect_url=<original>`
2. Proxy → Clerk FAPI → sets `__client_uat` cookie → redirects back
3. Clerk JS exchanges the `__clerk_ticket` / `__clerk_db_jwt` for a session
4. Redirects to `forceRedirectUrl="/post-auth"`

Step 4 hits `/post-auth` which is a **protected route** (`auth.protect()`). Because the session cookie isn't fully propagated yet by the time the server sees the redirect, `auth.protect()` fires → 403 / redirect loop.

## Why "visiting first" fixes it
Visiting any public page triggers the handshake, sets `__client_uat`, and allows Clerk JS to initialize and write cookies client-side. Future requests (including magic link clicks) skip the handshake entirely.

## Fix Applied
Added `/post-auth` to `publicRoutes` in `middleware.ts`. The page is self-protecting via client-side `if (!isSignedIn) router.replace("/sign-in")`.

**Why:**  `post-auth/page.tsx` is a client component that waits for Clerk's `isLoaded` before acting. Making it public lets Clerk JS complete the ticket exchange before any `auth.protect()` can interfere.

## Additional Note
`GET /api/__clerk/v1/tickets/accept` 403s also appear for **expired contractor invitations** (not just magic links). These are harmless — invitations time out and the 403 is expected.
