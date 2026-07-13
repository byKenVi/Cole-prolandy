/**
 * Remove seed/mock wallet ledger rows that never hit Stripe, then rebuild
 * contractor.walletBalanceCents from the remaining transactions.
 *
 * Targets:
 *   - TOPUP with note "Initial wallet funding" (prisma seed)
 *   - LEAD_CHARGE / REFUND on leads with source = "seed"
 *
 * Usage:
 *   node scripts/reconcile-seed-wallets.mjs           # dry-run
 *   node scripts/reconcile-seed-wallets.mjs --apply   # write
 */
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

function money(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

async function main() {
  const mockTopups = await prisma.walletTransaction.findMany({
    where: {
      type: "TOPUP",
      OR: [
        { note: "Initial wallet funding" },
        { note: { contains: "seed" } },
      ],
    },
    select: { id: true, contractorId: true, amountCents: true, note: true },
  });

  const seedLeads = await prisma.lead.findMany({
    where: { source: "seed" },
    select: { id: true },
  });
  const seedLeadIds = seedLeads.map((l) => l.id);

  const seedMatchIds =
    seedLeadIds.length === 0
      ? []
      : (
          await prisma.leadMatch.findMany({
            where: { leadId: { in: seedLeadIds } },
            select: { id: true },
          })
        ).map((m) => m.id);

  const seedMoneyTxs =
    seedMatchIds.length === 0
      ? []
      : await prisma.walletTransaction.findMany({
          where: {
            leadMatchId: { in: seedMatchIds },
            type: { in: ["LEAD_CHARGE", "REFUND"] },
          },
          select: { id: true, contractorId: true, amountCents: true, type: true },
        });

  const beforeHeld = await prisma.contractor.aggregate({
    _sum: { walletBalanceCents: true },
  });
  const beforeTopups = await prisma.walletTransaction.aggregate({
    _sum: { amountCents: true },
    where: { type: "TOPUP" },
  });
  const beforeCharges = await prisma.walletTransaction.aggregate({
    _sum: { amountCents: true },
    where: { type: "LEAD_CHARGE" },
  });
  const beforeRefunds = await prisma.walletTransaction.aggregate({
    _sum: { amountCents: true },
    where: { type: "REFUND" },
  });

  console.log(apply ? "APPLY mode" : "DRY-RUN (pass --apply to write)");
  console.log("Before:");
  console.log(`  Held wallets:     ${money(beforeHeld._sum.walletBalanceCents ?? 0)}`);
  console.log(`  Card top-ups:     ${money(beforeTopups._sum.amountCents ?? 0)}`);
  console.log(`  Lead charges:     ${money(Math.abs(beforeCharges._sum.amountCents ?? 0))}`);
  console.log(`  Lead refunds:     ${money(beforeRefunds._sum.amountCents ?? 0)}`);
  console.log(
    `  Seed TOPUPs:      ${mockTopups.length} (${money(mockTopups.reduce((s, t) => s + t.amountCents, 0))})`,
  );
  console.log(`  Seed lead txs:    ${seedMoneyTxs.length}`);

  if (!apply) {
    console.log("\nNo changes written.");
    return;
  }

  const deleteIds = [...mockTopups.map((t) => t.id), ...seedMoneyTxs.map((t) => t.id)];

  // Short batched deletes — avoid one long interactive transaction (P2028 timeouts).
  const chunk = 50;
  for (let i = 0; i < deleteIds.length; i += chunk) {
    const slice = deleteIds.slice(i, i + chunk);
    await prisma.walletTransaction.deleteMany({ where: { id: { in: slice } } });
  }

  const contractors = await prisma.contractor.findMany({
    select: { id: true, name: true },
  });
  for (const c of contractors) {
    const sum = await prisma.walletTransaction.aggregate({
      _sum: { amountCents: true },
      where: { contractorId: c.id },
    });
    // Never leave a negative spendable balance after seed cleanup.
    const next = Math.max(0, sum._sum.amountCents ?? 0);
    await prisma.contractor.update({
      where: { id: c.id },
      data: { walletBalanceCents: next },
    });
    console.log(`  ${c.name}: wallet → ${money(next)}`);
  }

  const afterHeld = await prisma.contractor.aggregate({
    _sum: { walletBalanceCents: true },
  });
  const afterTopups = await prisma.walletTransaction.aggregate({
    _sum: { amountCents: true },
    where: { type: "TOPUP" },
  });
  const afterCharges = await prisma.walletTransaction.aggregate({
    _sum: { amountCents: true },
    where: { type: "LEAD_CHARGE" },
  });
  const afterRefunds = await prisma.walletTransaction.aggregate({
    _sum: { amountCents: true },
    where: { type: "REFUND" },
  });

  console.log("\nAfter:");
  console.log(`  Held wallets:     ${money(afterHeld._sum.walletBalanceCents ?? 0)}`);
  console.log(`  Card top-ups:     ${money(afterTopups._sum.amountCents ?? 0)}`);
  console.log(`  Lead charges:     ${money(Math.abs(afterCharges._sum.amountCents ?? 0))}`);
  console.log(`  Lead refunds:     ${money(afterRefunds._sum.amountCents ?? 0)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
