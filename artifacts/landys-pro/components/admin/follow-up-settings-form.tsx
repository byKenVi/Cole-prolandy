"use client";

import { useState, useTransition } from "react";
import { updateSetting } from "@/app/actions/admin";

const labelStyle: React.CSSProperties = {
  display: "block",
  font: "600 13px/1 'Inter'",
  color: "var(--ink)",
  marginBottom: 8,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 46,
  padding: "0 14px",
  border: "1px solid var(--fieldLine)",
  borderRadius: 11,
  background: "var(--field)",
  color: "var(--ink)",
  fontFamily: "Inter",
};
const hintStyle: React.CSSProperties = {
  font: "400 12px/1.4 'Inter'",
  color: "var(--ink3)",
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

  return (
    <form onSubmit={onSubmit}>
      <label style={labelStyle} htmlFor="outcomeDelay">
        Ask contractor if they won the job after
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
        <input
          id="outcomeDelay"
          type="number"
          min="1"
          value={outcomeDelay}
          onChange={(e) => setOutcomeDelay(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <span style={{ ...hintStyle, flex: "none" }}>hours</span>
      </div>
      <p style={{ ...hintStyle, margin: "0 0 20px" }}>
        Hours after acceptance before asking the contractor whether they won the job.
      </p>

      <label style={labelStyle} htmlFor="paymentDelay">
        Ask whether the landowner has paid after
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
        <input
          id="paymentDelay"
          type="number"
          min="1"
          value={paymentDelay}
          onChange={(e) => setPaymentDelay(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <span style={{ ...hintStyle, flex: "none" }}>hours</span>
      </div>
      <p style={{ ...hintStyle, margin: "0 0 20px" }}>
        Hours after a won job before asking whether the landowner has paid.
      </p>

      <label style={labelStyle} htmlFor="paymentRetry">
        If not yet paid, ask again after
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
        <input
          id="paymentRetry"
          type="number"
          min="1"
          value={paymentRetry}
          onChange={(e) => setPaymentRetry(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <span style={{ ...hintStyle, flex: "none" }}>hours</span>
      </div>
      <p style={{ ...hintStyle, margin: "0 0 22px" }}>
        Hours to wait before re-asking if the contractor selects &ldquo;Not yet&rdquo; on payment.
      </p>

      {message && (
        <p style={{ margin: "0 0 14px", font: "500 13px/1.4 'Inter'", color: "var(--danger)" }}>
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="a-gold"
        style={{
          width: "100%",
          height: 50,
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
