import { SignUp } from "@clerk/nextjs";
import { authMode } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-logo";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { ShieldCheck, Zap, Star } from "lucide-react";

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: "Verified leads only" },
  { icon: Zap, label: "Instant job notifications" },
  { icon: Star, label: "No subscription required" },
];

export default function SignUpPage() {
  if (authMode() !== "clerk") {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-base text-text-muted">
          Auth is in dev mode. Set <code>AUTH_MODE=clerk</code> and add Clerk keys to enable
          sign-up.
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
          <BrandLogo className="h-9 brightness-0 invert" priority />
        </div>

        {/* Middle */}
        <div className="space-y-8">
          <div>
            <h1 className="font-display text-4xl font-bold leading-tight text-white">
              Get started
              <br />
              in minutes.
            </h1>
            <p className="mt-4 text-base text-white/70 leading-relaxed">
              Create your contractor account and start receiving quality landscape leads in your
              area.
            </p>
          </div>

          <ul className="space-y-4">
            {TRUST_ITEMS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm text-white/85">{label}</span>
              </li>
            ))}
          </ul>
        </div>

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
          {/* Page heading — only shown on mobile */}
          <div className="mb-6 lg:hidden">
            <h2 className="font-display text-xl font-semibold text-text">Create your account</h2>
            <p className="mt-1 text-sm text-text-muted">Join Landy&apos;s Pro as a contractor</p>
          </div>

          <SignUp
            appearance={clerkAppearance}
            forceRedirectUrl="/post-auth"
            fallbackRedirectUrl="/post-auth"
          />
        </div>

        <p className="mt-6 text-xs text-text-muted">
          Already have an account?{" "}
          <a
            href="/sign-in"
            className="font-medium text-accent hover:text-accent-hover underline underline-offset-2"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
