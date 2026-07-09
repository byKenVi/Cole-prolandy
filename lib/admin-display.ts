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
    case "EXPIRED":
      return { label: "Expired", bg: "var(--dangerBg)", fg: "var(--danger)" };
    case "CLOSED":
      return { label: "Closed", bg: "var(--chipBg)", fg: "var(--ink3)" };
    default:
      return { label: status, bg: "var(--chipBg)", fg: "var(--chipFg)" };
  }
}

export function matchStatusChip(status: string): ChipStyle {
  switch (status) {
    case "ACCEPTED":
      return { label: "Accepted", bg: "var(--posBg)", fg: "var(--pos)" };
    case "PENDING":
      return { label: "Pending", bg: "var(--goldSoft)", fg: "var(--goldSoftFg)" };
    case "DECLINED":
      return { label: "Passed", bg: "var(--chipBg)", fg: "var(--ink3)" };
    case "EXPIRED":
      return { label: "Expired", bg: "var(--dangerBg)", fg: "var(--danger)" };
    default:
      return { label: status, bg: "var(--chipBg)", fg: "var(--chipFg)" };
  }
}

/** Tier chip colours (hardcoded warm tones, as in the design model). */
export function tierChip(tier: number): ChipStyle {
  switch (tier) {
    case 2:
      return { label: "Tier 2", bg: "#F4E6CE", fg: "#8A5A1E" };
    case 3:
      return { label: "Tier 3", bg: "#EFD8C4", fg: "#7A3E1E" };
    default:
      return { label: "Tier 1", bg: "var(--chipBg)", fg: "var(--chipFg)" };
  }
}
