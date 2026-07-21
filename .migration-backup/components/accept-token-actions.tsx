"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptByTokenAction, declineByTokenAction } from "@/app/actions/leads";
import { formatMoney } from "@/lib/money";

/**
 * The single most important pro screen (DESIGN.md §6): tokenized accept, no
 * login. Two full-width buttons; handles insufficient balance inline.
 */
export function AcceptTokenActions({ token, priceCents }: { token: string; priceCents?: number }) {
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
      const res = await acceptByTokenAction(token);
      if (res.ok) router.refresh();
      else if (res.code === "INSUFFICIENT_BALANCE") setShortfall(res.shortfallCents ?? null);
      else setError(res.message);
      setAction(null);
    });
  }

  function onDecline() {
    setError(null);
    setAction("decline");
    startTransition(async () => {
      const res = await declineByTokenAction(token);
      if (res.ok) router.refresh();
      else setError(res.message);
      setAction(null);
    });
  }

  if (shortfall !== null) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 rounded-md bg-danger-soft p-4 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Not enough funds</p>
            <p className="mt-1">
              Add {formatMoney(shortfall)} to your wallet in the app, then tap Accept again.
            </p>
          </div>
        </div>
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
