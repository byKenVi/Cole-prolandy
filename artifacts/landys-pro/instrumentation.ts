import { assertAuthConfigFailClosed } from "@/lib/auth";

/**
 * Next.js server-startup hook. Runs once when the server boots (Node runtime).
 * We use it as a fail-closed gate: refuse to start in production unless real
 * Clerk auth is configured, so the app can never boot with insecure dev auth.
 */
export function register() {
  assertAuthConfigFailClosed();
}
