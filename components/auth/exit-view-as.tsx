"use client";

import { useTransition } from "react";
import { exitViewAs } from "@/app/actions/dev";

/** Compact banner while admin is viewing as a contractor. */
export function ExitViewAsBanner() {
  const [pending, startTransition] = useTransition();
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-1.5 text-[12px] text-white"
      style={{ background: "var(--color-primary, #2f4a3c)" }}
    >
      <span className="truncate font-medium opacity-90">Viewing as contractor</span>
      <button
        type="button"
        className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide disabled:opacity-60"
        disabled={pending}
        onClick={() => startTransition(() => exitViewAs())}
      >
        {pending ? "…" : "Exit"}
      </button>
    </div>
  );
}
