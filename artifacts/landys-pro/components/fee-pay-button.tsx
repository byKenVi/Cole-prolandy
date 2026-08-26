"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { startSuccessFeePayment } from "@/app/actions/fees";
import { useToast } from "@/components/ui/toast";

export function FeePayButton({ leadMatchId, amountLabel }: { leadMatchId: string; amountLabel: string }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function handlePay() {
    startTransition(async () => {
      const res = await startSuccessFeePayment(leadMatchId);
      if (!res.ok) {
        toast.error(res.message ?? "Payment could not be started.");
        return;
      }
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handlePay}
      disabled={pending}
      aria-label={`Pay Landy's ${amountLabel}`}
      className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#4A3E2D] px-[15px] text-[13px] font-semibold text-white transition-colors hover:bg-[#3A352D] disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-[14px] w-[14px] animate-spin" aria-hidden /> : null}
      {pending ? "Starting…" : "Pay Landy's"}
    </button>
  );
}
