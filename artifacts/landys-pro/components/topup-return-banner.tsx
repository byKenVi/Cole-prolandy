"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { TopUpStatus } from "@/lib/topup-status";

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 12; // ~30s, then stop and tell the user what to do.

/**
 * Shown after Stripe redirects the contractor back from Checkout.
 *
 * `pending` means the payment went through but the wallet hasn't been credited
 * yet (webhook still in flight). Rather than telling the user to refresh, we
 * poll the server until the balance covers the lead, so the purchase can be
 * finished without leaving the page.
 */
export function TopUpReturnBanner({
  status,
  sufficient,
  context = "lead",
}: {
  status: TopUpStatus;
  /** True once the refreshed balance covers the pending purchase. */
  sufficient?: boolean;
  context?: "lead" | "wallet";
}) {
  const router = useRouter();
  const [polls, setPolls] = useState(0);
  const settled = status !== "pending" || Boolean(sufficient);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (settled || polls >= MAX_POLLS) return;
    timer.current = setTimeout(() => {
      setPolls((n) => n + 1);
      router.refresh();
    }, POLL_INTERVAL_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [settled, polls, router]);

  if (status === "error") {
    return (
      <Banner tone="error">
        <AlertTriangle className="h-4 w-4 flex-none" />
        We couldn&apos;t confirm that payment. No funds were added — please try again or contact
        support if you were charged.
      </Banner>
    );
  }

  if (status === "card_saved") {
    return (
      <Banner tone="success">
        <CheckCircle2 className="h-4 w-4 flex-none" />
        Card saved. Future top-ups can be made in one tap.
      </Banner>
    );
  }

  if (status === "card_pending") {
    return (
      <Banner tone="pending">
        <Spinner />
        Saving your card — this takes a few seconds.
      </Banner>
    );
  }

  if (status === "success" || sufficient) {
    return (
      <Banner tone="success">
        <CheckCircle2 className="h-4 w-4 flex-none" />
        {context === "lead"
          ? "Funds added — your balance is updated. Accept below to finish your purchase."
          : "Funds added — your balance is updated."}
      </Banner>
    );
  }

  // Pending and still waiting on the credit.
  if (polls >= MAX_POLLS) {
    return (
      <Banner tone="pending">
        <AlertTriangle className="h-4 w-4 flex-none" />
        Payment received, but the balance is taking longer than usual to update. It will appear
        shortly — no need to pay again.
      </Banner>
    );
  }

  return (
    <Banner tone="pending">
      <Spinner />
      Payment received — adding the funds to your wallet…
    </Banner>
  );
}

function Spinner() {
  return (
    <span className="h-4 w-4 flex-none animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

const TONES = {
  success: "bg-[#E7F0E9] text-[#2F6B4A]",
  pending: "bg-[#F4EAD3] text-[#8A6B2E]",
  error: "bg-[#F6E4E1] text-[#9A3B2E]",
} as const;

function Banner({
  tone,
  children,
}: {
  tone: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className={`mb-5 flex items-start gap-2.5 rounded-[12px] px-4 py-3 text-sm font-medium ${TONES[tone]}`}
    >
      {children}
    </div>
  );
}
