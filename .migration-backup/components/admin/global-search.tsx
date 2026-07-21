"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminSearchSuggest, type SearchHit } from "@/app/actions/admin-search";

/**
 * Admin topbar search with live autosuggest — pick a result without pressing Enter.
 */
export function AdminGlobalSearch() {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        if (!q.trim()) {
          setHits([]);
          setOpen(false);
          return;
        }
        const next = await adminSearchSuggest(q);
        setHits(next);
        setOpen(true);
        setActive(0);
      });
    }, 180);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(hit: SearchHit) {
    setOpen(false);
    setQuery("");
    setHits([]);
    router.push(hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || hits.length === 0) {
      if (e.key === "Enter" && query.trim()) {
        e.preventDefault();
        router.push(`/admin/contractors?q=${encodeURIComponent(query.trim())}`);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[active];
      if (hit) go(hit);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="admin-search" style={{ position: "relative", flex: 1, minWidth: 0, maxWidth: 520 }}>
      <div
        className="a-field"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 46,
          padding: "0 18px",
          background: "var(--field)",
          border: "1px solid var(--line)",
          borderRadius: 999,
          minWidth: 0,
          width: "100%",
          boxShadow: "var(--shadowSm)",
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" />
        </svg>
        <input
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            runSearch(v);
          }}
          onFocus={() => {
            if (hits.length > 0) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search leads, contractors, trades…"
          className="a-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && hits[active] ? `${listId}-${hits[active].id}` : undefined}
          style={{ font: "400 14px/1 'Inter'", width: "100%" }}
        />
        <span
          className="admin-search-kbd"
          style={{
            font: "600 10px/1 var(--mono)",
            color: "var(--ink3)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            padding: "4px 6px",
            flex: "none",
          }}
        >
          ⌘K
        </span>
      </div>

      {open && (hits.length > 0 || pending) && (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            zIndex: 60,
            margin: 0,
            padding: 6,
            listStyle: "none",
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            boxShadow: "var(--shadow)",
            maxHeight: 360,
            overflowY: "auto",
          }}
        >
          {hits.length === 0 && pending ? (
            <li style={{ padding: "12px 14px", font: "400 13px/1 'Inter'", color: "var(--ink3)" }}>
              Searching…
            </li>
          ) : (
            hits.map((hit, i) => (
              <li key={`${hit.kind}-${hit.id}`} role="option" id={`${listId}-${hit.id}`} aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(hit)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    cursor: "pointer",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: i === active ? "var(--card2)" : "transparent",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      marginBottom: 3,
                      font: "600 9px/1 var(--mono)",
                      letterSpacing: ".08em",
                      textTransform: "uppercase",
                      color: "var(--ink3)",
                    }}
                  >
                    {hit.kind}
                  </span>
                  <span style={{ display: "block", font: "600 14px/1.25 'Inter'", color: "var(--ink)" }}>
                    {hit.title}
                  </span>
                  <span style={{ display: "block", marginTop: 2, font: "400 12px/1.3 'Inter'", color: "var(--ink2)" }}>
                    {hit.subtitle}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
