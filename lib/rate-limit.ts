/**
 * Minimal in-memory sliding-window rate limiter for the public estimate form.
 * Note: per-instance only (resets on redeploy, not shared across serverless
 * instances). For production hardening, swap for Upstash/Redis behind this same
 * function. Enabled via FORM_SPAM_PROTECTION.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return false; // blocked
  }
  arr.push(now);
  hits.set(key, arr);
  return true; // allowed
}
