/**
 * The `?topup=` status shared by the server pages that read it and the client
 * banner that renders it.
 *
 * It lives here, and not next to the banner, because a `"use client"` module
 * exports components to the server — not plain functions. Importing this parser
 * from a server component when it sat in the banner file threw at request time
 * ("attempted to call parseTopUpStatus() from the server"), which typechecking
 * and the build do not catch.
 */
export type TopUpStatus = "success" | "pending" | "card_saved" | "card_pending" | "error";

const TOPUP_STATUSES: readonly TopUpStatus[] = [
  "success",
  "pending",
  "card_saved",
  "card_pending",
  "error",
];

/** Narrow an untrusted `?topup=` query value to a known status, or null. */
export function parseTopUpStatus(value: string | undefined | null): TopUpStatus | null {
  return TOPUP_STATUSES.find((s) => s === value) ?? null;
}
