"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { PricingGroup } from "@/components/admin/pricing-group";

export type PricingGroupData = {
  id: string;
  name: string;
  sub: string;
  iconSrc: string | null;
  rows: {
    projectTypeId: string;
    name: string;
    tiers: { id: string; tier: number; priceCents: number }[];
  }[];
};

const PAGE_SIZE = 5;

/**
 * Client search + pagination over trade pricing groups so admins can browse
 * a long matrix without scrolling the full list.
 */
export function PricingBrowser({ groups }: { groups: PricingGroupData[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => {
      if (g.name.toLowerCase().includes(q)) return true;
      return g.rows.some((r) => r.name.toLowerCase().includes(q));
    });
  }, [groups, deferredQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function onQuery(next: string) {
    setQuery(next);
    setPage(1);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flex: "1 1 260px",
            maxWidth: 420,
            height: 44,
            padding: "0 14px",
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            boxShadow: "var(--shadow)",
          }}
        >
          <Search size={16} aria-hidden style={{ color: "var(--ink3)", flex: "none" }} />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search trade or project type…"
            aria-label="Search pricing"
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              font: "500 14px/1 'Inter'",
              color: "var(--ink)",
            }}
          />
        </label>
        <p style={{ margin: 0, font: "400 13px/1 'Inter'", color: "var(--ink3)" }}>
          {filtered.length} trade{filtered.length === 1 ? "" : "s"}
          {query.trim() ? " matching" : ""}
        </p>
      </div>

      {slice.length === 0 ? (
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 18,
            padding: "40px 24px",
            textAlign: "center",
            color: "var(--ink3)",
          }}
        >
          No trades match “{query.trim()}”.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {slice.map((g) => (
            <PricingGroup
              key={g.id}
              name={g.name}
              sub={g.sub}
              iconSrc={g.iconSrc}
              rows={g.rows}
            />
          ))}
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <nav
          aria-label="Pricing pagination"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "14px 20px",
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            boxShadow: "var(--shadow)",
          }}
        >
          <p style={{ margin: 0, font: "400 13px/1 'Inter'", color: "var(--ink3)" }}>
            Page {safePage} of {totalPages}
            <span>
              {" "}
              · {filtered.length} total
            </span>
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PageBtn
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              label="Previous page"
            >
              <ChevronLeft size={16} aria-hidden />
              Prev
            </PageBtn>
            <PageBtn
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              label="Next page"
            >
              Next
              <ChevronRight size={16} aria-hidden />
            </PageBtn>
          </div>
        </nav>
      )}
    </div>
  );
}

function PageBtn({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: 36,
        padding: "0 12px",
        borderRadius: 10,
        font: "600 13px/1 'Inter'",
        border: "1px solid var(--line)",
        background: disabled ? "var(--card2)" : "var(--card)",
        color: disabled ? "var(--ink3)" : "var(--ink)",
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}
