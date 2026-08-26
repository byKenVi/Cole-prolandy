"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { acceptByTokenAction, declineByTokenAction } from "@/app/actions/leads";

export function AcceptTokenActions({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<null | "accept" | "decline">(null);
  const [error, setError] = useState<string | null>(null);

  function onAccept() {
    setError(null);
    setAction("accept");
    startTransition(async () => {
      const res = await acceptByTokenAction(token);
      if (res.ok) router.refresh();
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
        Accept
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
