"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startTopUp, rechargeSavedCard } from "@/app/actions/wallet";
import { formatMoney, dollarsToCents } from "@/lib/money";
import { TOPUP_PRESETS_CENTS, validateTopUpAmountCents } from "@/lib/domain/topup";

const PRESETS = TOPUP_PRESETS_CENTS;

/**
 * Add-funds widget. When the contractor has a SAVED card we offer a 1-click
 * recharge (off-session charge of the saved card); if there's no saved card, or
 * the saved card needs the cardholder present, we fall back to the secure
 * Stripe Checkout (the primary/first-time path).
 */
export function TopUp({ hasSavedCard = false }: { hasSavedCard?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function go(cents: number) {
    setError(null);
    setNotice(null);
    setSelected(cents);
    const origin = window.location.origin;
    if (hasSavedCard) {
      startTransition(async () => {
        const res = await rechargeSavedCard(cents);
        if (res.ok) {
          setNotice(res.message);
          router.refresh();
          return;
        }
        // No saved card / needs cardholder present / declined → secure Checkout.
        if (res.fallbackToCheckout) {
          await startTopUp(cents, origin); // redirects to Stripe Checkout
          return;
        }
        setError(res.message);
      });
    } else {
      startTransition(() => startTopUp(cents, origin));
    }
  }

  function goCustom() {
    const cents = dollarsToCents(custom);
    const check = validateTopUpAmountCents(cents);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    go(check.amountCents);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="custom-amount">Enter an amount</Label>
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              $
            </span>
            <Input
              id="custom-amount"
              type="number"
              inputMode="decimal"
              min="10"
              step="1"
              placeholder="130"
              className="pl-7"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                setError(null);
                setNotice(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  goCustom();
                }
              }}
            />
          </div>
          <Button
            variant="accent"
            className="h-12"
            disabled={pending || custom.trim() === ""}
            loading={pending && selected !== null && !PRESETS.includes(selected)}
            onClick={goCustom}
          >
            {hasSavedCard ? "Recharge" : "Add"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Or pick a quick amount</Label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PRESETS.map((cents) => (
            <Button
              key={cents}
              variant="outline"
              className="h-14 text-lg"
              disabled={pending}
              loading={pending && selected === cents}
              onClick={() => go(cents)}
            >
              {formatMoney(cents)}
            </Button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      {notice && <p className="text-sm font-medium text-success">{notice}</p>}

      <p className="text-center text-xs text-text-muted">
        {hasSavedCard
          ? "1-click recharge uses your saved card. If it needs verifying, you'll be sent to the secure Stripe checkout."
          : "Secure card payment via Stripe. Your balance updates as soon as the payment confirms."}
      </p>
    </div>
  );
}
