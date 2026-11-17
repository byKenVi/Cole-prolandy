import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import "./pro.css";
import { DevBar } from "@/components/dev/dev-bar";
import { ToastProvider } from "@/components/ui/toast";
import { authMode } from "@/lib/auth";
import { fontVariables } from "@/lib/fonts";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_TITLE, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
  robots: { index: true, follow: true },
  // Google Search Console "HTML tag" verification: set GOOGLE_SITE_VERIFICATION
  // (the content value only) in the Replit secrets, then redeploy.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
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
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#2C4A39",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const clerk = authMode() === "clerk";
  const tree = (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {!clerk && <DevBar />}
        <ToastProvider>{children}</ToastProvider>
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
