/**
 * CLI: success-fee operational reset (dry-run by default).
 *
 * DRY RUN:
 *   pnpm exec tsx ./scripts/success-fee-operational-reset.ts
 *
 * EXECUTE (destructive — production only after review):
 *   pnpm exec tsx ./scripts/success-fee-operational-reset.ts --execute
 */
import { PrismaClient } from "@prisma/client";
import {
  formatResetReport,
  runOperationalReset,
} from "../lib/ops/success-fee-operational-reset";

const prisma = new PrismaClient();

async function main() {
  const execute = process.argv.includes("--execute");

  if (execute) {
    console.log("⚠  EXECUTE MODE — operational data will be deleted.");
    console.log("   Press Ctrl+C within 3s to abort…\n");
    await new Promise((r) => setTimeout(r, 3000));
  } else {
    console.log("DRY RUN — no data will be changed. Pass --execute to apply.\n");
  }

  const { plan, before, after } = await runOperationalReset(prisma, { execute });
  console.log(formatResetReport(plan, "before"));
  console.log("");
  console.log("BEFORE COUNTS (raw)");
  console.log(JSON.stringify(before, null, 2));

  if (after) {
    console.log("");
    console.log("AFTER COUNTS (raw)");
    console.log(JSON.stringify(after, null, 2));
    console.log("");
    console.log("✓ Reset completed. Preservation invariants passed.");
  } else {
    console.log("");
    console.log("Dry run complete. Re-run with --execute to apply.");
  }
}

main()
  .catch((err) => {
    console.error("Reset failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
