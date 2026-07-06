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
const isClerk = process.env.AUTH_MODE === "clerk";

const isPublicRoute = createRouteMatcher([
  "/",
  "/estimate",
  "/accept(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/estimate",
  "/api/stripe(.*)",
  "/api/cron(.*)",
]);

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

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
