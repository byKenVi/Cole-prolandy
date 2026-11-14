import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

/** Shared building blocks for the contractor experience (see app/pro.css). */

export function Wordmark({ href = "/dashboard", pro = true }: { href?: string | null; pro?: boolean }) {
  const inner = (
    <>
      <span className="pro-wordmark-script">Landys</span>
      {pro && <span className="pro-wordmark-badge">PRO</span>}
    </>
  );
  if (!href) return <span className="pro-wordmark" aria-label="Landy's Pro">{inner}</span>;
  return (
    <Link href={href} className="pro-wordmark" aria-label="Landy's Pro home">
      {inner}
    </Link>
  );
}

export function PageHead({
  title,
  intro,
  back,
}: {
  title: ReactNode;
  intro?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="pro-head">
      {back && (
        <Link href={back.href} className="pro-back">
          <ChevronLeft size={22} strokeWidth={2.2} aria-hidden />
          {back.label}
        </Link>
      )}
      <h1 className="pro-title">{title}</h1>
      {intro && <p className="pro-intro">{intro}</p>}
    </header>
  );
}

export function Section({
  title,
  link,
  children,
}: {
  title: string;
  link?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className="pro-section">
      <div className="pro-section-head">
        <h2 className="pro-section-title">{title}</h2>
        {link && (
          <Link href={link.href} className="pro-link">
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** The perforation between a ticket's place and its details. */
export function Perforation() {
  return (
    <div className="pro-perf" aria-hidden>
      <i />
    </div>
  );
}

export type Fact = { label: string; value: ReactNode };

export function Facts({ items }: { items: Fact[] }) {
  const visible = items.filter((item) => item.value !== null && item.value !== undefined && item.value !== "");
  if (visible.length === 0) return null;
  return (
    <dl className="pro-facts">
      {visible.map((item) => (
        <div key={item.label} style={{ display: "contents" }}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type Tone = "neutral" | "ok" | "warn" | "danger" | "copper";

export function Chip({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`pro-chip${tone === "neutral" ? "" : ` pro-chip--${tone}`}`}>{children}</span>;
}

export function Notice({
  tone = "neutral",
  title,
  children,
}: {
  tone?: Exclude<Tone, "copper">;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`pro-notice${tone === "neutral" ? "" : ` pro-notice--${tone}`}`} role={tone === "danger" ? "alert" : undefined}>
      {title && <strong>{title}</strong>}
      {children}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="pro-empty">
      <h3>{title}</h3>
      {children && <p style={{ margin: 0 }}>{children}</p>}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}

/** Full-width link styled as a button. */
export function LinkButton({
  href,
  children,
  variant = "primary",
  big,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "forest" | "secondary" | "quiet";
  big?: boolean;
}) {
  const isExternal = /^(tel:|sms:|mailto:|https?:)/.test(href);
  const className = `pro-btn pro-btn--${variant}${big ? " pro-btn--big" : ""}`;
  if (isExternal) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
