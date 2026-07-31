"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { rechargeSavedCard, startTopUp } from "@/app/actions/wallet";
import { acceptLeadAction } from "@/app/actions/leads";
import { TOPUP_PRESETS_CENTS } from "@/lib/domain/topup";

/**
 * Compact top-up dialog shown when a contractor's balance is too low to accept
 * a lead.
 *
 * Real Stripe off-session charges return `ok` as soon as the PaymentIntent is
 * submitted — the wallet is credited later by the webhook. Accepting in that
 * window always fails with "balance too low", which is exactly the bug the
 * contractor was seeing. We therefore:
 *   1. Show a clear "Funds added" success the moment the charge is accepted,
 *   2. Poll accept until the credit lands (or we time out gracefully),
 *   3. Never surface the raw insufficient-balance error after a successful charge.
 */
const ACCEPT_POLL_MS = 1500;
const ACCEPT_POLL_ATTEMPTS = 8; // ~12s — plenty for a webhook on a warm Stripe account

export function InlineTopUpDialog({
  open,
  onClose,
  matchId,
  priceCents,
  balanceCents,
  hasSavedCard,
}: {
  open: boolean;
  onClose: () => void;
  matchId: string;
  priceCents: number;
  balanceCents: number;
  hasSavedCard: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedCents, setSelectedCents] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<"topup" | "funded" | "accepting" | "done">("topup");
  const [fundedMessage, setFundedMessage] = useState("Funds added successfully.");

  const shortfallCents = Math.max(priceCents - balanceCents, 0);

  // Prefer presets that cover the shortfall; fall back to all presets.
  const presets = TOPUP_PRESETS_CENTS.filter((c) => c >= shortfallCents);
  const displayPresets = (presets.length > 0 ? presets : TOPUP_PRESETS_CENTS).slice(0, 4);

  async function acceptWhenFunded(): Promise<"accepted" | "pending" | "failed"> {
    for (let i = 0; i < ACCEPT_POLL_ATTEMPTS; i++) {
      const acceptRes = await acceptLeadAction(matchId);
      if (acceptRes.ok) return "accepted";
      // Credit not visible yet — wait and retry. Any other error is terminal.
      if (acceptRes.code !== "INSUFFICIENT_BALANCE") return "failed";
      await new Promise((r) => setTimeout(r, ACCEPT_POLL_MS));
    }
    return "pending";
  }

  function recharge(cents: number) {
    setError(null);
    setSelectedCents(cents);
    startTransition(async () => {
      if (hasSavedCard) {
        const res = await rechargeSavedCard(cents);
        if (res.ok) {
          // Always celebrate the top-up first — even if accept has to wait on
          // the webhook, the contractor must never see "balance too low" after
          // a charge that already went through.
          setFundedMessage(
            res.status === "submitted"
              ? "Payment submitted — adding funds to your wallet…"
              : "Funds added successfully.",
          );
          setStage("funded");
          router.refresh();

          setStage("accepting");
          const outcome = await acceptWhenFunded();
          if (outcome === "accepted") {
            setStage("done");
            router.refresh();
            setTimeout(() => {
              onClose();
              setStage("topup");
            }, 900);
          } else if (outcome === "pending") {
            // Charge succeeded; credit is just slow. Leave them on a success
            // state so they know not to pay again.
            setFundedMessage(
              "Funds added successfully. Your balance will update in a moment — tap Accept again to finish.",
            );
            setStage("funded");
            router.refresh();
          } else {
            setFundedMessage(
              "Funds added successfully. Open the lead and tap Accept to finish.",
            );
            setStage("funded");
            router.refresh();
          }
        } else if (res.fallbackToCheckout) {
          await startTopUp(
            cents,
            window.location.origin,
            window.location.pathname + window.location.search,
          );
        } else {
          setError(res.message);
        }
      } else {
        await startTopUp(
          cents,
          window.location.origin,
          window.location.pathname + window.location.search,
        );
      }
      setSelectedCents(null);
    });
  }

  function handleClose() {
    if (pending) return;
    onClose();
    setTimeout(() => {
      setStage("topup");
      setError(null);
      setFundedMessage("Funds added successfully.");
    }, 300);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent showClose={!pending}>
        <DialogHeader>
          <DialogTitle>Add funds to accept</DialogTitle>
        </DialogHeader>

        {/* Balance summary — hide once we've moved past the top-up stage so the
            success state gets the full focus. */}
        {(stage === "topup" || stage === "funded") && (
          <div className="mb-5 overflow-hidden rounded-[16px] border border-[#EBE3D4]">
            <div className="flex items-center justify-between border-b border-[#EBE3D4] px-4 py-3">
              <span className="text-[14px] text-[#6B6459]">Your balance</span>
              <span className="text-[15px] font-semibold tabular-nums text-[#3A352D]">
                {formatMoney(balanceCents)}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-[#EBE3D4] px-4 py-3">
              <span className="text-[14px] text-[#6B6459]">Lead price</span>
              <span className="text-[15px] font-semibold tabular-nums text-[#3A352D]">
                {formatMoney(priceCents)}
              </span>
            </div>
            <div className="flex items-center justify-between bg-[#FEF3C7] px-4 py-3">
              <span className="text-[14px] font-semibold text-[#92400E]">You need</span>
              <span className="text-[16px] font-bold tabular-nums text-[#92400E]">
                +{formatMoney(shortfallCents)}
              </span>
            </div>
          </div>
        )}

        {stage === "done" ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E7F0E9]">
              <CheckCircle2 className="h-7 w-7 text-[#2F4A3C]" />
            </span>
            <p className="text-[16px] font-semibold text-[#3A352D]">Lead accepted!</p>
          </div>
        ) : stage === "accepting" ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E6DFD1] border-t-[#C0803C]" />
            <p className="text-[14px] font-medium text-[#6B6459]">
              Funds added — accepting lead…
            </p>
          </div>
        ) : stage === "funded" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E7F0E9]">
              <CheckCircle2 className="h-7 w-7 text-[#2F4A3C]" />
            </span>
            <p className="text-[16px] font-semibold text-[#3A352D]">Funds added successfully</p>
            <p className="max-w-[280px] text-[13px] text-[#6B6459]">{fundedMessage}</p>
            <Button variant="accent" className="mt-2 w-full" onClick={handleClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            {error && (
              <p className="mb-4 rounded-[12px] bg-[#F6E4E1] px-4 py-3 text-[13px] font-medium text-[#9A3B2E]">
                {error}
              </p>
            )}

            {hasSavedCard ? (
              <>
                <p className="mb-3 text-[13px] text-[#8A7E68]">
                  Top up with your saved card — funds land instantly and the lead accepts
                  automatically.
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {displayPresets.map((cents) => (
                    <Button
                      key={cents}
                      variant="outline"
                      className="h-14 text-[17px] font-semibold"
                      disabled={pending}
                      loading={pending && selectedCents === cents}
                      onClick={() => recharge(cents)}
                    >
                      {formatMoney(cents)}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="mb-4 text-[13px] text-[#8A7E68]">
                  Choose an amount to add via Stripe. Your lead is held while you pay.
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {displayPresets.map((cents) => (
                    <Button
                      key={cents}
                      variant="outline"
                      className="h-14 text-[17px] font-semibold"
                      disabled={pending}
                      loading={pending && selectedCents === cents}
                      onClick={() => recharge(cents)}
                    >
                      {formatMoney(cents)}
                    </Button>
                  ))}
                </div>
              </>
            )}

            <Button
              variant="ghost"
              className="mt-3 w-full"
              onClick={handleClose}
              disabled={pending}
            >
              Cancel
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
