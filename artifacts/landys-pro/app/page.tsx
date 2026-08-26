import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { authMode } from "@/lib/auth";

const STEPS = [
  {
    img: "/icon-job-mono.png",
    title: "Landy's finds the opportunity",
    body: "A landowner nearby requests work that matches what you do.",
  },
  {
    img: "/icon-text-mono.png",
    title: "We connect you with the landowner",
    body: "See the job details and success-fee rate. Accept only the ones you want.",
  },
  {
    img: "/icon-accept-mono.png",
    title: "You win the work",
    body: "Complete the job. The landowner pays you directly — outside Landy's.",
  },
  {
    img: "/icon-job-mono.png",
    title: "You pay Landy's when you get paid",
    body: "After the landowner pays you, pay Landy's the applicable success fee. No lead fees. No subscription.",
  },
];

const PROMISES = [
  "No paying for leads",
  "No subscription",
  "Pay Landy's only when you get paid",
];

export default function LandingPage() {
  const clerk = authMode() === "clerk";
  const signInHref = clerk ? "/sign-in" : "/home";
  const accessHref = clerk ? "/sign-up" : "/admin";

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
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

        <section className="grid items-center gap-10 py-12 md:grid-cols-2 md:py-16">
          <div className="flex flex-col gap-4 fill-mode-both duration-700 animate-in fade-in slide-in-from-bottom-4">
            <p className="font-script text-4xl leading-none text-accent">More quality jobs</p>
            <h1 className="font-sans text-5xl font-black leading-[0.95] tracking-tight text-text sm:text-6xl">
              Less hassle.
            </h1>
            <p className="mt-1 max-w-md text-base leading-relaxed text-text-muted">
              Landy&apos;s Pro connects you with local landowners — by text and email. Accept the
              opportunities you want. Pay Landy&apos;s only after you&apos;ve been paid for the
              work.
            </p>
            <ul className="mt-2 space-y-2">
              {PROMISES.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm font-medium text-text">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-accent" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
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
              <MapPin className="h-4 w-4" /> Built for local land-service pros
            </p>
          </div>

          <div className="relative fill-mode-both delay-150 duration-700 animate-in fade-in slide-in-from-bottom-6">
            <Image
              src="/hero-3d-mono.png"
              alt="Landys 3D tractor on a plot of land"
              width={1024}
              height={768}
              priority
              className="mx-auto h-auto w-full max-w-lg animate-float drop-shadow-2xl"
            />
            <div className="absolute -bottom-2 left-2 w-60 rounded-md border border-border bg-surface p-3 shadow-lg animate-float-slow sm:left-6">
              <div className="flex items-center justify-between">
                <BrandLogo className="h-4" />
                <span className="rounded-full border border-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                  Example
                </span>
              </div>
              <p className="mt-2 text-xs text-text-muted">
                <span className="font-semibold text-text">Site Excavation</span> · Dripping Springs
              </p>
              <p className="text-sm font-semibold text-text">Est. $18,000 · 4% success fee</p>
              <p className="mt-1 text-[11px] text-text-muted">No upfront cost to accept</p>
            </div>
          </div>
        </section>

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
              Landy&apos;s does not process payment from the landowner to you. That happens
              directly between you and the landowner.
            </p>
          </div>

          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
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
                  className="h-24 w-24 drop-shadow-xl transition-transform duration-300 group-hover:-translate-y-2 group-hover:scale-105"
                />
                <p className="font-script text-2xl text-accent">Step {i + 1}</p>
                <p className="text-lg font-black tracking-tight text-text">{title}</p>
                <p className="max-w-xs text-sm leading-relaxed text-text-muted">{body}</p>
              </div>
            ))}
          </div>

          <p className="mt-12 text-center text-sm font-medium text-text-muted">
            No lead fees · No subscription · Success fee only after you get paid
          </p>
        </section>

        <footer className="mt-10 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <BrandLogo className="h-6" />
            <p className="mt-1 text-xs text-text-muted">
              Quality land-service opportunities for local pros.
            </p>
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
