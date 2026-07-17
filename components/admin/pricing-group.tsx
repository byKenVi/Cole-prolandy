"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { updatePriceTier } from "@/app/actions/admin";
import { centsToDollars, dollarsToCents } from "@/lib/money";

type Tier = { id: string; tier: number; priceCents: number };
type Row = { projectTypeId: string; name: string; tiers: Tier[] };

/**
 * One trade's pricing card: a project × tier matrix with a single per-trade
 * "Save changes" button (matching the design model). Each tier maps to a real
 * PriceTier row; saving diffs the values and calls the existing updatePriceTier
 * server action for every changed cell. Money logic is untouched — this only
 * edits the matrix that prices *future* leads.
 */
export function PricingGroup({
  name,
  sub,
  iconSrc,
  rows,
}: {
  name: string;
  sub: string;
  iconSrc: string | null;
  rows: Row[];
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const original = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of rows) for (const t of r.tiers) map[t.id] = String(centsToDollars(t.priceCents));
    return map;
  }, [rows]);

  const [values, setValues] = useState<Record<string, string>>(original);

  const max = useMemo(() => {
    const nums = Object.values(values).map((v) => parseFloat(v) || 0);
    return Math.max(1, ...nums);
  }, [values]);

  function setCell(id: string, raw: string) {
    const v = raw.replace(/[^0-9.]/g, "");
    setValues((s) => ({ ...s, [id]: v }));
    setStatus("idle");
    setMessage(null);
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const changed = Object.entries(values).filter(
        ([id, v]) => dollarsToCents(v) !== dollarsToCents(original[id]),
      );
      for (const [id, v] of changed) {
        const res = await updatePriceTier(id, dollarsToCents(v));
        if (!res.ok) {
          setStatus("error");
          setMessage(res.message);
          return;
        }
      }
      setStatus("saved");
      setMessage(changed.length ? "Saved" : "No changes");
      setTimeout(() => setStatus("idle"), 1800);
    });
  }

  const TIER_NAMES = ["Tier 1 · Small", "Tier 2 · Standard", "Tier 3 · Large"] as const;

  return (
    <div
      className="pricing-group"
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 18,
        boxShadow: "var(--shadow)",
        overflow: "hidden",
      }}
    >
      <div className="pricing-group-head">
        <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0, flex: 1 }}>
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: 13,
              background: "var(--card2)",
              border: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
            }}
          >
            {iconSrc ? (
              <Image src={iconSrc} alt="" width={28} height={28} style={{ objectFit: "contain" }} />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <path d="M8 12h8M12 8v8" />
              </svg>
            )}
          </span>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                font: "600 17px/1.2 'Inter'",
                color: "var(--ink)",
                overflowWrap: "anywhere",
              }}
            >
              {name}
            </p>
            <p style={{ margin: "4px 0 0", font: "400 12px/1 'Inter'", color: "var(--ink3)" }}>
              {sub}
            </p>
          </div>
        </div>
        <div className="pricing-group-actions">
          {message && (
            <span
              style={{
                font: "500 12px/1 'Inter'",
                color: status === "error" ? "var(--danger)" : "var(--sageFg)",
              }}
            >
              {message}
            </span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="pricing-save-btn"
            style={{
              height: 38,
              padding: "0 18px",
              background: "var(--sageFg)",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              font: "600 13px/1 'Inter'",
              cursor: pending ? "default" : "pointer",
              opacity: pending ? 0.8 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
            }}
          >
            {pending ? "Saving…" : status === "saved" ? "Saved" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="pricing-group-body">
        {/* Desktop: 4-col matrix */}
        <div className="pricing-matrix-desktop">
          <div className="pricing-matrix-head">
            <span style={colLabel}>Project type</span>
            <span style={colLabel}>Tier 1</span>
            <span style={colLabel}>Tier 2</span>
            <span style={colLabel}>Tier 3</span>
          </div>

          {rows.map((r) => (
            <div key={r.projectTypeId} className="pricing-matrix-row">
              <span style={{ font: "500 14px/1.3 'Inter'", color: "var(--ink)" }}>{r.name}</span>
              {[1, 2, 3].map((tierNum) => {
                const tier = r.tiers.find((t) => t.tier === tierNum);
                if (!tier) return <span key={tierNum} style={{ color: "var(--ink3)" }}>—</span>;
                return (
                  <TierField
                    key={tierNum}
                    value={values[tier.id] ?? ""}
                    max={max}
                    onChange={(v) => setCell(tier.id, v)}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Mobile: stacked labeled fields */}
        <div className="pricing-matrix-mobile">
          {rows.map((r) => (
            <div key={r.projectTypeId} className="pricing-mobile-block">
              <p className="pricing-mobile-project">{r.name}</p>
              {[1, 2, 3].map((tierNum) => {
                const tier = r.tiers.find((t) => t.tier === tierNum);
                if (!tier) {
                  return (
                    <div key={tierNum} className="pricing-mobile-tier">
                      <span style={colLabel}>{TIER_NAMES[tierNum - 1]}</span>
                      <span style={{ color: "var(--ink3)" }}>—</span>
                    </div>
                  );
                }
                return (
                  <div key={tierNum} className="pricing-mobile-tier">
                    <span style={colLabel}>{TIER_NAMES[tierNum - 1]}</span>
                    <TierField
                      value={values[tier.id] ?? ""}
                      max={max}
                      onChange={(v) => setCell(tier.id, v)}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TierField({
  value,
  max,
  onChange,
}: {
  value: string;
  max: number;
  onChange: (v: string) => void;
}) {
  const pct = Math.round(((parseFloat(value) || 0) / max) * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
      <div
        className="a-field"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: 42,
          padding: "0 12px",
          background: "var(--field)",
          border: "1px solid var(--fieldLine)",
          borderRadius: 11,
        }}
      >
        <span style={{ color: "var(--gold)", fontWeight: 700 }}>$</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          className="a-input"
          style={{
            width: "100%",
            minWidth: 0,
            font: "600 15px/1 'Inter'",
            fontVariantNumeric: "tabular-nums",
          }}
        />
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 999,
          background: "var(--track)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "var(--gold)",
            borderRadius: 999,
            transition: "width .3s ease",
          }}
        />
      </div>
    </div>
  );
}

const colLabel: React.CSSProperties = {
  font: "600 10px/1 var(--mono)",
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "var(--ink3)",
};
