---
name: api-server proxy routing
description: The Replit path-based proxy routes /api/* to the api-server artifact (port 8080), not to the Next.js app (port 21066). This intercepts Next.js /api routes including the Stripe webhook.
---

## Rule
Never create Next.js `/api/*` routes that need to be reachable from the browser or from external services (like Stripe webhooks) without accounting for the api-server path intercept.

**Why:** The artifact.toml for api-server has `paths = ["/api"]`, giving it priority over Next.js for all `/api/*` traffic. Next.js's `/api` routes are unreachable from outside unless proxied.

## How to apply
- **Server actions** (POST to Next.js action endpoint): not affected, safe to use.
- **Next.js API routes reachable from browser**: use a non-`/api` prefix (e.g., `/internal/...`) OR use a server action instead.
- **External webhooks (Stripe, etc.) at `/api/...`**: the api-server now transparently proxies all unhandled `/api/*` routes to Next.js (port 21066). Raw body is preserved (no express.json() before the proxy) so Stripe signature verification works.
- **Fix applied**: `artifacts/api-server/src/app.ts` uses `http-proxy-middleware` to forward unmatched routes to `http://localhost:21066`.
