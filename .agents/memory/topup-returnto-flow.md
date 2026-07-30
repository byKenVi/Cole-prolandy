---
name: Stripe top-up returnTo flow
description: How the inline top-up dialog threads the caller's page URL through Stripe Checkout so the user returns to the right place.
---

## Rule
When `InlineTopUpDialog` (or any caller) triggers a Stripe Checkout via `startTopUp`, it passes `window.location.pathname + window.location.search` as the optional `returnTo` argument so that after payment the user returns to the originating page (e.g. the lead detail) rather than `/wallet`.

**Why:** Without this, a contractor who has no saved card gets redirected to `/wallet` after Stripe Checkout and has to manually navigate back to the lead to complete the purchase. The seamless flow requires returning to the lead.

**How to apply:**
- `startTopUp(amountCents, window.location.origin, window.location.pathname + window.location.search)`
- The action appends `returnTo=<encoded path>` to the `successUrl` query string.
- `wallet/topup/complete/route.ts` reads `returnTo`, validates it is a same-origin path (starts with `/`, not `//`), strips any existing `topup` param, then redirects there with `?topup=success|pending` instead of always going to `/wallet`.
- The lead detail page reads `searchParams.topup` and renders a contextual banner ("Funds added — you can accept now" or "Payment received — refresh and then accept").
- `returnTo` is never used when status is `"error"` — errors always go to `/wallet`.
