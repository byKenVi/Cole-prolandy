"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { acceptLeadAction } from "@/app/actions/leads";
import { InlineTopUpDialog } from "@/components/inline-topup-dialog";

/**
 * One-click Accept button for lead feed cards.
 * - If balance is sufficient: accepts immediately, shows success state.
 * - If balance is insufficient: opens the inline top-up dialog.
 * - Handles loading, success, and error states.
 */
export function OneClickAccept({
  matchId,
  priceCents,
  walletCents,
  hasSavedCard,
}: {
  matchId: string;
  priceCents: number;
  walletCents: number;
  hasSavedCard: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleAccept(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (done || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await acceptLeadAction(matchId);
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else if (res.code === "INSUFFICIENT_BALANCE") {
        setDialogOpen(true);
      } else {
        setError(res.message ?? "Something went wrong.");
      }
    });
  }

  if (done) {
    return (
      <span className="inline-flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#2F4A3C] px-[15px] text-[13px] font-semibold text-white">
        <CheckCircle2 className="h-[14px] w-[14px]" strokeWidth={2.2} aria-hidden />
        Accepted
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleAccept}
        disabled={pending}
        title={error ?? undefined}
        className="inline-flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#C0803C] px-[15px] text-[13px] font-semibold text-white transition-colors hover:bg-[#A56A2B] disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-[14px] w-[14px] animate-spin" aria-hidden />
        ) : null}
        {pending ? "Accepting…" : error ? "Retry" : "Accept"}
      </button>

      <InlineTopUpDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        matchId={matchId}
        priceCents={priceCents}
        balanceCents={walletCents}
        hasSavedCard={hasSavedCard}
      />
    </>
  );
}
