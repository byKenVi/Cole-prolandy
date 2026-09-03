"use client";

import { useState, useTransition } from "react";
import { updateSuccessFeeTiers } from "@/app/actions/admin";

const hintStyle: React.CSSProperties = {
  font: "400 13px/1.45 'Inter'",
  color: "var(--ink3)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 46,
  padding: "0 12px",
  border: "1px solid var(--fieldLine)",
  borderRadius: 11,
  background: "var(--field)",
  color: "var(--ink)",
  fontFamily: "Inter",
  fontSize: 15,
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

function tierAccent(sortOrder: number): { bar: string; soft: string } {
  if (sortOrder === 1) return { bar: "var(--gold)", soft: "var(--goldSoft)" };
  if (sortOrder === 2) return { bar: "var(--sageFg)", soft: "var(--posBg)" };
  return { bar: "var(--ink2)", soft: "var(--card2)" };
}

function tierRangeCopy(
  sortOrder: number,
  maxValueDollars: number | null,
  previousMax: number | null,
) {
  if (sortOrder === 1) {
    return `Jobs up to ${formatUsd(maxValueDollars)}`;
  }
  if (sortOrder === 2) {
    const from = previousMax != null ? previousMax + 1 : null;
    return `${formatUsd(from)} – ${formatUsd(maxValueDollars)}`;
  }
  const from = previousMax != null ? previousMax + 1 : null;
  return `${formatUsd(from)} and above`;
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
      <p style={{ ...hintStyle, margin: "0 0 20px" }}>
        Rate is locked in when a contractor reports Won with a final contract value. Changing tiers
        here doesn&apos;t rewrite existing fees.
      </p>

      <div
        className="success-fee-tier-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 14,
          marginBottom: 22,
        }}
      >
        {sorted.map((tier, index) => {
          const previousMax = index > 0 ? sorted[index - 1].maxValueDollars : null;
          const accent = tierAccent(tier.sortOrder);
          const heading = tierHeading(tier.sortOrder);

          return (
            <div
              key={tier.id}
              style={{
                borderRadius: 16,
                border: "1px solid var(--line)",
                background: "var(--card)",
                overflow: "hidden",
                boxShadow: "var(--shadow)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: "16px 16px 14px",
                  background: accent.soft,
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 4,
                    borderRadius: 999,
                    background: accent.bar,
                    marginBottom: 10,
                  }}
                />
                <p
                  style={{
                    margin: 0,
                    font: "700 13px/1 var(--mono)",
                    letterSpacing: ".1em",
                    color: "var(--ink)",
                  }}
                >
                  {heading}
                </p>
                <p style={{ margin: "8px 0 0", font: "500 13px/1.35 'Inter'", color: "var(--ink2)" }}>
                  {tierRangeCopy(tier.sortOrder, tier.maxValueDollars, previousMax)}
                </p>
              </div>

              <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
                {tier.sortOrder < 3 ? (
                  <div>
                    <label
                      style={{
                        display: "block",
                        font: "600 11px/1 var(--mono)",
                        letterSpacing: ".04em",
                        textTransform: "uppercase",
                        color: "var(--ink3)",
                        marginBottom: 7,
                      }}
                    >
                      Up to (USD)
                    </label>
                    <div style={{ position: "relative" }}>
                      <span
                        style={{
                          position: "absolute",
                          left: 12,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "var(--ink3)",
                          font: "500 14px/1 'Inter'",
                          pointerEvents: "none",
                        }}
                      >
                        $
                      </span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={tier.maxValueDollars ?? ""}
                        onChange={(e) =>
                          updateRow(tier.id, { maxValueDollars: Number(e.target.value) || 0 })
                        }
                        style={{ ...inputStyle, paddingLeft: 26 }}
                        aria-label={`${heading} maximum contract value`}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label
                      style={{
                        display: "block",
                        font: "600 11px/1 var(--mono)",
                        letterSpacing: ".04em",
                        textTransform: "uppercase",
                        color: "var(--ink3)",
                        marginBottom: 7,
                      }}
                    >
                      Ceiling
                    </label>
                    <div
                      style={{
                        ...inputStyle,
                        display: "flex",
                        alignItems: "center",
                        opacity: 0.75,
                        color: "var(--ink2)",
                      }}
                    >
                      No maximum
                    </div>
                  </div>
                )}

                <div>
                  <label
                    style={{
                      display: "block",
                      font: "600 11px/1 var(--mono)",
                      letterSpacing: ".04em",
                      textTransform: "uppercase",
                      color: "var(--ink3)",
                      marginBottom: 7,
                    }}
                  >
                    Landy&apos;s rate
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      value={tier.ratePercent}
                      onChange={(e) =>
                        updateRow(tier.id, { ratePercent: Number(e.target.value) || 0 })
                      }
                      style={{ ...inputStyle, paddingRight: 36 }}
                      aria-label={`${heading} success fee percent`}
                    />
                    <span
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--ink3)",
                        font: "600 14px/1 'Inter'",
                        pointerEvents: "none",
                      }}
                    >
                      %
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .success-fee-tier-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

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
          maxWidth: 420,
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
