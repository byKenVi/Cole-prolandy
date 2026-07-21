"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startCardUpdate } from "@/app/actions/wallet";

/** Save or replace the contractor's default card via Stripe Checkout (setup). */
export function SavedCardPanel({
  hasSavedCard,
  cardLabel,
}: {
  hasSavedCard: boolean;
  cardLabel?: string | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-[18px] border border-[#EBE3D4] bg-white p-6 shadow-[0_2px_8px_rgba(58,53,45,0.05)]">
      <h2 className="mb-2 text-[17px] font-semibold text-[#3A352D]">Payment card</h2>
      {hasSavedCard && cardLabel ? (
        <p className="mb-1 text-[15px] font-semibold tabular-nums text-[#3A352D]">{cardLabel}</p>
      ) : null}
      <p className="mb-4 text-sm text-[#8A7E68]">
        {hasSavedCard
          ? "Used for 1-click top-ups and admin recharges. Update it if it expires or you want a different card."
          : "Save a card so you can top up in one click and so Landys can recharge your wallet when needed."}
      </p>
      <Button
        variant="outline"
        loading={pending}
        disabled={pending}
        onClick={() => startTransition(() => startCardUpdate())}
      >
        {hasSavedCard ? "Update card" : "Save a card"}
      </Button>
    </div>
  );
}
