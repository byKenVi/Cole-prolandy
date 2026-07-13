"use client";

import { useEffect, useState } from "react";
import { SignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One-click sign-out for Clerk mode. Deferred until mount to avoid hydration
 * mismatch (same pattern as UserMenu).
 */
export function SignOutLink({
  className,
  label = "Sign out",
  variant = "sidebar",
}: {
  className?: string;
  label?: string;
  variant?: "sidebar" | "admin" | "icon" | "adminIcon";
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <span
        className={cn(
          variant === "icon" || variant === "adminIcon" ? "inline-block h-9 w-9" : "inline-block h-9 w-full",
          className,
        )}
        aria-hidden
      />
    );
  }

  const base =
    variant === "admin"
      ? "flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-[#B9D0BC] transition-colors hover:bg-white/10 hover:text-[#F1E7D6]"
      : variant === "adminIcon"
        ? "inline-flex h-8 w-8 items-center justify-center rounded-full text-[#B9D0BC] transition-colors hover:bg-white/10 hover:text-[#F1E7D6]"
      : variant === "icon"
        ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E3DAC9] bg-white text-[#5C5142] transition-colors hover:bg-[#F5EEDF]"
        : "flex w-full items-center justify-center gap-2 rounded-[12px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13px] font-semibold text-[#C8BFAE] transition-colors hover:bg-white/10 hover:text-[#F1E7D6]";

  return (
    <SignOutButton redirectUrl="/">
      <button type="button" className={cn(base, className)} aria-label={label} title={label}>
        <LogOut className="h-4 w-4 flex-none" strokeWidth={1.9} aria-hidden />
        {variant !== "icon" && variant !== "adminIcon" && <span>{label}</span>}
      </button>
    </SignOutButton>
  );
}
