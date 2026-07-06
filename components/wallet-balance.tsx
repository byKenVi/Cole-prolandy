import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Wallet balance display. Never relies on color alone — pairs a label with the
 * semantic color (DESIGN.md §3). `lowThresholdCents` marks a low balance.
 */
export function WalletBalance({
  cents,
  lowThresholdCents = 5000,
  size = "lg",
}: {
  cents: number;
  lowThresholdCents?: number;
  size?: "lg" | "md";
}) {
  const empty = cents <= 0;
  const low = !empty && cents < lowThresholdCents;
  return (
    <div>
      <p
        className={cn(
          "font-semibold tabular-nums",
          size === "lg" ? "text-2xl" : "text-xl",
          empty ? "text-danger" : low ? "text-warning" : "text-text",
        )}
      >
        {formatMoney(cents)}
      </p>
      {empty && <p className="text-sm font-medium text-danger">Empty — add funds to accept leads</p>}
      {low && <p className="text-sm font-medium text-warning">Low balance</p>}
    </div>
  );
}
