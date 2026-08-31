"use client";

import { useState, useTransition } from "react";
import { updateSuccessFeeTiers } from "@/app/actions/admin";

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

export type SuccessFeeTierFormRow = {
  id: string;
  sortOrder: number;
  label: string;
  maxValueDollars: number | null;
  ratePercent: number;
};

function formatUsd(amount: number | null | undefined) {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function tierHeading(sortOrder: number) {
  if (sortOrder === 1) return "SMALL";
  if (sortOrder === 2) return "MEDIUM";
  return "LARGE";
}

function tierThresholdCopy(
  sortOrder: number,
  maxValueDollars: number | null,
  previousMax: number | null,
) {
  if (sortOrder === 1) {
    return `Up to ${formatUsd(maxValueDollars)}`;
  }
  if (sortOrder === 2) {
    return `From ${formatUsd(previousMax)} / Up to ${formatUsd(maxValueDollars)}`;
  }
  return `From ${formatUsd(previousMax)} / No maximum`;
}

export function SuccessFeeTiersForm({ tiers }: { tiers: SuccessFeeTierFormRow[] }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState(tiers);

  function updateRow(
    id: string,
    patch: Partial<Pick<SuccessFeeTierFormRow, "maxValueDollars" | "ratePercent">>,
  ) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await updateSuccessFeeTiers(
        rows.map((r) => ({
          id: r.id,
          maxValueDollars: r.maxValueDollars,
          ratePercent: r.ratePercent,
        })),
      );
      if (!res.ok) {
        setStatus("error");
        setMessage(res.message ?? "Save failed.");
        return;
      }
      setStatus("saved");
      setMessage(null);
      setTimeout(() => setStatus("idle"), 1800);
    });
  }

  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <form onSubmit={onSubmit}>
      <p style={{ ...hintStyle, margin: "0 0 18px", lineHeight: 1.5 }}>
        The applicable rate is snapshotted when a contractor reports a job as Won using the final
        contract value. Existing fees are not changed when these settings are edited.
      </p>
      {sorted.map((tier, index) => {
        const previousMax = index > 0 ? sorted[index - 1].maxValueDollars : null;
        return (
          <div key={tier.id} style={{ marginBottom: 20 }}>
            <p style={{ ...labelStyle, marginBottom: 4 }}>{tierHeading(tier.sortOrder)}</p>
            <p style={{ ...hintStyle, margin: "0 0 10px" }}>
              {tierThresholdCopy(tier.sortOrder, tier.maxValueDollars, previousMax)}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {tier.sortOrder < 3 ? (
                <div>
                  <label style={{ ...hintStyle, display: "block", marginBottom: 6 }}>
                    Up to (USD)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={tier.maxValueDollars ?? ""}
                    onChange={(e) =>
                      updateRow(tier.id, { maxValueDollars: Number(e.target.value) || 0 })
                    }
                    style={inputStyle}
                  />
                </div>
              ) : (
                <div>
                  <label style={{ ...hintStyle, display: "block", marginBottom: 6 }}>
                    Threshold
                  </label>
                  <input
                    type="text"
                    disabled
                    value="No maximum"
                    style={{ ...inputStyle, opacity: 0.7 }}
                  />
                </div>
              )}
              <div>
                <label style={{ ...hintStyle, display: "block", marginBottom: 6 }}>
                  Success fee rate (%)
                </label>
                <input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={tier.ratePercent}
                  onChange={(e) =>
                    updateRow(tier.id, { ratePercent: Number(e.target.value) || 0 })
                  }
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        );
      })}

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
        {pending ? "Saving…" : status === "saved" ? "Saved ✓" : "Save success fee tiers"}
      </button>
    </form>
  );
}
