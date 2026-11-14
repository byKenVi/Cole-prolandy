"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  acceptByTokenAction,
  acceptLeadAction,
  declineByTokenAction,
  declineLeadAction,
} from "@/app/actions/leads";

export type ActionTarget = { kind: "token"; token: string } | { kind: "portal"; matchId: string };

/**
 * Accept / pass. Accepting is one tap (speed matters: the first pros to
 * accept get the job); passing asks once more so nobody loses a job by mistake.
 */
export function AcceptActions({
  target,
  feeRateLabel,
  maxAccepts,
  direct,
}: {
  target: ActionTarget;
  feeRateLabel: string | null;
  maxAccepts: number;
  direct: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"accept" | "pass" | null>(null);
  const [confirmPass, setConfirmPass] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(kind: "accept" | "pass") {
    setError(null);
    setBusy(kind);
    startTransition(async () => {
      const res =
        target.kind === "token"
          ? kind === "accept"
            ? await acceptByTokenAction(target.token)
            : await declineByTokenAction(target.token)
          : kind === "accept"
            ? await acceptLeadAction(target.matchId)
            : await declineLeadAction(target.matchId);
      setBusy(null);
      if (!res.ok) {
        setError(res.message);
        router.refresh();
        return;
      }
      setConfirmPass(false);
      router.refresh();
    });
  }

  const fee = feeRateLabel
    ? `${feeRateLabel} of the final job price`
    : "a small percentage of the final job price";

  return (
    <div>
      <p style={{ margin: "0 0 14px", fontSize: 17 }}>
        {direct
          ? "Only you received this request."
          : `The first ${maxAccepts} pros to accept get the homeowner's name, phone and email.`}
      </p>

      {error && (
        <div className="pro-notice pro-notice--danger" role="alert" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      {!confirmPass ? (
        <div className="pro-btn-row">
          <button
            type="button"
            className="pro-btn pro-btn--primary pro-btn--big"
            onClick={() => run("accept")}
            disabled={pending}
          >
            {busy === "accept" ? <Loader2 className="animate-spin" size={22} aria-hidden /> : null}
            {busy === "accept" ? "Accepting..." : "Accept this job"}
          </button>
          <button
            type="button"
            className="pro-btn pro-btn--secondary"
            onClick={() => setConfirmPass(true)}
            disabled={pending}
          >
            No thanks, pass
          </button>
        </div>
      ) : (
        <div className="pro-card" style={{ boxShadow: "none" }}>
          <p style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 600 }}>
            Pass on this job? You will not be able to accept it later.
          </p>
          <div className="pro-btn-row pro-btn-row--2">
            <button type="button" className="pro-btn pro-btn--forest" onClick={() => run("pass")} disabled={pending}>
              {busy === "pass" ? "Passing..." : "Yes, pass"}
            </button>
            <button type="button" className="pro-btn pro-btn--secondary" onClick={() => setConfirmPass(false)} disabled={pending}>
              Keep this job
            </button>
          </div>
        </div>
      )}

      <p className="pro-small" style={{ margin: "16px 0 0" }}>
        Accepting is free. By tapping &ldquo;Accept this job&rdquo; you agree to pay Landy&apos;s {fee} if the
        homeowner hires you, only after they have paid you.{" "}
        <Link href="/terms" className="pro-link" style={{ fontSize: 16, minHeight: 0, display: "inline" }}>
          How the fee works
        </Link>
      </p>
    </div>
  );
}
