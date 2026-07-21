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
    <html lang="en">
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
  return clerk ? (
    <ClerkProvider
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
