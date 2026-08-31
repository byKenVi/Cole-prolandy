/**
 * Presentation helpers for the admin UI — maps real enum values (lead status,
 * match status, tier) to the design model's chip colours. Pure display; no data
 * or money logic lives here.
 */
export type ChipStyle = { label: string; bg: string; fg: string };

export function leadStatusChip(status: string): ChipStyle {
  switch (status) {
    case "DISTRIBUTED":
      return { label: "Distributed", bg: "var(--posBg)", fg: "var(--pos)" };
    case "NEW":
      return { label: "New", bg: "var(--goldSoft)", fg: "var(--goldSoftFg)" };
    case "SOLD_OUT":
      return { label: "Filled", bg: "var(--chipBg)", fg: "var(--sageFg)" };
    case "EXPIRED":
      return { label: "Expired", bg: "var(--dangerBg)", fg: "var(--danger)" };
    case "CLOSED":
      return { label: "Closed", bg: "var(--chipBg)", fg: "var(--ink3)" };
    default:
      return { label: status, bg: "var(--chipBg)", fg: "var(--chipFg)" };
  }
}
