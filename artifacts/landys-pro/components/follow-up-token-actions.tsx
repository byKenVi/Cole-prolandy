"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  followUpConfirmPaidAction,
  followUpDeferPaidAction,
  followUpReportLostAction,
  followUpReportWonAction,
} from "@/app/actions/follow-up";

export function FollowUpTokenActions({
  token,
  action,
}: {
  token: string;
  action: "REPORT_OUTCOME" | "CONFIRM_PAID";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [showValueInput, setShowValueInput] = useState(false);
  const [finalValue, setFinalValue] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);

  function onLost() {
    setError(null);
    setActiveAction("lost");
    startTransition(async () => {
      const res = await followUpReportLostAction(token);
      if (res.ok) {
        setDone("Thanks — we recorded that you did not win this job.");
        router.refresh();
      } else setError(res.message);
      setActiveAction(null);
    });
  }

  function onWonSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const dollars = Number(finalValue);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter a valid final job value in dollars.");
      return;
    }
    setActiveAction("won");
    startTransition(async () => {
      const res = await followUpReportWonAction(token, dollars);
      if (res.ok) {
        setDone("Thanks — we recorded your win. We'll follow up about payment soon.");
        router.refresh();
      } else setError(res.message);
      setActiveAction(null);
    });
  }

  function onPaid() {
    setError(null);
    setActiveAction("paid");
    startTransition(async () => {
      const res = await followUpConfirmPaidAction(token);
      if (res.ok) {
        setDone("Thanks — your success fee is now due. Check your Landys Pro account to pay.");
        router.refresh();
      } else setError(res.message);
      setActiveAction(null);
    });
  }

  function onNotYet() {
    setError(null);
    setActiveAction("defer");
    startTransition(async () => {
      const res = await followUpDeferPaidAction(token);
      if (res.ok) {
        setDone("No problem — we'll check back with you later.");
        router.refresh();
      } else setError(res.message);
      setActiveAction(null);
    });
  }

  if (done) {
    return (
      <p className="rounded-sm bg-[#E8F3EC] p-4 text-center text-sm font-medium text-[#2F6B4A]">
        {done}
      </p>
    );
  }

  if (action === "REPORT_OUTCOME") {
    if (showValueInput) {
      return (
        <form onSubmit={onWonSubmit} className="flex flex-col gap-3">
          {error && (
            <p className="rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p>
          )}
          <label className="text-[13px] font-medium text-[#6B6459]" htmlFor="finalValue">
            Final job value (USD)
          </label>
          <input
            id="finalValue"
            type="number"
            min="1"
            step="0.01"
            value={finalValue}
            onChange={(e) => setFinalValue(e.target.value)}
            placeholder="e.g. 5000"
            className="h-12 w-full rounded-[11px] border border-[#EBE3D4] bg-white px-4 text-[16px] text-[#3A352D]"
            autoFocus
          />
          <Button
            variant="accent"
            size="cta"
            type="submit"
            loading={pending && activeAction === "won"}
            disabled={pending}
          >
            Submit
          </Button>
          <Button
            variant="outline"
            size="cta"
            type="button"
            disabled={pending}
            onClick={() => {
              setShowValueInput(false);
              setError(null);
            }}
          >
            Back
          </Button>
        </form>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {error && (
          <p className="rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p>
        )}
        <p className="text-center text-[15px] text-[#6B6459]">Did you win this job?</p>
        <Button
          variant="accent"
          size="cta"
          disabled={pending}
          onClick={() => setShowValueInput(true)}
        >
          Yes
        </Button>
        <Button
          variant="outline"
          size="cta"
          loading={pending && activeAction === "lost"}
          disabled={pending}
          onClick={onLost}
        >
          No
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p>
      )}
      <p className="text-center text-[15px] text-[#6B6459]">Has the landowner paid you?</p>
      <Button
        variant="accent"
        size="cta"
        loading={pending && activeAction === "paid"}
        disabled={pending}
        onClick={onPaid}
      >
        Yes
      </Button>
      <Button
        variant="outline"
        size="cta"
        loading={pending && activeAction === "defer"}
        disabled={pending}
        onClick={onNotYet}
      >
        Not yet
      </Button>
    </div>
  );
}
