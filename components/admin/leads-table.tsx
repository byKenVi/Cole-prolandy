"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ChipStyle } from "@/lib/admin-display";

export type LeadRow = {
  id: string;
  title: string;
  category: string;
  place: string;
  recipients: number;
  sent: string;
  price: string;
  iconSrc: string | null;
  tier: ChipStyle;
  status: ChipStyle;
  filter: "distributed" | "expired" | "other";
};

const GRID = "52px minmax(220px,2.4fr) minmax(170px,1.6fr) 84px 116px 130px 108px";
const HEAD_CELL: React.CSSProperties = {
  font: "600 11px/1 'Inter'",
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "var(--ink3)",
};

/**
 * Leads table with All / Distributed / Expired tabs. The full lead list is
 * fetched server-side (real data); the tabs filter it client-side, matching the
 * design model. Each row is a stretched link to the real lead detail page.
 */
export function LeadsTable({
  leads,
  total,
  initialQuery = "",
}: {
  leads: LeadRow[];
  total: number;
  initialQuery?: string;
}) {
  const [tab, setTab] = useState<"all" | "distributed" | "expired">("all");
  const [query, setQuery] = useState(initialQuery);

  const q = query.trim().toLowerCase();
  const matchesQuery = (l: LeadRow) =>
    !q ||
    l.title.toLowerCase().includes(q) ||
    l.category.toLowerCase().includes(q) ||
    l.place.toLowerCase().includes(q);

  const searched = leads.filter(matchesQuery);
  const counts = {
    all: searched.length,
    distributed: searched.filter((l) => l.filter === "distributed").length,
    expired: searched.filter((l) => l.filter === "expired").length,
  };
  const shown = tab === "all" ? searched : searched.filter((l) => l.filter === tab);

  const segStyle = (active: boolean): React.CSSProperties => ({
    cursor: "pointer",
    border: "none",
    font: "600 13px/1 'Inter'",
    padding: "9px 15px",
    borderRadius: 9,
    background: active ? "var(--card)" : "transparent",
    color: active ? "var(--ink)" : "var(--ink2)",
    boxShadow: active ? "0 1px 3px rgba(58,53,45,.14)" : "none",
  });

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 3,
            background: "var(--card2)",
            border: "1px solid var(--line)",
            padding: 4,
            borderRadius: 12,
          }}
        >
          <button type="button" style={segStyle(tab === "all")} onClick={() => setTab("all")}>
            All <span style={{ opacity: 0.55 }}>{counts.all}</span>
          </button>
          <button
            type="button"
            style={segStyle(tab === "distributed")}
            onClick={() => setTab("distributed")}
          >
            Distributed <span style={{ opacity: 0.55 }}>{counts.distributed}</span>
          </button>
          <button
            type="button"
            style={segStyle(tab === "expired")}
            onClick={() => setTab("expired")}
          >
            Expired <span style={{ opacity: 0.55 }}>{counts.expired}</span>
          </button>
        </div>

        <div
          className="a-field"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            height: 40,
            padding: "0 14px",
            background: "var(--field)",
            border: "1px solid var(--line)",
            borderRadius: 11,
            minWidth: 240,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" />
          </svg>
          <input
            className="a-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search job, trade or location…"
            aria-label="Search leads by job, trade or location"
            style={{ font: "400 14px/1 'Inter'", width: "100%" }}
          />
        </div>
      </div>

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 18,
          boxShadow: "var(--shadow)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: GRID,
            alignItems: "center",
            gap: 14,
            padding: "13px 24px",
            background: "var(--card2)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <span />
          <span style={HEAD_CELL}>Job</span>
          <span style={HEAD_CELL}>Trade &amp; location</span>
          <span style={HEAD_CELL}>Tier</span>
          <span style={HEAD_CELL}>Status</span>
          <span style={HEAD_CELL}>Sent</span>
          <span style={{ ...HEAD_CELL, textAlign: "right" }}>Price</span>
        </div>

        {shown.map((row) => (
          <Link
            key={row.id}
            href={`/admin/leads/${row.id}`}
            className="a-row admin-fade-up"
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              alignItems: "center",
              gap: 14,
              padding: "15px 24px",
              borderBottom: "1px solid var(--line2)",
              textDecoration: "none",
            }}
          >
            <span
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: "var(--card2)",
                border: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {row.iconSrc ? (
                <Image src={row.iconSrc} alt="" width={25} height={25} style={{ objectFit: "contain" }} />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="4" />
                  <path d="M8 12h8M12 8v8" />
                </svg>
              )}
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, font: "600 15px/1.25 'Inter'", color: "var(--ink)" }}>
                {row.title}
              </p>
              <p style={{ margin: "3px 0 0", font: "400 12px/1 'Inter'", color: "var(--ink3)" }}>
                {row.recipients} recipient{row.recipients === 1 ? "" : "s"}
              </p>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, font: "500 13px/1.3 'Inter'", color: "var(--ink2)" }}>
                {row.category}
              </p>
              <p style={{ margin: "2px 0 0", font: "400 12px/1 'Inter'", color: "var(--ink3)" }}>
                {row.place}
              </p>
            </div>
            <span
              style={{
                font: "600 11px/1 'Inter'",
                padding: "6px 10px",
                borderRadius: 999,
                color: row.tier.fg,
                background: row.tier.bg,
                whiteSpace: "nowrap",
                justifySelf: "start",
              }}
            >
              {row.tier.label}
            </span>
            <span
              style={{
                font: "500 11px/1 'Inter'",
                color: row.status.fg,
                background: row.status.bg,
                padding: "6px 11px",
                borderRadius: 999,
                justifySelf: "start",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 999, background: row.status.fg }} />
              {row.status.label}
            </span>
            <span style={{ font: "400 13px/1.3 'Inter'", color: "var(--ink2)" }}>{row.sent}</span>
            <span
              style={{
                font: "600 17px/1 'Inter'",
                color: "var(--ink)",
                fontVariantNumeric: "tabular-nums",
                textAlign: "right",
              }}
            >
              {row.price}
            </span>
          </Link>
        ))}

        {shown.length === 0 && (
          <p style={{ padding: "28px 24px", color: "var(--ink3)", fontSize: 14, textAlign: "center" }}>
            No leads in this view.
          </p>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 24px",
            background: "var(--card2)",
          }}
        >
          <span style={{ font: "400 13px/1 'Inter'", color: "var(--ink3)" }}>
            Showing {shown.length} of {total} lead{total === 1 ? "" : "s"}
          </span>
          <span style={{ font: "500 13px/1 'Inter'", color: "var(--goldSoftFg)" }}>
            Prices are snapshotted at send — matrix edits don&apos;t affect these.
          </span>
        </div>
      </div>
    </>
  );
}
