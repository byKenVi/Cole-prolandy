import Link from "next/link";
import Image from "next/image";
import { MapPin, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { authMode } from "@/lib/auth";
import { publicEstimateFormEnabled } from "@/lib/public-estimate";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";

const STEPS = [
  {
    img: "/icon-job-mono.png",
    title: "A homeowner asks for an estimate",
    body: "A homeowner or landowner near you requests work on landys.co that matches what you do.",
  },
  {
    img: "/icon-text-mono.png",
    title: "You get a text and an email",
    body: "See the job, the budget and the success-fee rate. Accept only the ones you want, for free.",
  },
  {
    img: "/icon-accept-mono.png",
    title: "You win the work",
    body: "Call the homeowner, agree on the price and do the work. They pay you directly.",
  },
  {
    img: "/icon-job-mono.png",
    title: "You pay Landy's when you get paid",
    body: "After the homeowner pays you, pay Landy's the success fee. No lead fees. No subscription.",
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

  const base = siteUrl();
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://www.landys.co/#organization",
        name: "Landy's",
        url: "https://www.landys.co",
        logo: `${base}/landys-logo.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        name: SITE_NAME,
        url: base,
        publisher: { "@id": "https://www.landys.co/#organization" },
      },
      {
        "@type": "Service",
        name: SITE_NAME,
        serviceType: "Job requests for contractors",
        description: SITE_DESCRIPTION,
        provider: { "@id": "https://www.landys.co/#organization" },
        areaServed: { "@type": "Country", name: "United States" },
        url: base,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-bg">
      <script
        type="application/ld+json"
        // JSON-LD for Google rich results; "<" is escaped so the payload cannot close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <div className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between">
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
          <div className="flex flex-col gap-4">
            <h1 className="flex flex-col gap-3">
              <span className="font-script text-4xl leading-none text-accent">More quality jobs.</span>
              <span className="font-sans text-5xl font-black leading-[0.95] tracking-tight text-[#4A3E2D] sm:text-6xl">
                Less hassle.
              </span>
            </h1>
            <p className="mt-1 max-w-md text-lg leading-relaxed text-text-muted">
              Landy&apos;s Pro sends you estimate requests from homeowners and landowners near you,
              by text and email. Accept the jobs you want. Pay Landy&apos;s only after you&apos;ve
              been paid for the work.
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
                className="inline-flex items-center text-sm font-semibold text-text transition-colors hover:text-accent"
              >
                Set up by the Landy&apos;s team? Get access
              </Link>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-text-muted">
              <MapPin className="h-4 w-4" aria-hidden /> Built for local contractors and land-service pros
            </p>
          </div>

          <div className="relative">
            <Image
              src="/hero-3d-mono.png"
              alt="Illustration of a tractor working on a plot of land"
              width={1024}
              height={768}
              priority
              className="mx-auto h-auto w-full max-w-lg"
            />
            <div className="absolute -bottom-2 left-2 w-60 rounded-md border border-border bg-surface p-3 shadow-sm sm:left-6">
              <div className="flex items-center justify-between">
                <BrandLogo className="h-4" />
                <span className="rounded-full border border-accent px-2 py-0.5 text-[12px] font-medium text-accent">
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
            <h2 className="font-sans text-4xl font-black tracking-tight text-text">
              How it works for pros
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              Landy&apos;s does not handle the homeowner&apos;s payment to you. That happens
              directly between you and the homeowner.
            </p>
          </div>

          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ img, title, body }, i) => (
              <div
                key={title}
                className="flex flex-col items-center gap-3 text-center"
              >
                <Image
                  src={img}
                  alt=""
                  width={512}
                  height={512}
                  className="h-24 w-24"
                />
                <p className="text-sm font-semibold text-accent">Step {i + 1}</p>
                <p className="text-lg font-black tracking-tight text-text">{title}</p>
                <p className="max-w-xs text-sm leading-relaxed text-text-muted">{body}</p>
              </div>
            ))}
          </div>

          <p className="mt-12 text-center text-sm font-medium text-text-muted">
            No lead fees. No subscription. Success fee only after you get paid.
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
            {publicEstimateFormEnabled() ? (
              <Link href="/estimate" className="transition-colors hover:text-accent">
                Request an estimate
              </Link>
            ) : (
              <a href="https://www.landys.co" className="transition-colors hover:text-accent">
                landys.co
              </a>
            )}
            <Link href="/terms" className="transition-colors hover:text-accent">
              How the success fee works
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-accent">
              Privacy
            </Link>
            <span>© {new Date().getFullYear()} Landy&apos;s</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
