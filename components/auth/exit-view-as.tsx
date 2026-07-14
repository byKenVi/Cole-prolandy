"use client";

import { useTransition } from "react";
import { exitViewAs } from "@/app/actions/dev";

/**
 * Compact Exit control while admin is viewing as a contractor.
 * Lives inside the sidebar / mobile header — no standalone strip.
 */
export function ExitViewAsButton({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "mobile";
}) {
  const [pending, startTransition] = useTransition();
  const isMobile = variant === "mobile";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => exitViewAs())}
      aria-label="Exit view-as contractor mode"
      className={
        isMobile
          ? "shrink-0 rounded-md border border-[#C0803C] bg-[#C0803C] px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white disabled:opacity-60"
          : "mt-3 flex w-full items-center justify-center gap-2 rounded-[12px] border border-[#C0803C]/55 bg-[#C0803C]/18 px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#E0A95C] transition-colors hover:bg-[#C0803C]/28 disabled:opacity-60"
      }
    >
      {pending ? "…" : isMobile ? "Exit" : "Exit view as"}
    </button>
  );
}
