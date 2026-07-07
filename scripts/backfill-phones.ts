/**
 * One-off backfill: normalize existing Contractor.phone values to E.164.
 *
 * Rows created before phone normalization was added store raw strings like
 * "(555) 123-4567", which never match a Clerk-verified "+15551234567" at first
 * login. This rewrites each contractor's phone to its canonical E.164 form so
 * the backfill-on-sign-in matching works for pre-existing data.
 *
 * Safe to re-run: only rows whose normalized value differs are updated. Numbers
 * that can't be parsed/validated are left untouched and reported.
 *
 * Run with:  npx tsx scripts/backfill-phones.ts
 * Dry run:   npx tsx scripts/backfill-phones.ts --dry
 */
import { PrismaClient } from "@prisma/client";
import { normalizePhone } from "../lib/phone";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry");

async function main() {
  const contractors = await prisma.contractor.findMany({
    select: { id: true, name: true, phone: true },
    orderBy: { createdAt: "asc" },
  });

  let updated = 0;
  let unchanged = 0;
  const unparseable: { id: string; name: string; phone: string }[] = [];

  for (const c of contractors) {
    const canonical = normalizePhone(c.phone);

    if (!canonical) {
      unparseable.push({ id: c.id, name: c.name, phone: c.phone });
      continue;
    }
    if (canonical === c.phone) {
      unchanged++;
      continue;
    }

    console.log(`${DRY_RUN ? "[dry] " : ""}${c.name}: "${c.phone}" -> "${canonical}"`);
    if (!DRY_RUN) {
      await prisma.contractor.update({ where: { id: c.id }, data: { phone: canonical } });
    }
    updated++;
  }

  console.log("\n── Summary ──");
  console.log(`Contractors scanned:   ${contractors.length}`);
  console.log(`${DRY_RUN ? "Would update:          " : "Updated:               "}${updated}`);
  console.log(`Already canonical:     ${unchanged}`);
  console.log(`Left as-is (unparsed): ${unparseable.length}`);
  for (const u of unparseable) {
    console.log(`   ! ${u.name} (${u.id}): "${u.phone}" — could not normalize, review manually`);
  }
  if (DRY_RUN) console.log("\nDry run — no changes written. Re-run without --dry to apply.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
