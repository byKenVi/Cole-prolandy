"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptLeadAction, declineLeadAction } from "@/app/actions/leads";
import { formatMoney } from "@/lib/money";

/**
 * Accept / Pass controls for a lead match. Buttons disable + spin during the
 * async call to prevent double-charge taps (DESIGN.md §4).
 */
export function LeadActions({ matchId, priceCents }: { matchId: string; priceCents?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<null | "accept" | "decline">(null);
  const [error, setError] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<number | null>(null);

  function onAccept() {
    setError(null);
    setShortfall(null);
    setAction("accept");
    startTransition(async () => {
      const res = await acceptLeadAction(matchId);
      if (res.ok) {
        router.refresh();
      } else if (res.code === "INSUFFICIENT_BALANCE") {
        setShortfall(res.shortfallCents ?? null);
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

  if (shortfall !== null) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 rounded-md bg-danger-soft p-4 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Not enough funds to accept</p>
            <p className="mt-1">
              You need {formatMoney(shortfall)} more in your wallet to accept this lead.
            </p>
          </div>
        </div>
        <Button asChild variant="accent" size="cta">
          <Link href="/wallet">Add funds</Link>
        </Button>
        <Button variant="ghost" onClick={() => setShortfall(null)}>
          Back
        </Button>
      </div>
    );
  }

  return (
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
  );
}
