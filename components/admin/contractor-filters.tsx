"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Search + plan filter for the contractors list. Drives the existing
 * server-side query via URL params (?q= &filter=), so filtering stays real and
 * bookmarkable. Submitting the search or changing the plan navigates.
 */
export function ContractorFilters({ q, filter }: { q: string; filter: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(q);
  const [plan, setPlan] = useState(filter);

  function go(nextQ: string, nextPlan: string) {
    const params = new URLSearchParams();
    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (nextPlan) params.set("filter", nextPlan);
    const qs = params.toString();
    router.push(qs ? `/admin/contractors?${qs}` : "/admin/contractors");
  }

  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(query, plan);
        }}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 46,
          padding: "0 15px",
          background: "var(--field)",
          border: "1px solid var(--fieldLine)",
          borderRadius: 12,
        }}
        className="a-field"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email"
          className="a-input"
          style={{ width: "100%", font: "400 14px/1 'Inter'" }}
        />
      </form>
      <select
        value={plan}
        onChange={(e) => {
          setPlan(e.target.value);
          go(query, e.target.value);
        }}
        style={{
          height: 46,
          padding: "0 14px",
          border: "1px solid var(--fieldLine)",
          borderRadius: 12,
          background: "var(--field)",
          color: "var(--ink)",
          fontFamily: "Inter",
          cursor: "pointer",
        }}
      >
        <option value="">Active</option>
        <option value="pro">Pro</option>
        <option value="toppro">Top Pro</option>
        <option value="free">Free</option>
        <option value="deactivated">Deactivated</option>
      </select>
    </div>
  );
}
