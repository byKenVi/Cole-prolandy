"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { ProjectIcon } from "@/components/project-icon";
import { cn } from "@/lib/utils";

export type ProjectTypeOption = {
  id: string;
  name: string;
  contractorTypeName: string;
  icon?: string | null;
};

/**
 * Flat project picker (Project → Tier hierarchy elsewhere).
 * Search + grid of projects — no nested category step.
 */
export function ProjectTypePicker({
  projectTypes,
  value,
  onChange,
  density = "comfortable",
  id,
}: {
  projectTypes: ProjectTypeOption[];
  value: string;
  onChange: (projectTypeId: string) => void;
  density?: "comfortable" | "compact";
  id?: string;
}) {
  const [query, setQuery] = useState("");
  const selected = projectTypes.find((p) => p.id === value) ?? null;

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) return projectTypes;
    return projectTypes.filter((p) => p.name.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery, projectTypes]);

  const tilePad = density === "compact" ? "p-3" : "p-4";
  const gridCols =
    density === "compact"
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
      : "grid-cols-2 sm:grid-cols-3";

  return (
    <div id={id} className="flex flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects…"
          className={cn(
            "w-full rounded-md border border-border bg-surface pl-9 pr-3 font-inter text-text",
            "placeholder:text-text-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
            density === "compact" ? "h-11 text-base" : "h-12 text-base",
          )}
          aria-label="Search projects"
        />
      </div>

      {selected && !normalizedQuery && (
        <div className="flex items-center gap-3 rounded-md border border-accent/40 bg-accent/5 px-3 py-2.5">
          <ProjectIcon
            icon={selected.icon}
            category={selected.contractorTypeName}
            project={selected.name}
            size="sm"
          />
          <div className="min-w-0 flex-1 font-inter text-sm">
            <p className="truncate font-medium text-text">{selected.name}</p>
            <p className="truncate text-text-muted">Project · 3 price tiers</p>
          </div>
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 rounded-md px-2 py-1 font-inter text-sm font-medium text-accent hover:bg-accent/10"
          >
            Change
          </button>
        </div>
      )}

      {(!selected || normalizedQuery) && (
        <div className={cn("grid gap-3", gridCols)} role="listbox" aria-label="Projects">
          {filtered.length === 0 ? (
            <p className="col-span-full rounded-md border border-border bg-surface px-4 py-6 text-center font-inter text-sm text-text-muted">
              No projects match “{query.trim()}”.
            </p>
          ) : (
            filtered.map((p) => {
              const isSelected = p.id === value;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-pressed={isSelected}
                  onClick={() => {
                    onChange(p.id);
                    setQuery("");
                  }}
                  className={cn(
                    "group relative flex flex-col items-center gap-2 rounded-md border bg-surface text-center transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
                    tilePad,
                    isSelected
                      ? "border-accent bg-accent/5 shadow-sm ring-1 ring-accent"
                      : "border-border hover:border-accent/60 hover:bg-primary-soft/40",
                  )}
                >
                  {isSelected && (
                    <span
                      className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground"
                      aria-hidden
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <ProjectIcon
                    icon={p.icon}
                    category={p.contractorTypeName}
                    project={p.name}
                    size={density === "compact" ? "md" : "lg"}
                    className="transition-transform group-hover:scale-105"
                  />
                  <span className="font-inter text-sm font-medium leading-tight text-text">
                    {p.name}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
