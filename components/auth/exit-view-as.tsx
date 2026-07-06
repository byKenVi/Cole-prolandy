"use client";

import { useTransition } from "react";
import { exitViewAs } from "@/app/actions/dev";

export function ExitViewAsBanner() {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center justify-between gap-2 bg-primary px-4 py-2 text-xs text-white">
      <span>Viewing as contractor (admin)</span>
      <button
        className="rounded-full bg-accent px-3 py-1 font-medium disabled:opacity-60"
        disabled={pending}
        onClick={() => startTransition(() => exitViewAs())}
      >
        Exit
      </button>
    </div>
  );
}
