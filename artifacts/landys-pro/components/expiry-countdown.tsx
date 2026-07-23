"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type CountdownState = {
  text: string;
  urgent: boolean;
  expired: boolean;
};

function compute(expiresAt: Date): CountdownState {
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return { text: "Expired", urgent: false, expired: true };

  const urgent = ms < 60 * 60 * 1000; // < 1 hour
  const totalSecs = Math.floor(ms / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  let text: string;
  if (days >= 2) {
    text = `${days}d left`;
  } else if (days === 1) {
    text = `${hours + 24}h left`;
  } else if (hours >= 1) {
    text = `${hours}h ${mins}m left`;
  } else if (mins >= 1) {
    text = `${mins}m ${secs}s left`;
  } else {
    text = `${secs}s left`;
  }

  return { text, urgent, expired: false };
}

/**
 * Live expiry countdown that ticks every second.
 * variant="badge"     → small rounded pill (for lead cards)
 * variant="prominent" → pill with clock icon (for lead detail page)
 * variant="inline"    → plain text (for table cells)
 */
export function ExpiryCountdown({
  expiresAt,
  variant = "badge",
  className,
}: {
  expiresAt: Date | string;
  variant?: "badge" | "prominent" | "inline";
  className?: string;
}) {
  const date = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const [state, setState] = useState<CountdownState>(() => compute(date));

  useEffect(() => {
    const tick = () => setState(compute(date));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [date]);

  if (variant === "inline") {
    return (
      <span
        className={cn(
          "text-[13px] font-medium",
          state.expired
            ? "text-[#9A3B2E]"
            : state.urgent
              ? "text-[#D97706]"
              : "text-[#8A7E68]",
          className,
        )}
      >
        {state.text}
      </span>
    );
  }

  if (variant === "prominent") {
    return (
      <span
        className={cn(
          "flex items-center gap-1.5 rounded-full px-[13px] py-2 text-[13px] font-medium",
          state.expired
            ? "bg-[#F6E4E1] text-[#9A3B2E]"
            : state.urgent
              ? "bg-[#FEF3C7] text-[#92400E]"
              : "bg-[#F0EADD] text-[#6B6459]",
          className,
        )}
      >
        <Clock
          className={cn(
            "h-3.5 w-3.5 flex-none",
            state.expired
              ? "text-[#9A3B2E]"
              : state.urgent
                ? "text-[#D97706]"
                : "text-[#8A7E68]",
          )}
          strokeWidth={1.8}
          aria-hidden
        />
        {state.text}
      </span>
    );
  }

  // badge
  return (
    <span
      className={cn(
        "flex-none whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium",
        state.expired
          ? "bg-[#F6E4E1] text-[#9A3B2E]"
          : state.urgent
            ? "bg-[#FEF3C7] text-[#92400E]"
            : "bg-[#F5EEDF] text-[#8A7E68]",
        className,
      )}
    >
      {state.text}
    </span>
  );
}
