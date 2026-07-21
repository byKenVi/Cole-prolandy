/**
 * Local Stripe webhook validator (no stripe login/listen required).
 * Signs a checkout.session.completed event with STRIPE_WEBHOOK_SECRET and POSTs
 * it to the running dev server, proving: signature verification, crediting, and
 * idempotency (duplicate delivery credits zero more). Run:
 *   node scripts/test-webhook.mjs
 */
import { readFileSync } from "node:fs";

// Minimal .env loader (no dependency).
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const key = line.slice(0, i).trim();
  let val = line.slice(i + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (process.env[key] === undefined) process.env[key] = val;
}

const BASE = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
const secret = process.env.STRIPE_WEBHOOK_SECRET;
if (!secret || !secret.startsWith("whsec_")) {
  console.error("STRIPE_WEBHOOK_SECRET missing or malformed:", secret);
  process.exit(1);
}
if (process.env.STRIPE_MOCK !== "false") {
  console.error('STRIPE_MOCK must be "false" to test real Stripe. Current:', process.env.STRIPE_MOCK);
  process.exit(1);
}

const { default: Stripe } = await import("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const c = await prisma.contractor.findFirst({
  select: { id: true, name: true, walletBalanceCents: true },
  orderBy: { createdAt: "asc" },
});
if (!c) {
  console.error("No contractor found. Create one from Admin before testing the webhook.");
  process.exit(1);
}
console.log(`Contractor: ${c.name} (${c.id})`);
console.log(`Balance before: ${c.walletBalanceCents}c`);

const amountCents = 5000;
const event = {
  id: "evt_test_" + Date.now(),
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_" + Date.now(),
      object: "checkout.session",
      metadata: { contractorId: c.id },
      amount_total: amountCents,
      payment_intent: "pi_test_" + Date.now(),
    },
  },
};
const payload = JSON.stringify(event);
const goodHeader = stripe.webhooks.generateTestHeaderString({ payload, secret });

async function post(body, header) {
  const r = await fetch(`${BASE}/api/stripe/webhook`, {
    method: "POST",
    headers: { "stripe-signature": header, "content-type": "application/json" },
    body,
  });
  return `${r.status} ${await r.text()}`;
}

console.log("\n1) Valid signed event   :", await post(payload, goodHeader));
console.log("2) Duplicate (same id)  :", await post(payload, goodHeader));
console.log("3) Forged signature     :", await post(payload, "t=1,v1=deadbeef"));

const after = await prisma.contractor.findUnique({
  where: { id: c.id },
  select: { walletBalanceCents: true },
});
const delta = after.walletBalanceCents - c.walletBalanceCents;
console.log(`\nBalance after: ${after.walletBalanceCents}c  (delta +${delta}c)`);
console.log(
  delta === amountCents
    ? "PASS: credited exactly once (idempotency holds)."
    : `FAIL: expected +${amountCents}c exactly once, got +${delta}c.`,
);

await prisma.$disconnect();
