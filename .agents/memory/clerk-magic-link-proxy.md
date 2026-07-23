---
name: Clerk magic link 403 in proxy setup
description: Root cause and fix for Clerk magic link failing on first click for fresh browsers in the Replit proxy environment.
---

## The Bug
Magic link click from a fresh browser (no `__client_uat` cookie) → blank 403 page.
Second click, or any click after visiting the site once, works fine.

## Root Cause (primary)
Deployment uses a custom Express FAPI proxy at `/api/__clerk` (Replit routes `/api/*` to api-server).

Clerk v5 middleware performs a "handshake" for fresh browsers (no `__client_uat`):
1. Middleware redirects to `/api/__clerk/v1/client/handshake?redirect_url=<original>`
2. Proxy → Clerk FAPI → may **302/307** with `Location: https://frontend-api.clerk.dev/...`
3. Official Clerk proxy **rewrites** that Location back through the app proxy path
4. Our Express proxy previously **did not rewrite Location** → browser followed Clerk's absolute FAPI host → 403 on `.replit.app` / cookie never set on the app domain
5. Ticket exchange (`/api/__clerk/v1/tickets/accept`) then fails for the same cold-client reason

## Secondary race
After a successful ticket exchange, Clerk redirects to `/post-auth` (forceRedirectUrl).
If `/post-auth` is protected with `auth.protect()`, the server can 403 before Clerk JS finishes writing the session cookie. `/post-auth` must stay public; the page waits on `useAuth().isLoaded` and briefly retries while `!isSignedIn`.

## Why "visiting first" fixes it
Visiting any public page lets Clerk JS initialize via XHR through the proxy, sets `__client_uat` on the app domain, and skips the handshake navigation on the next magic-link click.

## Fix Applied
1. **`clerkProxyMiddleware.ts`**: rewrite FAPI `Location` headers to `${origin}/api/__clerk/...`; normalize multi-value `Set-Cookie`.
2. **`middleware.ts`**: keep `/post-auth` public; also public `/api/__clerk(.*)` so a misrouted handshake never hits `auth.protect()`.
3. **`post-auth/page.tsx`**: wait ~2.5s before treating unsigned-in as failure; preserve ticket query params when falling back to `/sign-in`.

## Additional Note
`GET /api/__clerk/v1/tickets/accept` 403s also appear for **expired contractor invitations** (not just magic links). Those are harmless — invitations time out and the 403 is expected.
