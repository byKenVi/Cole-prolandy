/**
 * Minimal in-memory sliding-window rate limiter for the public estimate form.
 * Note: per-instance only (resets on redeploy, not shared across serverless
 * instances). Enabled via FORM_SPAM_PROTECTION (forced ON in production).
 *
 * PRODUCTION RECOMMENDATION: this counter is per-process, so on a multi-instance
 * / serverless deployment each instance keeps its own window and the effective
 * limit scales with instance count. For real multi-instance protection, back
 * this with a SHARED store (e.g. Upstash/Redis) behind this same function
 * signature. Not wired here yet (avoids adding a Redis dependency).
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
