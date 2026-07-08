"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { adjustWallet } from "@/app/actions/admin";
import { dollarsToCents } from "@/lib/money";

export function WalletAdjustForm({ contractorId }: { contractorId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [amount, setAmount] = useState("");
  const [action, setAction] = useState<Action>("refund");
  const [reason, setReason] = useState("");

  const cfg = ACTIONS[action];

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    const cents = dollarsToCents(amount);
    if (!cents) {
      setResult({ ok: false, message: "Enter a valid amount." });
      return;
    }
    // The action fully determines the transaction type AND sign. The admin can
    // only issue a REFUND credit, a labeled PROMO_CREDIT, or an ADMIN_ADJUST
    // deduct — never generic "funds" (the server enforces this too).
    const signed = cfg.sign * Math.abs(cents);
    startTransition(async () => {
      const res = await adjustWallet({ contractorId, amountCents: signed, type: cfg.type, reason });
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
        Real money enters a wallet only through the contractor&apos;s own card (Stripe). The admin
        can&apos;t add spendable &quot;funds.&quot; You can issue a{" "}
        <strong className="text-text">refund</strong> (money they paid),{" "}
        <strong className="text-text">promo credit</strong> (labeled promotional balance, not real
        money), or <strong className="text-text">deduct</strong> to correct a mistake. Every action
        is logged.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="action">Action</Label>
          <Select id="action" value={action} onChange={(e) => setAction(e.target.value as Action)}>
            <option value="refund">Refund — return money they paid (credit)</option>
            <option value="promo">Promo credit — promotional balance (credit)</option>
            <option value="deduct">Deduct — correct a mistake (debit)</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="amt">Amount (USD)</Label>
          <Input
            id="amt"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="50.00"
          />
        </div>
      </div>
      <p className="text-xs text-text-muted">{cfg.hint}</p>
      <div>
        <Label htmlFor="reason">Reason (logged to audit)</Label>
        <Input
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={cfg.placeholder}
          required
        />
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

      <Button type="submit" variant={cfg.variant} loading={pending} disabled={pending}>
        {cfg.cta}
      </Button>
    </form>
  );
}

type Action = "refund" | "promo" | "deduct";

const ACTIONS: Record<
  Action,
  {
    type: "REFUND" | "PROMO_CREDIT" | "ADMIN_ADJUST";
    sign: 1 | -1;
    cta: string;
    variant: "brand" | "accent" | "destructive";
    hint: string;
    placeholder: string;
  }
> = {
  refund: {
    type: "REFUND",
    sign: 1,
    cta: "Issue refund",
    variant: "brand",
    hint: "Returns money the contractor actually paid (real funds).",
    placeholder: "e.g. Bad lead — refunded",
  },
  promo: {
    type: "PROMO_CREDIT",
    sign: 1,
    cta: "Grant promo credit",
    variant: "accent",
    hint: "Promotional balance — spendable on leads, but NOT real money. Shown separately.",
    placeholder: "e.g. Launch promo — $25 credit",
  },
  deduct: {
    type: "ADMIN_ADJUST",
    sign: -1,
    cta: "Deduct from balance",
    variant: "destructive",
    hint: "Corrects a balance downward. Never produces a negative balance.",
    placeholder: "e.g. Correcting a duplicate credit",
  },
};
