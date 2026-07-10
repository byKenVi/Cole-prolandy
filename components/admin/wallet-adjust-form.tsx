"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { chargeSavedCardTopUp } from "@/app/actions/admin";
import { dollarsToCents } from "@/lib/money";

/**
 * Admin wallet recharge only — charges the contractor's saved card and tops up
 * their wallet. Lead restitutions live in the separate LeadRestitutionList.
 */
export function WalletRechargeForm({
  contractorId,
  hasSavedCard,
}: {
  contractorId: string;
  hasSavedCard: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    const cents = dollarsToCents(amount);
    if (!cents) {
      setResult({ ok: false, message: "Enter a valid amount." });
      return;
    }
    if (!reason.trim()) {
      setResult({ ok: false, message: "A reason is required." });
      return;
    }
    startTransition(async () => {
      const res = await chargeSavedCardTopUp({
        contractorId,
        amountCents: cents,
        reason,
      });
      setResult({ ok: res.ok, message: res.message ?? (res.ok ? "Done" : "Failed") });
      if (res.ok) {
        setAmount("");
        setReason("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="rounded-sm bg-primary-soft p-3 text-sm text-text-muted">
        Charges the contractor&apos;s <strong className="text-text">saved card</strong> and credits
        their wallet. They must save a card from their Wallet page first.
      </p>

      {!hasSavedCard && (
        <p className="rounded-sm bg-warning-soft p-2 text-xs font-medium text-warning">
          No saved card on file. Ask the contractor to add or update a card under Wallet.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="amt">Amount (USD)</Label>
          <Input
            id="amt"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100.00"
            disabled={!hasSavedCard || pending}
          />
        </div>
        <div>
          <Label htmlFor="reason">Reason (logged)</Label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Requested phone top-up"
            disabled={!hasSavedCard || pending}
            required
          />
        </div>
      </div>

      {result && (
        <p
          className={
            result.ok
              ? "rounded-sm bg-success-soft p-3 text-sm font-medium text-success"
              : "rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger"
          }
        >
          {result.message}
        </p>
      )}

      <Button type="submit" variant="brand" loading={pending} disabled={!hasSavedCard || pending}>
        Charge card &amp; top up wallet
      </Button>
    </form>
  );
}

/** @deprecated Use WalletRechargeForm — kept as alias for any leftover imports. */
export const WalletAdjustForm = WalletRechargeForm;
