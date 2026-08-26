"use client";

import { useState, useTransition } from "react";
import { updateBooleanSetting, updateSetting } from "@/app/actions/admin";

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

export function SettingsForm({
  maxLeadPurchases,
  leadExpiryHours,
  acceptanceUnlimited,
  followUpOutcomeDelayHours,
  followUpPaymentDelayHours,
  followUpPaymentRetryHours,
}: {
  maxLeadPurchases: number;
  leadExpiryHours: number;
  acceptanceUnlimited: boolean;
  followUpOutcomeDelayHours: number;
  followUpPaymentDelayHours: number;
  followUpPaymentRetryHours: number;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [purchases, setPurchases] = useState(String(maxLeadPurchases));
  const [hours, setHours] = useState(String(leadExpiryHours));
  const [unlimited, setUnlimited] = useState(acceptanceUnlimited);
  const [outcomeDelay, setOutcomeDelay] = useState(String(followUpOutcomeDelayHours));
  const [paymentDelay, setPaymentDelay] = useState(String(followUpPaymentDelayHours));
  const [paymentRetry, setPaymentRetry] = useState(String(followUpPaymentRetryHours));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const rUnlimited = await updateBooleanSetting("acceptanceUnlimited", unlimited);
      if (!rUnlimited.ok) {
        setStatus("error");
        setMessage(rUnlimited.message);
        return;
      }
      if (!unlimited) {
        const r1 = await updateSetting("maxLeadPurchases", Number(purchases));
        if (!r1.ok) {
          setStatus("error");
          setMessage(r1.message);
          return;
        }
      }
      const r2 = await updateSetting("leadExpiryHours", Number(hours));
      if (!r2.ok) {
        setStatus("error");
        setMessage(r2.message);
        return;
      }
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
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          font: "600 13px/1 'Inter'",
          color: "var(--ink)",
          marginBottom: 16,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={unlimited}
          onChange={(e) => setUnlimited(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: "var(--gold)" }}
        />
        Unlimited acceptances per lead
      </label>
      <p style={{ ...hintStyle, margin: "-8px 0 20px" }}>
        When enabled, there is no cap on how many contractors can accept the same general lead.
      </p>

      <label style={labelStyle} htmlFor="purchases">
        Maximum acceptances per general lead
      </label>
      <input
        id="purchases"
        type="number"
        min="1"
        value={purchases}
        onChange={(e) => setPurchases(e.target.value)}
        disabled={unlimited}
        style={{
          ...inputStyle,
          opacity: unlimited ? 0.55 : 1,
        }}
      />
      <p style={{ ...hintStyle, margin: "7px 0 20px" }}>
        How many contractors can accept the same general lead (default 3). Ignored when unlimited
        acceptances is enabled.
      </p>

      <label style={labelStyle} htmlFor="hours">
        Lead expiry (hours)
      </label>
      <input
        id="hours"
        type="number"
        min="1"
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        style={inputStyle}
      />
      <p style={{ ...hintStyle, margin: "7px 0 20px" }}>
        A lead can no longer be purchased after this many hours unless sold out first.
      </p>

      <p
        style={{
          margin: "0 0 14px",
          font: "600 12px/1 var(--mono)",
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "var(--ink3)",
        }}
      >
        Follow-up timing
      </p>

      <label style={labelStyle} htmlFor="outcomeDelay">
        Outcome check delay (hours)
      </label>
      <input
        id="outcomeDelay"
        type="number"
        min="1"
        value={outcomeDelay}
        onChange={(e) => setOutcomeDelay(e.target.value)}
        style={inputStyle}
      />
      <p style={{ ...hintStyle, margin: "7px 0 20px" }}>
        Hours after acceptance before asking the contractor whether they won the job.
      </p>

      <label style={labelStyle} htmlFor="paymentDelay">
        Payment check delay (hours)
      </label>
      <input
        id="paymentDelay"
        type="number"
        min="1"
        value={paymentDelay}
        onChange={(e) => setPaymentDelay(e.target.value)}
        style={inputStyle}
      />
      <p style={{ ...hintStyle, margin: "7px 0 20px" }}>
        Hours after a won job before asking whether the landowner has paid.
      </p>

      <label style={labelStyle} htmlFor="paymentRetry">
        Payment retry delay (hours)
      </label>
      <input
        id="paymentRetry"
        type="number"
        min="1"
        value={paymentRetry}
        onChange={(e) => setPaymentRetry(e.target.value)}
        style={inputStyle}
      />
      <p style={{ ...hintStyle, margin: "7px 0 22px" }}>
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
        {pending ? "Saving…" : status === "saved" ? "Saved ✓" : "Save settings"}
      </button>
    </form>
  );
}
