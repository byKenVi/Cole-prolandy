"use client";

import { useState, useTransition } from "react";
import { updateBooleanSetting, updateSetting } from "@/app/actions/admin";

const labelStyle: React.CSSProperties = {
  display: "block",
  font: "600 14px/1.2 'Inter'",
  color: "var(--ink)",
  marginBottom: 6,
};
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
const hintStyle: React.CSSProperties = {
  font: "400 13px/1.45 'Inter'",
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
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div
        style={{
          padding: "16px 18px",
          borderRadius: 14,
          border: "1px solid var(--line)",
          background: unlimited ? "var(--posBg)" : "var(--card2)",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={unlimited}
            onChange={(e) => setUnlimited(e.target.checked)}
            style={{ width: 20, height: 20, marginTop: 2, accentColor: "var(--gold)", flex: "none" }}
          />
          <span>
            <span style={{ display: "block", font: "600 15px/1.3 'Inter'", color: "var(--ink)" }}>
              Unlimited acceptances
            </span>
            <span style={{ ...hintStyle, display: "block", marginTop: 4 }}>
              Any number of eligible contractors can accept and receive landowner contact details.
            </span>
          </span>
        </label>
      </div>

      <div style={{ opacity: unlimited ? 0.45 : 1, pointerEvents: unlimited ? "none" : "auto" }}>
        <label style={labelStyle} htmlFor="maxAcceptances">
          Acceptance cap
        </label>
        <p style={{ ...hintStyle, margin: "0 0 10px" }}>
          Only the first {unlimited ? "N" : maxAcceptances || "N"} contractors who accept get the
          landowner&apos;s contact info. Default is 3.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 220 }}>
          <input
            id="maxAcceptances"
            type="number"
            min="1"
            value={maxAcceptances}
            onChange={(e) => setMaxAcceptances(e.target.value)}
            disabled={unlimited}
            style={inputStyle}
          />
          <span style={{ ...hintStyle, flex: "none", whiteSpace: "nowrap" }}>contractors</span>
        </div>
      </div>

      <div>
        <label style={labelStyle} htmlFor="expiryHours">
          Opportunity expiry
        </label>
        <p style={{ ...hintStyle, margin: "0 0 10px" }}>
          After this many hours, contractors can no longer accept — unless the acceptance cap was
          hit first.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 220 }}>
          <input
            id="expiryHours"
            type="number"
            min="1"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            style={inputStyle}
          />
          <span style={{ ...hintStyle, flex: "none" }}>hours</span>
        </div>
      </div>

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
