"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InlineTopUpDialog } from "@/components/inline-topup-dialog";
import { acceptLeadAction, declineLeadAction } from "@/app/actions/leads";
import { formatMoney } from "@/lib/money";

/**
 * Accept / Pass controls for a lead match. When balance is insufficient,
 * opens an inline top-up dialog instead of redirecting to the Wallet page
 * — the contractor can add funds and accept in a single flow.
 */
export function LeadActions({
  matchId,
  priceCents,
  balanceCents = 0,
  hasSavedCard = false,
}: {
  matchId: string;
  priceCents?: number;
  balanceCents?: number;
  hasSavedCard?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<null | "accept" | "decline">(null);
  const [error, setError] = useState<string | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);

  function onAccept() {
    setError(null);
    setAction("accept");
    startTransition(async () => {
      const res = await acceptLeadAction(matchId);
      if (res.ok) {
        router.refresh();
      } else if (res.code === "INSUFFICIENT_BALANCE") {
        setTopUpOpen(true);
      } else {
        setError(res.message);
      }
      setAction(null);
    });
  }

  function onDecline() {
    setError(null);
    setAction("decline");
    startTransition(async () => {
      const res = await declineLeadAction(matchId);
      if (res.ok) {
        router.push("/home");
      } else {
        setError(res.message);
        setAction(null);
      }
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {error && (
          <p className="rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p>
        )}
        <Button
          variant="accent"
          size="cta"
          loading={pending && action === "accept"}
          disabled={pending}
          onClick={onAccept}
        >
          Accept &amp; pay{priceCents != null ? ` ${formatMoney(priceCents)}` : ""}
        </Button>
        <Button
          variant="outline"
          size="cta"
          loading={pending && action === "decline"}
          disabled={pending}
          onClick={onDecline}
        >
          Pass
        </Button>
      </div>

      <InlineTopUpDialog
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        matchId={matchId}
        priceCents={priceCents ?? 0}
        balanceCents={balanceCents}
        hasSavedCard={hasSavedCard}
      />
    </>
  );
}
