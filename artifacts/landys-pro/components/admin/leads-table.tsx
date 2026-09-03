"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ChipStyle } from "@/lib/admin-display";

export type LeadRow = {
  id: string;
  title: string;
  category: string;
  place: string;
  recipients: number;
  accepted: number;
  sent: string;
  sentAtIso: string;
  price: string;
  priceCents: number | null;
  iconSrc: string | null;
  status: ChipStyle;
  filter: "new" | "active" | "accepted" | "closed" | "other";
};

type StatusTab = "all" | "new" | "active" | "accepted" | "closed";
type SortKey = "date" | "value";
type SortDir = "desc" | "asc";

const GRID = "52px minmax(200px,2.2fr) minmax(150px,1.4fr) 88px 88px 110px 100px 108px";
const HEAD_CELL: React.CSSProperties = {
  font: "600 10px/1 var(--mono)",
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "var(--ink3)",
};

export function LeadsTable({
  leads,
  total,
  pageCount,
  initialQuery = "",
  pagination,
  initialStatus = "all",
  statusCounts,
  initialSort = "date",
  initialDir = "desc",
}: {
  leads: LeadRow[];
  total: number;
  pageCount?: number;
  initialQuery?: string;
  pagination?: React.ReactNode;
  initialStatus?: StatusTab;
  statusCounts?: Record<StatusTab, number>;
  initialSort?: SortKey;
  initialDir?: SortDir;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);

  const q = query.trim().toLowerCase();
  const shown = leads.filter(
    (l) =>
      !q ||
      l.title.toLowerCase().includes(q) ||
      l.category.toLowerCase().includes(q) ||
      l.place.toLowerCase().includes(q),
  );

  function pushParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function toggleSort(key: SortKey) {
    if (initialSort === key) {
      pushParams({ sort: key, dir: initialDir === "desc" ? "asc" : "desc" });
    } else {
      pushParams({ sort: key, dir: "desc" });
    }
  }

  const sortHint = useMemo(() => {
    const arrow = initialDir === "desc" ? "↓" : "↑";
    return { date: initialSort === "date" ? arrow : "", value: initialSort === "value" ? arrow : "" };
  }, [initialSort, initialDir]);

  const segStyle = (active: boolean): React.CSSProperties => ({
    cursor: "pointer",
    border: "none",
    font: "600 13px/1 'Inter'",
    padding: "9px 14px",
    borderRadius: 9,
    background: active ? "var(--card)" : "transparent",
    color: active ? "var(--ink)" : "var(--ink2)",
    boxShadow: active ? "0 1px 3px rgba(58,53,45,.14)" : "none",
  });

  const tabs: { key: StatusTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "new", label: "New" },
    { key: "active", label: "Active" },
    { key: "accepted", label: "Accepted" },
    { key: "closed", label: "Expired / Closed" },
  ];

  function SortButton({ label, sortKey, align }: { label: string; sortKey: SortKey; align?: "right" }) {
    const active = initialSort === sortKey;
    return (
      <button
        type="button"
        onClick={() => toggleSort(sortKey)}
        style={{
          ...HEAD_CELL,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textAlign: align ?? "left",
          color: active ? "var(--ink)" : "var(--ink3)",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          justifyContent: align === "right" ? "flex-end" : "flex-start",
          width: "100%",
        }}
      >
        {label}
        <span aria-hidden style={{ opacity: active ? 1 : 0.35 }}>
          {sortHint[sortKey] || "↕"}
        </span>
      </button>
    );
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 16,
          flexWrap: "wrap",
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
            flexWrap: "wrap",
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              style={segStyle(initialStatus === t.key)}
              onClick={() => pushParams({ status: t.key === "all" ? null : t.key })}
            >
              {t.label}{" "}
              <span style={{ opacity: 0.55 }}>
                {statusCounts?.[t.key] ?? (t.key === "all" ? total : "—")}
              </span>
            </button>
          ))}
        </div>

        <div
          className="a-field"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            height: 44,
            padding: "0 14px",
            background: "var(--field)",
            border: "1px solid var(--line)",
            borderRadius: 11,
            flex: "1 1 240px",
            minWidth: 0,
            marginLeft: "auto",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--ink3)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" />
          </svg>
          <input
            className="a-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search job, trade or location…"
            aria-label="Search leads"
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
          overflowX: "auto",
        }}
      >
        <div className="admin-table-desktop">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              alignItems: "center",
              gap: 12,
              padding: "13px 22px",
              background: "var(--card2)",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <span />
            <span style={HEAD_CELL}>Project</span>
            <span style={HEAD_CELL}>Location</span>
            <span style={HEAD_CELL}>Matched</span>
            <span style={HEAD_CELL}>Accepted</span>
            <span style={HEAD_CELL}>Status</span>
            <SortButton label="Sent" sortKey="date" />
            <SortButton label="Estimated budget" sortKey="value" align="right" />
          </div>

          {shown.map((row) => (
            <Link
              key={row.id}
              href={`/admin/leads/${row.id}`}
              className="a-row"
              style={{
                display: "grid",
                gridTemplateColumns: GRID,
                alignItems: "center",
                gap: 12,
                padding: "15px 22px",
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
                <Image src={row.iconSrc || "/icons/excavation.png"} alt="" width={25} height={25} style={{ objectFit: "contain" }} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, font: "600 15px/1.25 'Inter'", color: "var(--ink)" }}>{row.title}</p>
                <p style={{ margin: "3px 0 0", font: "400 12px/1 'Inter'", color: "var(--ink3)" }}>
                  {row.category}
                </p>
              </div>
              <p style={{ margin: 0, font: "500 13px/1.3 'Inter'", color: "var(--ink2)", minWidth: 0 }}>
                {row.place}
              </p>
              <span style={{ font: "600 14px/1 'Inter'", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                {row.recipients}
              </span>
              <span style={{ font: "600 14px/1 'Inter'", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                {row.accepted}
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
                  font: "600 16px/1 var(--display)",
                  color: "var(--ink)",
                  fontVariantNumeric: "tabular-nums",
                  textAlign: "right",
                }}
              >
                {row.price}
              </span>
            </Link>
          ))}
        </div>

        <div className="admin-table-mobile" style={{ display: "none", flexDirection: "column" }}>
          {shown.map((row) => (
            <Link
              key={row.id}
              href={`/admin/leads/${row.id}`}
              className="a-row"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "16px 18px",
                borderBottom: "1px solid var(--line2)",
                textDecoration: "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <p style={{ margin: 0, font: "600 15px/1.25 'Inter'", color: "var(--ink)" }}>{row.title}</p>
                <span style={{ font: "600 15px/1 var(--display)", color: "var(--ink)" }}>{row.price}</span>
              </div>
              <p style={{ margin: 0, font: "400 12px/1.3 'Inter'", color: "var(--ink3)" }}>
                {row.place} · {row.recipients} matched · {row.accepted} accepted · {row.sent}
              </p>
              <span
                style={{
                  alignSelf: "flex-start",
                  font: "500 11px/1 'Inter'",
                  color: row.status.fg,
                  background: row.status.bg,
                  padding: "6px 11px",
                  borderRadius: 999,
                }}
              >
                {row.status.label}
              </span>
            </Link>
          ))}
        </div>

        {shown.length === 0 && (
          <p style={{ padding: "28px 24px", color: "var(--ink3)", fontSize: 14, textAlign: "center" }}>
            No requests in this view.
          </p>
        )}

        {pagination ? (
          pagination
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "14px 24px",
              background: "var(--card2)",
            }}
          >
            <span style={{ font: "400 13px/1 'Inter'", color: "var(--ink3)" }}>
              Showing {shown.length}
              {pageCount != null ? ` of ${pageCount} on this page` : ""}
              {" · "}
              {total} request{total === 1 ? "" : "s"} total
            </span>
          </div>
        )}
      </div>
    </>
  );
}
