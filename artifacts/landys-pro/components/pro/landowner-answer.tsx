"use client";

import { useState, useTransition } from "react";
import { landownerConfirmAction } from "@/app/actions/follow-up";

/**
 * "Did you hire one of these pros?" — the email buttons pre-select an answer,
 * but nothing is saved until the homeowner taps Confirm (email security
 * scanners open links automatically and must never answer for them).
 */
export function LandownerAnswer({
  token,
  pros,
  initialChoice,
}: {
  token: string;
  pros: Array<{ matchId: string; name: string }>;
  initialChoice: string | null;
}) {
  const [choice, setChoice] = useState<string | null>(initialChoice);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const options = [
    ...pros.map((p) => ({ value: p.matchId, label: `I hired ${p.name}` })),
    { value: "none", label: "I have not hired anyone yet" },
    { value: "other", label: "I hired someone else" },
  ];

  function confirm() {
    if (!choice) {
      setError("Choose one answer first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await landownerConfirmAction(token, choice);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="pro-notice pro-notice--ok" role="status">
        <strong>Thank you!</strong>
        Your answer is saved. Good luck with your project.
      </div>
    );
  }

  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
      <legend className="pro-label" style={{ marginBottom: 12 }}>
        Choose the answer that fits
      </legend>
      <div className="pro-stack" style={{ gap: 10 }}>
        {options.map((option) => (
          <label key={option.value} className="pro-choice">
            <input
              type="radio"
              name="hired"
              value={option.value}
              checked={choice === option.value}
              onChange={() => setChoice(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {error && (
        <div className="pro-notice pro-notice--danger" role="alert" style={{ marginTop: 14 }}>
          {error}
        </div>
      )}
      <button
        type="button"
        className="pro-btn pro-btn--primary pro-btn--big"
        style={{ marginTop: 18 }}
        onClick={confirm}
        disabled={pending}
      >
        {pending ? "Saving..." : "Confirm my answer"}
      </button>
    </fieldset>
  );
}
