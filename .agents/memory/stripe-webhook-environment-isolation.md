---
name: Stripe webhook environment isolation
description: Why real Development Stripe tests must account for the connector's published webhook endpoint.
---

Replit's native Stripe integration can automatically expose test credentials in Preview, but that does not guarantee account-level webhook isolation from an existing published test-mode endpoint. Do not assume a test key or a second endpoint isolates delivery.

**Why:** A Development success-fee smoke reached the published webhook. Later inspection showed the Replit Preview connector's test key could list both the managed Preview endpoint and the enabled published test endpoint in one Stripe account, with overlapping event subscriptions.

**How to apply:** Before creating any Development Stripe object, list enabled webhook endpoints visible to the Preview credential. Fail closed if another endpoint subscribes to Landy's events. A second endpoint is insufficient; use a distinct account/mode or disable the published test endpoint.

Reconnecting the native Replit Stripe integration to a genuinely separate test account establishes the required boundary. Verify isolation by confirming the old account's endpoint IDs and URLs are not listable before running a real smoke.