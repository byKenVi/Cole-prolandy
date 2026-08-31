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

export function OpportunityDistributionForm({
  maxLeadPurchases,
  leadExpiryHours,
  acceptanceUnlimited,
}: {
  maxLeadPurchases: number;
  leadExpiryHours: number;
  acceptanceUnlimited: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [maxAcceptances, setMaxAcceptances] = useState(String(maxLeadPurchases));
  const [hours, setHours] = useState(String(leadExpiryHours));
  const [unlimited, setUnlimited] = useState(acceptanceUnlimited);

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
        const r1 = await updateSetting("maxLeadPurchases", Number(maxAcceptances));
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
      setStatus("saved");
      setMessage(null);
      setTimeout(() => setStatus("idle"), 1800);
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <p style={{ ...hintStyle, margin: "0 0 18px", lineHeight: 1.5 }}>
        When Unlimited is disabled, only the first X eligible contractors who accept receive the
        landowner contact details.
      </p>

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
        Unlimited acceptance
      </label>
      <p style={{ ...hintStyle, margin: "-8px 0 20px" }}>
        When enabled, there is no cap on how many contractors can accept the same opportunity.
      </p>

      <label style={labelStyle} htmlFor="maxAcceptances">
        Max contractors who may accept
      </label>
      <input
        id="maxAcceptances"
        type="number"
        min="1"
        value={maxAcceptances}
        onChange={(e) => setMaxAcceptances(e.target.value)}
        disabled={unlimited}
        style={{
          ...inputStyle,
          opacity: unlimited ? 0.55 : 1,
        }}
      />
      <p style={{ ...hintStyle, margin: "7px 0 20px" }}>
        Default is 3. Only the first N eligible contractors who accept receive landowner contact
        details. Ignored when Unlimited is enabled.
      </p>

      <label style={labelStyle} htmlFor="expiryHours">
        Lead / opportunity expiry (hours)
      </label>
      <input
        id="expiryHours"
        type="number"
        min="1"
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        style={inputStyle}
      />
      <p style={{ ...hintStyle, margin: "7px 0 22px" }}>
        An opportunity can no longer be accepted after this many hours, unless the acceptance
        limit is reached first.
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
        {pending ? "Saving…" : status === "saved" ? "Saved ✓" : "Save distribution"}
      </button>
    </form>
  );
}
