"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { paySuccessFeeWithSavedCard, startSuccessFeePayment } from "@/app/actions/fees";
import { formatCardLabel } from "@/lib/card-display";
import { useToast } from "@/components/ui/toast";

export function FeePayButton({
  leadMatchId,
  amountLabel,
  savedCard,
}: {
  leadMatchId: string;
  amountLabel: string;
  savedCard?: { brand?: string | null; last4?: string | null } | null;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const cardLabel = formatCardLabel(savedCard?.brand, savedCard?.last4);
  const last4 = savedCard?.last4;

  function goCheckout() {
    startTransition(async () => {
      const res = await startSuccessFeePayment(leadMatchId);
      if (!res.ok) {
        toast.error(res.message ?? "Payment could not be started.");
        return;
      }
      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
    });
  }

  function paySaved() {
    startTransition(async () => {
      const res = await paySuccessFeeWithSavedCard(leadMatchId);
      if (res.ok && res.paid) {
        setConfirmOpen(false);
        window.location.href = `/fees?paid=${leadMatchId}`;
        return;
      }
      if (res.ok && res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      if (!res.ok && res.fallbackToCheckout) {
        setConfirmOpen(false);
        goCheckout();
        return;
      }
      if (!res.ok) toast.error(res.message ?? "Payment could not be completed.");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (last4 ? setConfirmOpen(true) : goCheckout())}
        disabled={pending}
        aria-label={`Pay Landy's ${amountLabel}`}
        className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#4A3E2D] px-[15px] text-[13px] font-semibold text-white transition-colors hover:bg-[#3A352D] disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-[14px] w-[14px] animate-spin" aria-hidden /> : null}
        {pending ? "Starting…" : "Pay Landy's"}
      </button>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-[18px] border border-[#EBE3D4] bg-white p-6 shadow-[0_20px_50px_rgba(58,53,45,0.2)]">
            <p className="font-fraunces text-[22px] font-semibold text-[#4A3E2D]">Pay Landy&apos;s</p>
            <p className="mt-3 text-[16px] leading-relaxed text-[#5A4E3E]">
              Pay {amountLabel} to Landy&apos;s using your card ending in {last4}?
            </p>
            {cardLabel && <p className="mt-2 text-[13px] text-[#8A7E68]">{cardLabel}</p>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmOpen(false)}
                className="h-11 rounded-[10px] border border-[#E6DFD1] px-4 text-[14px] font-semibold text-[#5A4E3E]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={paySaved}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#4A3E2D] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Confirm payment
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
