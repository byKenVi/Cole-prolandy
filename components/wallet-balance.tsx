import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Wallet balance display — money is the hero (DESIGN.md §3). The number
 * dominates; an optional small muted label sits above it. Never relies on color
 * alone — pairs the semantic color with a plain-language line. `lowThresholdCents`
 * marks a low balance.
 */
export function WalletBalance({
  cents,
  lowThresholdCents = 5000,
  size = "lg",
  label,
}: {
  cents: number;
  lowThresholdCents?: number;
  size?: "hero" | "lg" | "md";
  /** Small muted label rendered above the number (e.g. "Current balance"). */
  label?: string;
}) {
  const empty = cents <= 0;
  const low = !empty && cents < lowThresholdCents;
  const sizeClass = size === "hero" ? "text-3xl" : size === "lg" ? "text-2xl" : "text-xl";
  return (
    <div>
      {label && (
        <p className="mb-1 text-sm font-medium uppercase tracking-wide text-text-muted">{label}</p>
      )}
      <p
        className={cn(
          "font-semibold leading-tight tabular-nums",
          sizeClass,
          empty ? "text-danger" : low ? "text-warning" : "text-text",
        )}
      >
        {formatMoney(cents)}
      </p>
      {empty && (
        <p className="mt-1 text-sm font-medium text-danger">Empty — add funds to accept leads</p>
      )}
      {low && <p className="mt-1 text-sm font-medium text-warning">Low balance</p>}
    </div>
  );
}
