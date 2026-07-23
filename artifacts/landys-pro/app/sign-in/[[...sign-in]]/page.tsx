import { SignIn } from "@clerk/nextjs";
import { authMode } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-logo";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { CheckCircle2 } from "lucide-react";

const FEATURE_BULLETS = [
  "New leads delivered straight to your inbox",
  "Accept jobs in one tap, no back-and-forth",
  "Wallet top-ups and payouts all in one place",
];

export default function SignInPage() {
  if (authMode() !== "clerk") {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-base text-text-muted">
          Auth is in dev mode. Set <code>AUTH_MODE=clerk</code> and add Clerk keys to enable
          sign-in.
        </p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FEFBF6]">
      {/* ── Left brand panel (hidden on small screens) ── */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col justify-between bg-primary px-12 py-14">
        {/* Top: logo */}
        <div>
          <div className="inline-flex items-center gap-2">
            <BrandLogo className="h-9 brightness-0 invert" priority />
          </div>
        </div>

        {/* Middle: tagline + bullets */}
        <div className="space-y-8">
          <div>
            <h1 className="font-display text-4xl font-bold leading-tight text-white">
              Land more jobs,
              <br />
              do less admin.
            </h1>
            <p className="mt-4 text-base text-white/70 leading-relaxed">
              The platform built for landscape contractors who want quality leads without the
              paperwork.
            </p>
          </div>

          <ul className="space-y-4">
            {FEATURE_BULLETS.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#8BBD9A]" />
                <span className="text-sm text-white/85 leading-snug">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom: decoration */}
        <p className="text-xs text-white/40">© {new Date().getFullYear()} Landy&apos;s Pro</p>
      </div>

      {/* ── Right auth panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 sm:px-10">
        {/* Mobile-only logo */}
        <div className="mb-8 lg:hidden">
          <BrandLogo className="h-9" priority />
        </div>

        {/* Outer card */}
        <div className="w-full max-w-[420px] rounded-2xl border border-border bg-surface p-8 shadow-md">
          {/* Page heading — only shown on mobile where the brand panel is hidden */}
          <div className="mb-6 lg:hidden">
            <h2 className="font-display text-xl font-semibold text-text">Welcome back</h2>
            <p className="mt-1 text-sm text-text-muted">Sign in to your contractor account</p>
          </div>

          <SignIn
            appearance={clerkAppearance}
            forceRedirectUrl="/post-auth"
            fallbackRedirectUrl="/post-auth"
          />
        </div>

        <p className="mt-6 text-xs text-text-muted">
          Don&apos;t have an account?{" "}
          <a href="/sign-up" className="font-medium text-accent hover:text-accent-hover underline underline-offset-2">
            Request access
          </a>
        </p>
      </div>
    </div>
  );
}
