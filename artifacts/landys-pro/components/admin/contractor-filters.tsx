"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Active / Archived tabs + search (right-aligned) for contractors — matches leads
 * page layout. Archived = deactivated. Filter drives URL (?filter=).
 */
export function ContractorFilters({ q, filter }: { q: string; filter: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(q);

  const tab = filter === "deactivated" ? "archived" : "active";

  function go(nextQ: string, nextFilter: string) {
    const params = new URLSearchParams();
    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (nextFilter) params.set("filter", nextFilter);
    const qs = params.toString();
    router.push(qs ? `/admin/contractors?${qs}` : "/admin/contractors");
  }

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
        }}
        role="tablist"
        aria-label="Contractor status"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "active"}
          style={segStyle(tab === "active")}
          onClick={() => go(query, "")}
        >
          Active
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "archived"}
          style={segStyle(tab === "archived")}
          onClick={() => go(query, "deactivated")}
        >
          Archived
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(query, filter === "deactivated" ? "deactivated" : "");
        }}
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
          marginLeft: "auto",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email"
          aria-label="Search contractors"
          className="a-input"
          style={{ width: "100%", font: "400 14px/1 'Inter'" }}
        />
      </form>
    </div>
  );
}
