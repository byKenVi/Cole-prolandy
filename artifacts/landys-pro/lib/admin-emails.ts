/**
 * Parse ADMIN_EMAILS-style lists. Strips wrapping quotes (common when values are
 * copy-pasted into a secrets UI) and normalizes case/whitespace. Pure: safe to
 * import anywhere (no server-only dependencies).
 */
export function parseAdminEmails(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .split(",")
    .map((e) => e.trim().toLowerCase().replace(/^["']|["']$/g, ""))
    .filter((e) => e.includes("@"));
}
