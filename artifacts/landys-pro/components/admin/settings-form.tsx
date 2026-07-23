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

/** Lead distribution settings — wired to the real updateSetting server action. */
export function SettingsForm({
  maxLeadRecipients,
  leadExpiryHours,
  defaultLeadTier,
}: {
  maxLeadRecipients: number;
  leadExpiryHours: number;
  defaultLeadTier: number;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [recipients, setRecipients] = useState(String(maxLeadRecipients));
  const [hours, setHours] = useState(String(leadExpiryHours));
  const [tier, setTier] = useState(String(defaultLeadTier));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const r1 = await updateSetting("maxLeadRecipients", Number(recipients));
      if (!r1.ok) {
        setStatus("error");
        setMessage(r1.message);
        return;
      }
      const r2 = await updateSetting("leadExpiryHours", Number(hours));
      if (!r2.ok) {
        setStatus("error");
        setMessage(r2.message);
        return;
      }
      const r3 = await updateSetting("defaultLeadTier", Number(tier));
      if (!r3.ok) {
        setStatus("error");
        setMessage(r3.message);
        return;
      }
      setStatus("saved");
      setMessage(null);
      setTimeout(() => setStatus("idle"), 1800);
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <label style={labelStyle} htmlFor="recipients">
        Max lead recipients
      </label>
      <input
        id="recipients"
        type="number"
        min="1"
        value={recipients}
        onChange={(e) => setRecipients(e.target.value)}
        style={inputStyle}
      />
      <p style={{ ...hintStyle, margin: "7px 0 20px" }}>
        Up to this many contractors receive each shared lead. Minimum 1.
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
      <p style={{ ...hintStyle, margin: "7px 0 22px" }}>
        A lead can no longer be accepted after this many hours.
      </p>

      <label style={labelStyle} htmlFor="default-tier">
        Public estimate default tier
      </label>
      <select
        id="default-tier"
        value={tier}
        onChange={(e) => setTier(e.target.value)}
        style={inputStyle}
      >
        <option value="1">Tier 1 · Small</option>
        <option value="2">Tier 2 · Standard</option>
        <option value="3">Tier 3 · Large</option>
      </select>
      <p style={{ ...hintStyle, margin: "7px 0 22px" }}>
        Applied to public estimate requests because landowners do not select pricing tiers.
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
