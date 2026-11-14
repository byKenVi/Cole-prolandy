"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  confirmPaidAction,
  deferPaidAction,
  reportLostAction,
  reportWonAction,
} from "@/app/actions/jobs";
import {
  followUpConfirmPaidAction,
  followUpDeferPaidAction,
  followUpReportLostAction,
  followUpReportWonAction,
} from "@/app/actions/follow-up";
import { paySuccessFeeWithSavedCard, startFeePaymentByToken, startSuccessFeePayment } from "@/app/actions/fees";
import type { ActionTarget } from "./accept-actions";

type Tier = { sortOrder: number; maxValueCents: number | null; rateBasisPoints: number };

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function feeFor(tiers: Tier[], cents: number) {
  const sorted = [...tiers].sort((a, b) => a.sortOrder - b.sortOrder);
  if (!sorted.length || cents <= 0) return null;
  let bps = sorted[sorted.length - 1].rateBasisPoints;
  for (const tier of sorted) {
    if (tier.maxValueCents === null || cents <= tier.maxValueCents) {
      bps = tier.rateBasisPoints;
      break;
    }
  }
  return { cents: Math.max(1, Math.round((cents * bps) / 10_000)), pct: bps / 100 };
}

function ErrorNote({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="pro-notice pro-notice--danger" role="alert" style={{ marginBottom: 14 }}>
      {text}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// "Did you get the job?"
// ─────────────────────────────────────────────────────────────

export function OutcomeActions({
  target,
  homeownerName,
  tiers,
}: {
  target: ActionTarget;
  homeownerName: string;
  tiers: Tier[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<"ask" | "won" | "lost">("ask");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const dollars = Number(amount.replace(/[^0-9.]/g, ""));
  const cents = Number.isFinite(dollars) ? Math.round(dollars * 100) : 0;
  const fee = useMemo(() => feeFor(tiers, cents), [tiers, cents]);

  function submitWon() {
    setError(null);
    if (!cents || cents <= 0) {
      setError("Enter the final price you agreed on, for example 4500.");
      return;
    }
    startTransition(async () => {
      const res =
        target.kind === "token"
          ? await followUpReportWonAction(target.token, cents / 100)
          : await reportWonAction(target.matchId, cents);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setDone("Congratulations! We will check with you later to see if the homeowner has paid you.");
      router.refresh();
    });
  }

  function submitLost() {
    setError(null);
    startTransition(async () => {
      const res =
        target.kind === "token"
          ? await followUpReportLostAction(target.token)
          : await reportLostAction(target.matchId);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setDone("Thanks for letting us know. There is nothing to pay for this job.");
      router.refresh();
    });
  }

  if (done) return <div className="pro-notice pro-notice--ok">{done}</div>;

  return (
    <div>
      <ErrorNote text={error} />
      {step === "ask" && (
        <>
          <p style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 600 }}>Did {homeownerName} hire you?</p>
          <div className="pro-btn-row">
            <button type="button" className="pro-btn pro-btn--primary pro-btn--big" onClick={() => setStep("won")}>
              Yes, I got the job
            </button>
            <button type="button" className="pro-btn pro-btn--secondary" onClick={() => setStep("lost")}>
              No, I did not get it
            </button>
          </div>
        </>
      )}

      {step === "won" && (
        <>
          <label className="pro-label" htmlFor="final-price">
            What is the final price you agreed on with {homeownerName}?
          </label>
          <div className="pro-money-input">
            <span aria-hidden>$</span>
            <input
              id="final-price"
              inputMode="decimal"
              autoComplete="off"
              placeholder="4,500"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
              autoFocus
            />
          </div>
          <p className="pro-small" style={{ margin: "10px 0 16px" }}>
            {fee
              ? `Landy's fee will be ${money(fee.cents)} (${fee.pct}%). You pay it only after ${homeownerName} has paid you.`
              : "Landy's fee is a small percentage of this price, paid only after the homeowner pays you."}
          </p>
          <div className="pro-btn-row pro-btn-row--2">
            <button type="button" className="pro-btn pro-btn--primary" onClick={submitWon} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" size={20} aria-hidden /> : null}
              {pending ? "Saving..." : "Save the price"}
            </button>
            <button type="button" className="pro-btn pro-btn--secondary" onClick={() => setStep("ask")} disabled={pending}>
              Back
            </button>
          </div>
        </>
      )}

      {step === "lost" && (
        <>
          <p style={{ margin: "0 0 14px", fontSize: 19, fontWeight: 600 }}>
            Confirm that {homeownerName} did not hire you?
          </p>
          <div className="pro-btn-row pro-btn-row--2">
            <button type="button" className="pro-btn pro-btn--forest" onClick={submitLost} disabled={pending}>
              {pending ? "Saving..." : "Yes, I was not hired"}
            </button>
            <button type="button" className="pro-btn pro-btn--secondary" onClick={() => setStep("ask")} disabled={pending}>
              Back
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// "Has the homeowner paid you?"
// ─────────────────────────────────────────────────────────────

export function PaidActions({ target, homeownerName }: { target: ActionTarget; homeownerName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function answer(paid: boolean) {
    setError(null);
    startTransition(async () => {
      const res =
        target.kind === "token"
          ? paid
            ? await followUpConfirmPaidAction(target.token)
            : await followUpDeferPaidAction(target.token)
          : paid
            ? await confirmPaidAction(target.matchId)
            : await deferPaidAction(target.matchId);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setDone(
        paid
          ? "Thank you. We just sent you a secure link to pay Landy's fee by card."
          : "No problem. We will check back with you in a few days.",
      );
      router.refresh();
    });
  }

  if (done) return <div className="pro-notice pro-notice--ok">{done}</div>;

  return (
    <div>
      <ErrorNote text={error} />
      <p style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 600 }}>Has {homeownerName} paid you?</p>
      <div className="pro-btn-row pro-btn-row--2">
        <button type="button" className="pro-btn pro-btn--primary" onClick={() => answer(true)} disabled={pending}>
          Yes, I have been paid
        </button>
        <button type="button" className="pro-btn pro-btn--secondary" onClick={() => answer(false)} disabled={pending}>
          Not yet
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Pay Landy's success fee
// ─────────────────────────────────────────────────────────────

export function PayFeeButton({
  target,
  amountLabel,
  savedCard,
}: {
  target: ActionTarget;
  amountLabel: string;
  savedCard?: { brand: string | null; last4: string | null } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmSaved, setConfirmSaved] = useState(false);

  function checkout() {
    setError(null);
    startTransition(async () => {
      const res =
        target.kind === "token"
          ? await startFeePaymentByToken(target.token)
          : await startSuccessFeePayment(target.matchId);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      router.refresh();
    });
  }

  function paySaved() {
    if (target.kind !== "portal") return;
    setError(null);
    startTransition(async () => {
      const res = await paySuccessFeeWithSavedCard(target.matchId);
      if (res.ok) {
        setConfirmSaved(false);
        router.refresh();
        return;
      }
      if (res.fallbackToCheckout) {
        setConfirmSaved(false);
        checkout();
        return;
      }
      setError(res.message);
    });
  }

  const canUseSaved = target.kind === "portal" && savedCard?.last4;

  return (
    <div>
      <ErrorNote text={error} />
      {confirmSaved && canUseSaved ? (
        <div className="pro-card" style={{ boxShadow: "none" }}>
          <p style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 600 }}>
            Pay {amountLabel} with your card ending in {savedCard?.last4}?
          </p>
          <div className="pro-btn-row pro-btn-row--2">
            <button type="button" className="pro-btn pro-btn--primary" onClick={paySaved} disabled={pending}>
              {pending ? "Paying..." : `Yes, pay ${amountLabel}`}
            </button>
            <button type="button" className="pro-btn pro-btn--secondary" onClick={() => setConfirmSaved(false)} disabled={pending}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="pro-btn-row">
          <button
            type="button"
            className="pro-btn pro-btn--primary pro-btn--big"
            onClick={() => (canUseSaved ? setConfirmSaved(true) : checkout())}
            disabled={pending}
          >
            {pending ? <Loader2 className="animate-spin" size={22} aria-hidden /> : null}
            {pending ? "Opening secure payment..." : `Pay ${amountLabel} by card`}
          </button>
          {canUseSaved && (
            <button type="button" className="pro-btn pro-btn--quiet" onClick={checkout} disabled={pending}>
              Use a different card
            </button>
          )}
        </div>
      )}
      <p className="pro-small" style={{ margin: "12px 0 0" }}>
        Secure payment by Stripe. Landy&apos;s never sees your card number.
      </p>
    </div>
  );
}
