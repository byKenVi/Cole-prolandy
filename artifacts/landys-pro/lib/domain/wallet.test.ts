import { describe, it, expect } from "vitest";
import type { Prisma } from "@prisma/client";
import { WalletTransactionType } from "@prisma/client";
import { applyWalletTransactionInTx } from "./wallet";
import { chargeForLead } from "./leads";
import { InsufficientBalanceError } from "./errors";
import { createFakeDb, type FakeDb } from "./__fixtures__/fakeDb";
import { formatMoney } from "@/lib/money";

const asTx = (db: FakeDb) => db as unknown as Prisma.TransactionClient;

function seedContractor(db: FakeDb, balanceCents: number) {
  const id = "c1";
  db.contractor.seed([{ id, walletBalanceCents: balanceCents }]);
  return id;
}

describe("applyWalletTransactionInTx", () => {
  it("credits a top-up and updates the balance", async () => {
    const db = createFakeDb();
    const contractorId = seedContractor(db, 1000);

    const res = await applyWalletTransactionInTx(asTx(db), {
      contractorId,
      amountCents: 5000,
      type: WalletTransactionType.TOPUP,
    });

    expect(res.newBalanceCents).toBe(6000);
    expect(db.walletTransaction.rows).toHaveLength(1);
    expect(db.walletTransaction.rows[0].type).toBe(WalletTransactionType.TOPUP);
  });

  it("debits a charge and lowers the balance", async () => {
    const db = createFakeDb();
    const contractorId = seedContractor(db, 10000);

    const res = await applyWalletTransactionInTx(asTx(db), {
      contractorId,
      amountCents: -4000,
      type: WalletTransactionType.LEAD_CHARGE,
    });

    expect(res.newBalanceCents).toBe(6000);
  });

  it("blocks a debit that would go negative (insufficient balance)", async () => {
    const db = createFakeDb();
    const contractorId = seedContractor(db, 3000);

    await expect(
      applyWalletTransactionInTx(asTx(db), {
        contractorId,
        amountCents: -4000,
        type: WalletTransactionType.LEAD_CHARGE,
      }),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);

    // Balance untouched, no transaction written.
    expect(db.contractor.rows[0].walletBalanceCents).toBe(3000);
    expect(db.walletTransaction.rows).toHaveLength(0);
  });

  it("reports the correct shortfall on insufficient balance", async () => {
    const db = createFakeDb();
    const contractorId = seedContractor(db, 3000);
    try {
      await applyWalletTransactionInTx(asTx(db), {
        contractorId,
        amountCents: -5000,
        type: WalletTransactionType.LEAD_CHARGE,
      });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(InsufficientBalanceError);
      expect((e as InsufficientBalanceError).shortfallCents).toBe(2000);
    }
  });

  it("credits a refund back to the wallet", async () => {
    const db = createFakeDb();
    const contractorId = seedContractor(db, 0);

    const res = await applyWalletTransactionInTx(asTx(db), {
      contractorId,
      amountCents: 4000,
      type: WalletTransactionType.REFUND,
    });

    expect(res.newBalanceCents).toBe(4000);
  });

  it("rejects non-integer cents", async () => {
    const db = createFakeDb();
    const contractorId = seedContractor(db, 1000);
    await expect(
      applyWalletTransactionInTx(asTx(db), {
        contractorId,
        amountCents: 12.5,
        type: WalletTransactionType.TOPUP,
      }),
    ).rejects.toThrow();
  });
});

describe("chargeForLead", () => {
  it("debits the lead price and links the leadMatch", async () => {
    const db = createFakeDb();
    const contractorId = seedContractor(db, 20000);

    const res = await chargeForLead(asTx(db), {
      contractorId,
      leadMatchId: "lm1",
      priceCents: 4000,
    });

    expect(res.newBalanceCents).toBe(16000);
    expect(db.walletTransaction.rows[0].leadMatchId).toBe("lm1");
    expect(db.walletTransaction.rows[0].amountCents).toBe(-4000);
  });

  it("blocks when balance is below the lead price", async () => {
    const db = createFakeDb();
    const contractorId = seedContractor(db, 1000);
    await expect(
      chargeForLead(asTx(db), {
        contractorId,
        leadMatchId: "lm1",
        priceCents: 4000,
      }),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });
});

describe("formatMoney", () => {
  it("formats integer cents as USD", () => {
    expect(formatMoney(123400)).toBe("$1,234.00");
    expect(formatMoney(4000)).toBe("$40.00");
    expect(formatMoney(0)).toBe("$0.00");
  });
});
