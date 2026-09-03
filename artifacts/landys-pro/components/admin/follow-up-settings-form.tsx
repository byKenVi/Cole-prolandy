"use client";

import { useState, useTransition } from "react";
import { updateSetting } from "@/app/actions/admin";
import { hoursToHuman } from "@/lib/hours-human";

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 48,
  padding: "0 14px",
  border: "1px solid var(--fieldLine)",
  borderRadius: 11,
  background: "var(--field)",
  color: "var(--ink)",
  fontFamily: "Inter",
  fontSize: 15,
};

type TimingRow = {
  id: string;
  title: string;
  plain: string;
  value: string;
  setValue: (v: string) => void;
  unit: string;
};

export function FollowUpSettingsForm({
  followUpOutcomeDelayHours,
  followUpPaymentDelayHours,
  followUpPaymentRetryHours,
}: {
  followUpOutcomeDelayHours: number;
  followUpPaymentDelayHours: number;
  followUpPaymentRetryHours: number;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [outcomeDelay, setOutcomeDelay] = useState(String(followUpOutcomeDelayHours));
  const [paymentDelay, setPaymentDelay] = useState(String(followUpPaymentDelayHours));
  const [paymentRetry, setPaymentRetry] = useState(String(followUpPaymentRetryHours));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const r3 = await updateSetting("followUpOutcomeDelayHours", Number(outcomeDelay));
      if (!r3.ok) {
        setStatus("error");
        setMessage(r3.message);
        return;
      }
      const r4 = await updateSetting("followUpPaymentDelayHours", Number(paymentDelay));
      if (!r4.ok) {
        setStatus("error");
        setMessage(r4.message);
        return;
      }
      const r5 = await updateSetting("followUpPaymentRetryHours", Number(paymentRetry));
      if (!r5.ok) {
        setStatus("error");
        setMessage(r5.message);
        return;
      }
      setStatus("saved");
      setMessage(null);
      setTimeout(() => setStatus("idle"), 1800);
    });
  }

  const rows: TimingRow[] = [
    {
      id: "outcomeDelay",
      title: "Ask if they won the job",
      plain: "Hours after a contractor accepts before we ask whether they got the work.",
      value: outcomeDelay,
      setValue: setOutcomeDelay,
      unit: "hours after acceptance",
    },
    {
      id: "paymentDelay",
      title: "Ask if you've been paid",
      plain: "Hours after a won job before we ask the contractor whether they've been paid.",
      value: paymentDelay,
      setValue: setPaymentDelay,
      unit: "hours after won",
    },
    {
      id: "paymentRetry",
      title: "Ask again if still unpaid",
      plain: 'If they say "Not yet," wait this long before checking on payment again.',
      value: paymentRetry,
      setValue: setPaymentRetry,
      unit: 'hours after "Not yet"',
    },
  ];

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {rows.map((row, i) => (
        <div
          key={row.id}
          style={{
            padding: "18px 18px",
            borderRadius: 14,
            border: "1px solid var(--line)",
            background: "var(--card2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
            <span
              style={{
                font: "700 11px/1 var(--mono)",
                color: "var(--gold)",
                letterSpacing: ".06em",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <label htmlFor={row.id} style={{ font: "600 15px/1.3 'Inter'", color: "var(--ink)" }}>
              {row.title}
            </label>
          </div>
          <p style={{ margin: "0 0 14px", font: "400 13px/1.45 'Inter'", color: "var(--ink3)" }}>
            {row.plain}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 320 }}>
            <input
              id={row.id}
              type="number"
              min="1"
              value={row.value}
              onChange={(e) => row.setValue(e.target.value)}
              style={inputStyle}
            />
            <span style={{ font: "500 13px/1.3 'Inter'", color: "var(--ink2)", flex: "none", whiteSpace: "nowrap" }}>
              {row.unit}
            </span>
          </div>
          {hoursToHuman(Number(row.value)) && (
            <p style={{ margin: "8px 0 0", font: "500 13px/1.3 'Inter'", color: "var(--goldSoftFg)" }}>
              {hoursToHuman(Number(row.value))}
            </p>
          )}
        </div>
      ))}

      {message && (
        <p style={{ margin: 0, font: "500 13px/1.4 'Inter'", color: "var(--danger)" }}>{message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="a-gold"
        style={{
          width: "100%",
          height: 50,
          marginTop: 6,
          background: "var(--gold)",
          color: "#fff",
          border: "none",
          borderRadius: 12,
          font: "600 16px/1 'Inter'",
          cursor: pending ? "default" : "pointer",
          boxShadow: "0 8px 18px rgba(192,128,60,.28)",
        }}
      >
        {pending ? "Saving…" : status === "saved" ? "Saved ✓" : "Save follow-ups"}
      </button>
    </form>
  );
}
