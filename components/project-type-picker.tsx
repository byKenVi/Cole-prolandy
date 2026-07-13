"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, Search } from "lucide-react";
import { ProjectIcon } from "@/components/project-icon";
import { cn } from "@/lib/utils";

export type ProjectTypeOption = {
  id: string;
  name: string;
  contractorTypeName: string;
  icon?: string | null;
};

type Category = {
  name: string;
  icon?: string | null;
  projects: ProjectTypeOption[];
};

function groupByCategory(projectTypes: ProjectTypeOption[]): Category[] {
  const map = new Map<string, Category>();
  for (const p of projectTypes) {
    const existing = map.get(p.contractorTypeName);
    if (existing) {
      existing.projects.push(p);
      if (!existing.icon && p.icon) existing.icon = p.icon;
    } else {
      map.set(p.contractorTypeName, {
        name: p.contractorTypeName,
        icon: p.icon ?? null,
        projects: [p],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Two-step project type picker: category → specific project, with search.
 * Replaces long flat "Category — Project" selects.
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
  const categories = useMemo(() => groupByCategory(projectTypes), [projectTypes]);
  const selected = projectTypes.find((p) => p.id === value) ?? null;

  const [query, setQuery] = useState("");
  const [categoryName, setCategoryName] = useState<string | null>(
    () => selected?.contractorTypeName ?? null,
  );

  const activeCategory =
    categories.find((c) => c.name === categoryName) ??
    (selected ? categories.find((c) => c.name === selected.contractorTypeName) : null) ??
    null;

  const normalizedQuery = query.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    return projectTypes.filter(
      (p) =>
        p.name.toLowerCase().includes(normalizedQuery) ||
        p.contractorTypeName.toLowerCase().includes(normalizedQuery),
    );
  }, [isSearching, normalizedQuery, projectTypes]);

  const showCategories = !isSearching && !activeCategory;
  const showProjects = !isSearching && Boolean(activeCategory);

  const tilePad = density === "compact" ? "p-3" : "p-4";
  const gridCols =
    density === "compact"
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
      : "grid-cols-2 sm:grid-cols-3";

  function pickProject(id: string) {
    onChange(id);
    const p = projectTypes.find((x) => x.id === id);
    if (p) setCategoryName(p.contractorTypeName);
    setQuery("");
  }

  function backToCategories() {
    setCategoryName(null);
    setQuery("");
  }

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
          placeholder="Search services…"
          className={cn(
            "w-full rounded-md border border-border bg-surface pl-9 pr-3 font-inter text-text",
            "placeholder:text-text-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
            density === "compact" ? "h-11 text-base" : "h-12 text-base",
          )}
          aria-label="Search project types"
        />
      </div>

      {selected && !isSearching && (
        <div className="flex items-center gap-3 rounded-md border border-accent/40 bg-accent/5 px-3 py-2.5">
          <ProjectIcon
            icon={selected.icon}
            category={selected.contractorTypeName}
            project={selected.name}
            size="sm"
          />
          <div className="min-w-0 flex-1 font-inter text-sm">
            <p className="truncate font-medium text-text">{selected.name}</p>
            <p className="truncate text-text-muted">{selected.contractorTypeName}</p>
          </div>
          <button
            type="button"
            onClick={backToCategories}
            className="shrink-0 rounded-md px-2 py-1 font-inter text-sm font-medium text-accent hover:bg-accent/10"
          >
            Change
          </button>
        </div>
      )}

      {isSearching && (
        <div className="flex flex-col gap-2" role="listbox" aria-label="Search results">
          {searchResults.length === 0 ? (
            <p className="rounded-md border border-border bg-surface px-4 py-6 text-center font-inter text-sm text-text-muted">
              No services match “{query.trim()}”.
            </p>
          ) : (
            searchResults.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                selected={p.id === value}
                onSelect={() => pickProject(p.id)}
                showCategory
              />
            ))
          )}
        </div>
      )}

      {showCategories && (
        <fieldset>
          <legend className="mb-2 font-inter text-sm font-medium text-text-muted">
            1. Choose a category
          </legend>
          <div className={cn("grid gap-3", gridCols)}>
            {categories.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setCategoryName(c.name)}
                className={cn(
                  "group flex flex-col items-center gap-2 rounded-md border border-border bg-surface text-center transition-all",
                  "hover:border-accent/60 hover:bg-primary-soft/40",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
                  tilePad,
                )}
              >
                <ProjectIcon
                  icon={c.icon}
                  category={c.name}
                  size={density === "compact" ? "md" : "lg"}
                  className="transition-transform group-hover:scale-105"
                />
                <span className="font-inter text-sm font-medium leading-tight text-text">
                  {c.name}
                </span>
                <span className="font-inter text-xs text-text-muted">
                  {c.projects.length} service{c.projects.length === 1 ? "" : "s"}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {showProjects && activeCategory && (
        <fieldset>
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={backToCategories}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-inter text-sm font-medium text-text-muted hover:bg-primary-soft hover:text-text"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Categories
            </button>
            <span className="font-inter text-sm font-medium text-text">{activeCategory.name}</span>
          </div>
          <legend className="sr-only">Choose a project in {activeCategory.name}</legend>
          <div className={cn("grid gap-3", gridCols)}>
            {activeCategory.projects.map((p) => {
              const isSelected = p.id === value;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => pickProject(p.id)}
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
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}

function ProjectRow({
  project,
  selected,
  onSelect,
  showCategory,
}: {
  project: ProjectTypeOption;
  selected: boolean;
  onSelect: () => void;
  showCategory?: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-md border bg-surface px-3 py-2.5 text-left transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
        selected
          ? "border-accent bg-accent/5 ring-1 ring-accent"
          : "border-border hover:border-accent/60 hover:bg-primary-soft/40",
      )}
    >
      <ProjectIcon
        icon={project.icon}
        category={project.contractorTypeName}
        project={project.name}
        size="sm"
      />
      <div className="min-w-0 flex-1 font-inter text-sm">
        <p className="truncate font-medium text-text">{project.name}</p>
        {showCategory && (
          <p className="truncate text-text-muted">{project.contractorTypeName}</p>
        )}
      </div>
      {selected && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Check className="h-3.5 w-3.5" aria-hidden />
        </span>
      )}
    </button>
  );
}
