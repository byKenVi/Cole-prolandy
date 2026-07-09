import * as React from "react";
import Link from "next/link";
import Image from "next/image";

/**
 * Shared admin design primitives — the pixel-perfect building blocks used across
 * every admin screen. They render with the admin CSS-variable tokens (var(--card)
 * etc.) defined in globals.css, so a single implementation works in both the
 * light and dark themes. Purely presentational (no hooks) so they can render on
 * the server.
 */

/** Big rounded panel (a section container). */
export function Panel({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 18,
        boxShadow: "var(--shadow)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Screen title + subtitle + optional right-aligned action (e.g. New lead). */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 20,
        marginBottom: 24,
      }}
    >
      <div>
        <h1
          className="font-fraunces"
          style={{
            fontWeight: 600,
            fontSize: 34,
            letterSpacing: "-.01em",
            margin: 0,
            color: "var(--ink)",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: "7px 0 0", color: "var(--ink2)", fontSize: 15 }}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Primary gold action rendered as a Next link (the "+ New …" buttons). */
export function GoldButtonLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="a-gold"
      style={{
        flex: "none",
        height: 44,
        padding: "0 20px",
        background: "var(--gold)",
        color: "#fff",
        border: "none",
        borderRadius: 12,
        font: "600 15px/1 'Inter'",
        cursor: "pointer",
        boxShadow: "0 8px 18px rgba(192,128,60,.28)",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        textDecoration: "none",
      }}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      {children}
    </Link>
  );
}

/** Small rounded pill / chip. */
export function Chip({
  children,
  bg,
  fg,
  dot,
}: {
  children: React.ReactNode;
  bg: string;
  fg: string;
  dot?: boolean;
}) {
  return (
    <span
      style={{
        font: "500 11px/1 'Inter'",
        color: fg,
        background: bg,
        padding: dot ? "6px 11px" : "6px 10px",
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
      }}
    >
      {dot && (
        <span
          style={{ width: 6, height: 6, borderRadius: 999, background: fg, display: "inline-block" }}
        />
      )}
      {children}
    </span>
  );
}

/** Plain KPI card (white surface, uppercase label, big number, sub line). */
export function StatCard({
  label,
  value,
  sub,
  valueColor = "var(--ink)",
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div
      className="a-lift"
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "16px 18px",
        boxShadow: "var(--shadow)",
      }}
    >
      <p
        style={{
          margin: "0 0 8px",
          font: "600 11px/1 'Inter'",
          letterSpacing: ".05em",
          textTransform: "uppercase",
          color: "var(--ink3)",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          font: "600 24px/1 'Inter'",
          color: valueColor,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ margin: "8px 0 0", font: "500 12px/1.3 'Inter'", color: "var(--ink2)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/** Rounded square icon tile with graceful fallback glyph when no icon. */
export function IconTile({
  src,
  alt = "",
  size = 44,
  imgSize = 26,
  radius = 12,
}: {
  src: string | null;
  alt?: string;
  size?: number;
  imgSize?: number;
  radius?: number;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "var(--card2)",
        border: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
      }}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={imgSize}
          height={imgSize}
          style={{ objectFit: "contain" }}
        />
      ) : (
        <svg
          width={imgSize - 4}
          height={imgSize - 4}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink3)"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <path d="M8 12h8M12 8v8" />
        </svg>
      )}
    </span>
  );
}
