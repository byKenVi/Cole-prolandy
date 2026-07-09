"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  chargeSavedCardTopUp,
  refundTopUpToCardAction,
  returnRealBalanceToCardAction,
} from "@/app/actions/admin";
import { dollarsToCents, formatMoney } from "@/lib/money";

type Msg = { ok: boolean; text: string } | null;

/**
 * Admin card money-movement actions, kept clearly SEPARATE from the internal
 * Refund / Promo / Deduct ledger actions:
 *   • "Charge saved card & top up" — pulls real money IN from the CONTRACTOR's
 *     own saved card and credits their wallet (via webhook / mock credit path).
 *   • "Refund to card" — sends real money BACK to the card and DEBITS the wallet.
 */
export function CardActions({
  contractorId,
  hasSavedCard,
  realBalanceCents,
}: {
  contractorId: string;
  hasSavedCard: boolean;
  realBalanceCents: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);

  const [amount, setAmount] = useState("");
  const [chargeReason, setChargeReason] = useState("");

  function onCharge(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const cents = dollarsToCents(amount);
    if (!cents) {
      setMsg({ ok: false, text: "Enter a valid amount." });
      return;
    }
    startTransition(async () => {
      const res = await chargeSavedCardTopUp({ contractorId, amountCents: cents, reason: chargeReason });
      setMsg({ ok: res.ok, text: res.message ?? (res.ok ? "Done" : "Failed") });
      if (res.ok) {
        setAmount("");
        setChargeReason("");
        router.refresh();
      }
    });
  }

  function onReturnBalance() {
    const reason = window.prompt(
      `Return the remaining real balance (${formatMoney(realBalanceCents)}) to the contractor's card? Enter a reason:`,
    );
    if (!reason) return;
    setMsg(null);
    startTransition(async () => {
      const res = await returnRealBalanceToCardAction({ contractorId, reason });
      setMsg({ ok: res.ok, text: res.message ?? (res.ok ? "Done" : "Failed") });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-sm bg-primary-soft p-3 text-sm text-text-muted">
        These move <strong className="text-text">real money</strong> on the contractor&apos;s own
        card. Charging tops up their wallet (money in); refunding sends money back to their card and
        reduces the wallet. Card refunds only apply to real past top-ups, up to their amount and the
        contractor&apos;s real balance, within Stripe&apos;s ~180-day window — promo credit can never
        be refunded to a card.
      </div>

      <form onSubmit={onCharge} className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-text">Charge saved card &amp; top up</p>
        {!hasSavedCard && (
          <p className="rounded-sm bg-warning-soft p-2 text-xs font-medium text-warning">
            No saved card on file. The contractor must complete a secure checkout top-up once before
            their card can be charged off-session.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="charge-amt">Amount (USD)</Label>
            <Input
              id="charge-amt"
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
            <Label htmlFor="charge-reason">Reason (logged)</Label>
            <Input
              id="charge-reason"
              value={chargeReason}
              onChange={(e) => setChargeReason(e.target.value)}
              placeholder="e.g. Requested phone top-up"
              disabled={!hasSavedCard || pending}
            />
          </div>
        </div>
        <Button type="submit" variant="brand" loading={pending} disabled={!hasSavedCard || pending}>
          Charge saved card &amp; top up
        </Button>
      </form>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <p className="text-sm font-semibold text-text">Refund to card</p>
        <p className="text-xs text-text-muted">
          Real (card-backed) balance available to refund: {formatMoney(realBalanceCents)}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onReturnBalance}
          loading={pending}
          disabled={pending || realBalanceCents <= 0}
        >
          Return remaining real balance to card
        </Button>
      </div>

      {msg && (
        <p
          className={
            msg.ok
              ? "rounded-sm bg-success-soft p-3 text-sm font-medium text-success"
              : "rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger"
          }
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}

/** Per-top-up "refund this to card" button shown next to a TOPUP transaction. */
export function CardRefundButton({
  contractorId,
  walletTransactionId,
}: {
  contractorId: string;
  walletTransactionId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onClick() {
    const reason = window.prompt("Refund this top-up to the contractor's card. Reason?");
    if (!reason) return;
    startTransition(async () => {
      const res = await refundTopUpToCardAction({ contractorId, walletTransactionId, reason });
      setMsg(res.message ?? (res.ok ? "Refunded" : "Failed"));
      if (res.ok) router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onClick} loading={pending} disabled={pending}>
        Refund to card
      </Button>
      {msg && <span className="text-xs text-text-muted">{msg}</span>}
    </span>
  );
}
