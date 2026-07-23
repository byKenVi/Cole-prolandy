---
name: Clerk magic link 403 in proxy setup
description: Root cause and fix for Clerk invitation/magic-link blank 403 on fresh browsers (Cloudflare challenge on tickets/accept via FAPI proxy).
---

## The Bug
Invitation / magic-link click from a fresh browser → blank 403 page.
Second click, or any click after visiting the site once, can appear to work (false positive).

## Root Cause (proven)
`GET /api/__clerk/v1/tickets/accept` was proxied to `frontend-api.clerk.dev`.

Cloudflare on that host issues a managed bot challenge for server-proxied GETs with no browser fingerprint:

1. Challenge HTML needs `/cdn-cgi/challenge-platform/...` relative to the **app** origin — Express only proxies `/api/__clerk/*` → script never loads → blank page.
2. Clearance `Set-Cookie` is scoped to Clerk's domain → browser on `*.replit.app` rejects it.

Fresh browsers always hit this path. Warm browsers may skip or score differently → intermittent / false “fixed” validations.

Location-header rewriting on the proxy does **not** fix this; the GET must never reach Cloudflare.

## Fix Applied
In `artifacts/api-server/src/app.ts`, mount **before** `clerkProxyMiddleware()`:

```ts
app.get(`${CLERK_PROXY_PATH}/v1/tickets/accept`, (req, res) => {
  const ticket = typeof req.query.ticket === "string" ? req.query.ticket : "";
  if (!ticket) {
    res.redirect(302, "/sign-up");
    return;
  }
  res.redirect(302, `/sign-up?${new URLSearchParams({ __clerk_ticket: ticket })}`);
});
```

Matches Clerk's documented behavior (redirect with `__clerk_ticket`) and invitations' `redirectUrl: ${appUrl()}/sign-up`. Ticket JWT is validated later by `<SignUp/>` via `strategy: "ticket"`.

**Do not** move this handler under the proxy. POST `/tickets/accept` and all other FAPI paths stay proxied.

## Related
- `/post-auth` stays public (session cookie race after successful auth).
- Proxy still rewrites FAPI `Location` + preserves `Set-Cookie` for other flows.
