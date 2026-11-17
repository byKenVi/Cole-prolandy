import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do NOT bake NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY from CLERK_PUBLISHABLE_KEY
  // here. The `env` block is evaluated at BUILD time, and Replit only injects
  // production secrets (pk_live_...) at RUNTIME — so baking produces pk_test_...
  // in the production bundle, causing the "development keys" warning.
  //
  // @clerk/nextjs reads CLERK_PUBLISHABLE_KEY server-side at request time and
  // propagates it to the client through React SSR context. The publishableKey
  // prop on ClerkProvider (in layout.tsx) is the correct channel; no NEXT_PUBLIC_
  // env var needs to be baked in.
  env: {
    // Disable Clerk's keyless-mode in dev. canUseKeyless=true (the default when
    // NODE_ENV=development) causes NextClientClerkProvider to call
    // detectKeylessEnvDriftAction() from inside useLayoutEffect without a
    // React.startTransition wrapper — a React 19 invariant violation that surfaces
    // as "Invalid hook call" + hydration failure on every page load.
    // Setting this to "true" makes KEYLESS_DISABLED=true → canUseKeyless=false,
    // which short-circuits the problematic code path entirely.
    NEXT_PUBLIC_CLERK_KEYLESS_DISABLED: "true",
    // Bake the Clerk FAPI proxy URL into the client bundle so Clerk JS routes
    // all FAPI calls through /api/__clerk in production.
    //
    // CLERK_PROXY_URL is a production env var (empty locally) so this bakes
    // "" in local builds (dev keys hit FAPI directly — correct) and
    // "https://<domain>/api/__clerk" in deployment builds (correct).
    //
    // Do NOT pass proxyUrl as a prop on ClerkProvider: @clerk/nextjs accesses
    // `window` at module load time when proxyUrl is provided, which causes
    // "window is not defined" crashes during static page prerendering.
    NEXT_PUBLIC_CLERK_PROXY_URL: process.env.CLERK_PROXY_URL ?? "",
  },
  // Strict mode double-invocation in dev triggers "Invalid hook call" from
  // @clerk/clerk-react's module-level `typeof window` check (which evaluates
  // differently between server and client webpack bundles). Strict mode adds
  // no value on top of what TypeScript + ESLint already catch, and it causes
  // real runtime crashes in development that mislead debugging.
  reactStrictMode: false,
  eslint: {
    // Lint is part of the build: a lint error stops a broken deploy.
    ignoreDuringBuilds: false,
  },
  // Allow Replit's proxied preview origins so Next.js doesn't warn about
  // cross-origin /_next/* requests in the iframe preview.
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.replit.dev", "*.worf.replit.dev"],
  // Logo upload allows up to 2 MB; default Server Action body cap is 1 MB.
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
  poweredByHeader: false,
  async headers() {
    // Only "/", "/terms" and "/privacy" may appear in Google. Every other page is
    // private (account pages, admin, and links carrying a personal token), so it
    // gets a noindex header even if a link to it leaks somewhere public.
    const noindex = { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" };
    const noFraming = { key: "X-Frame-Options", value: "DENY" };
    const privatePages = [
      "/accept/:path*",
      "/follow-up/:path*",
      "/admin/:path*",
      "/dashboard/:path*",
      "/opportunities/:path*",
      "/jobs/:path*",
      "/fees/:path*",
      "/profile/:path*",
      "/home/:path*",
      "/leads/:path*",
      "/wallet/:path*",
      "/sign-in/:path*",
      "/sign-up/:path*",
      "/post-auth/:path*",
      "/deactivated/:path*",
      "/dev/:path*",
      "/storage/:path*",
      "/api/:path*",
    ];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      ...privatePages.map((source) => ({ source, headers: [noindex, noFraming] })),
      // The public estimate form may be embedded in landys.co, so it is only noindexed.
      { source: "/estimate/:path*", headers: [noindex] },
    ];
  },
};

export default nextConfig;
