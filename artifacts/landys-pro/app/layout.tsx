/* eslint-disable @next/next/no-page-custom-font -- root App Router layout loads fonts globally */
import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { DevBar } from "@/components/dev/dev-bar";
import { authMode } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Landy's Pro",
  description: "Land-service leads for contractors. Simple for the pro, premium for the brand.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2F4A3C",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const clerk = authMode() === "clerk";
  const tree = (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800;900&family=Caveat:wght@600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&family=Great+Vibes&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        {!clerk && <DevBar />}
        {children}
      </body>
    </html>
  );

  // Only mount ClerkProvider in clerk mode so the app runs with no keys in dev.
  // Keep fallback redirects on /post-auth so role routing (admin → /admin) always runs.
  //
  // Explicitly supply publishableKey so server and client always agree on the same
  // Clerk tenant. Without this, ClerkProvider falls back to reading
  // NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY from process.env, which may still hold an old
  // personal key while CLERK_SECRET_KEY was replaced by the Replit-managed tenant —
  // mismatched keys cause SSR/client hydration errors and "Invalid hook call" crashes.
  //
  // Priority: CLERK_PUBLISHABLE_KEY (Replit-managed) → NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  // (manually supplied fallback). Both env vars are available server-side.
  const publishableKey =
    process.env.CLERK_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    "";

  // proxyUrl is intentionally omitted here. @clerk/nextjs accesses `window`
  // at module load time when proxyUrl is supplied as a prop, which crashes
  // static page prerendering with "window is not defined". Instead the proxy
  // URL is baked into the bundle as NEXT_PUBLIC_CLERK_PROXY_URL via
  // next.config.ts — Clerk reads it automatically on the client side.

  return clerk ? (
    <ClerkProvider
      publishableKey={publishableKey}
      signInFallbackRedirectUrl="/post-auth"
      signUpFallbackRedirectUrl="/post-auth"
      signInForceRedirectUrl="/post-auth"
      signUpForceRedirectUrl="/post-auth"
    >
      {tree}
    </ClerkProvider>
  ) : (
    tree
  );
}
