import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { authMode } from "@/lib/auth";

const STEPS = [
  {
    img: "/icon-job-mono.png",
    title: "A local job comes in",
    body: "A landowner nearby posts the kind of work you do.",
  },
  {
    img: "/icon-text-mono.png",
    title: "We text you the details & price",
    body: "Job type, location, tier and the lead price — straight to your phone.",
  },
  {
    img: "/icon-accept-mono.png",
    title: "Accept the ones you want",
    body: "Tap accept, pay for that lead, and get the landowner's contact. Done.",
  },
];

export default function LandingPage() {
  const clerk = authMode() === "clerk";
  const signInHref = clerk ? "/sign-in" : "/home";
  const accessHref = clerk ? "/sign-up" : "/admin";

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
        {/* Nav */}
        <header className="flex items-center justify-between duration-700 animate-in fade-in slide-in-from-top-2">
          <BrandLogo className="h-8" priority />
          <nav className="flex items-center gap-3">
            <Link
              href="#how-it-works"
              className="hidden text-sm font-medium text-text-muted transition-colors hover:text-accent sm:inline"
            >
              How it works
            </Link>
            <Button asChild variant="outline" size="sm">
              <Link href={signInHref}>Sign in</Link>
            </Button>
          </nav>
        </header>

        {/* Hero */}
        <section className="grid items-center gap-10 py-12 md:grid-cols-2 md:py-16">
          <div className="flex flex-col gap-4 fill-mode-both duration-700 animate-in fade-in slide-in-from-bottom-4">
            <p className="font-script text-4xl leading-none text-accent">Finally</p>
            <h1 className="font-sans text-5xl font-black leading-[0.95] tracking-tight text-text sm:text-6xl">
              Land jobs, straight to your phone.
            </h1>
            <p className="mt-1 max-w-md text-base text-text-muted">
              Real local work comes to you by text. See the job and the price, and accept only the
              ones you want — no subscriptions, no chasing.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <Button asChild variant="accent" size="cta" className="w-auto">
                <Link href={signInHref}>Sign in</Link>
              </Button>
              <Link
                href={accessHref}
                className="group inline-flex items-center gap-1 text-sm font-semibold text-text transition-colors hover:text-accent"
              >
                Set up by the Landy&apos;s team? Get access
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-text-muted">
              <MapPin className="h-4 w-4" /> Built for local pros
            </p>
          </div>

          {/* 3D hero scene + floating sample lead card */}
          <div className="relative fill-mode-both delay-150 duration-700 animate-in fade-in slide-in-from-bottom-6">
            <Image
              src="/hero-3d-mono.png"
              alt="Landys 3D tractor on a plot of land"
              width={1024}
              height={768}
              priority
              className="mx-auto h-auto w-full max-w-lg animate-float drop-shadow-2xl"
            />
            <div className="absolute -bottom-2 left-2 w-56 rounded-md border border-border bg-surface p-3 shadow-lg animate-float-slow sm:left-6">
              <div className="flex items-center justify-between">
                <BrandLogo className="h-4" />
                <span className="rounded-full border border-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                  Example lead
                </span>
              </div>
              <p className="mt-2 text-xs text-text-muted">
                <span className="font-semibold text-text">Site Excavation</span> · Dripping Springs
              </p>
              <p className="text-lg font-black tabular-nums text-text">$110.00</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="rounded-lg bg-surface px-6 py-12 shadow-md sm:px-10"
        >
          <div className="text-center">
            <p className="font-script text-3xl text-accent">simple</p>
            <h2 className="font-sans text-4xl font-black tracking-tight text-text">
              How it works for pros
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              Three steps. No app to learn, no forms to fill.
            </p>
          </div>

          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {STEPS.map(({ img, title, body }, i) => (
              <div
                key={title}
                className="group flex flex-col items-center gap-3 text-center fill-mode-both duration-700 animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <Image
                  src={img}
                  alt=""
                  width={512}
                  height={512}
                  className="h-28 w-28 drop-shadow-xl transition-transform duration-300 group-hover:-translate-y-2 group-hover:scale-105"
                />
                <p className="font-script text-2xl text-accent">Step {i + 1}</p>
                <p className="text-lg font-black tracking-tight text-text">{title}</p>
                <p className="max-w-xs text-sm text-text-muted">{body}</p>
              </div>
            ))}
          </div>

          <p className="mt-12 text-center text-sm font-medium text-text-muted">
            No subscriptions · No monthly fees · Pay only for the jobs you accept
          </p>
        </section>

        {/* Footer */}
        <footer className="mt-10 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <BrandLogo className="h-6" />
            <p className="mt-1 text-xs text-text-muted">Land-service leads for local pros.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
            <Link href="/estimate" className="transition-colors hover:text-accent">
              Request an estimate
            </Link>
            <span>Privacy</span>
            <span>Terms</span>
            <span>© {new Date().getFullYear()} Landy&apos;s</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
