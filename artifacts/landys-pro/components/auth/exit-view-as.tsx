"use client";

import { useTransition } from "react";
import { exitViewAs } from "@/app/actions/dev";

/**
 * Exit control while admin is viewing as a contractor.
 * Sidebar: sits under the wallet card. Mobile: compact header control.
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
          ? "shrink-0 rounded-md border border-[#B42318] bg-[#D92D20] px-2.5 py-1.5 text-[13px] font-semibold text-white disabled:opacity-60"
          : "mt-3 flex w-full items-center justify-center gap-2 rounded-[12px] border border-[#B42318] bg-[#D92D20] px-3 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#B42318] disabled:opacity-60"
      }
    >
      {pending ? "…" : isMobile ? "Exit" : "Exit view as"}
    </button>
  );
}
