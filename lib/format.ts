export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** Human "expires in" string; returns "Expired" when past. */
export function timeUntil(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / (3600 * 1000));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `Expires in ${days} day${days > 1 ? "s" : ""}`;
  }
  if (hours >= 1) return `Expires in ${hours}h`;
  const mins = Math.max(1, Math.floor(ms / (60 * 1000)));
  return `Expires in ${mins}m`;
}
