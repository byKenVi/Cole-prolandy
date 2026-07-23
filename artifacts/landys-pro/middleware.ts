import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";

/**
 * Auth middleware, gated by AUTH_MODE.
 * - dev mode: pass-through (no Clerk keys required).
 * - clerk mode: protect everything except the public routes below. The
 *   tokenized SMS accept flow and the public estimate form stay open.
 *
 * IMPORTANT: middleware inlines env at compile time. After changing AUTH_MODE
 * (or Clerk keys), you MUST fully restart the dev server — a hot .env reload
 * updates Server Components but NOT this middleware, which mismatches and throws
 * "auth() was called but Clerk can't detect usage of clerkMiddleware()".
 */
// Mirror the authMode() guard: only run Clerk middleware when a publishable key
// is present. Without it Clerk uses keyless mode which fails in proxied envs.
// CLERK_PUBLISHABLE_KEY = Replit-managed; NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = manual.
const isClerk =
  process.env.AUTH_MODE === "clerk" &&
  !!(process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const isPublicRoute = createRouteMatcher([
  "/",
  "/estimate",
  "/accept(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/deactivated",
  // /post-auth is the landing page immediately after Clerk completes auth
  // (magic link, OAuth, password). It must be public so Clerk JS can exchange
  // the session ticket client-side before any server-side auth.protect() fires.
  // The page itself redirects unauthenticated visitors to /sign-in.
  "/post-auth",
  "/api/estimate",
  "/api/stripe/webhook",
  "/api/cron/expire-leads",
]);

// Explicitly supply publishableKey so the middleware always uses the same Clerk
// tenant as CLERK_SECRET_KEY. Without this, clerkMiddleware auto-reads
// NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY which may still hold an old personal key
// (from a stale Replit secret), causing a tenant mismatch → every auth check fails.
//
// proxyUrl routes Clerk FAPI calls through /api/__clerk in production.
// Empty in dev (intentional — dev keys hit FAPI directly).
const clerkHandler = clerkMiddleware(
  async (auth, req) => {
    if (!isPublicRoute(req)) {
      await auth.protect();
    }
  },
  {
    publishableKey:
      process.env.CLERK_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    proxyUrl: process.env.CLERK_PROXY_URL || undefined,
  },
);

export default function middleware(req: NextRequest, ev: NextFetchEvent) {
  if (!isClerk) return NextResponse.next();
  return clerkHandler(req, ev);
}

export const config = {
  matcher: [
    // Skip Next internals and static files; run on everything else + APIs.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
