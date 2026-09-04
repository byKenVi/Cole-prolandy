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

/** Small gold monospace kicker shown above a screen title. */
export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: "0 0 8px",
        font: "600 12px/1 var(--mono)",
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: "var(--gold)",
      }}
    >
      {children}
    </p>
  );
}

/** Screen kicker + title + subtitle + optional right-aligned action (e.g. New lead). */
export function PageHeader({
  kicker,
  title,
  subtitle,
  action,
  titleSize = 34,
}: {
  kicker?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  titleSize?: number;
}) {
  return (
    <div
      className="admin-page-header"
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 20,
        marginBottom: 22,
      }}
    >
      <div style={{ minWidth: 0 }}>
        {kicker && <Kicker>{kicker}</Kicker>}
        <h1
          className="font-fraunces admin-page-title"
          style={{
            fontWeight: 600,
            // Upper bound only — .admin-page-title clamps this down on phones.
            "--admin-title-max": `${titleSize}px`,
            letterSpacing: "-.015em",
            margin: 0,
            color: "var(--ink)",
          } as React.CSSProperties}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: "9px 0 0", color: "var(--ink2)", fontSize: 15, lineHeight: 1.55 }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="admin-page-header-actions">{action}</div>}
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
          font: "600 11px/1 var(--mono)",
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
          font: "600 24px/1 var(--display)",
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
  src?: string | null;
  alt?: string;
  size?: number;
  imgSize?: number;
  radius?: number;
}) {
  const resolved = src || "/icons/fallback.png";
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
      <Image
        src={resolved}
        alt={alt}
        width={imgSize}
        height={imgSize}
        style={{ objectFit: "contain" }}
      />
    </span>
  );
}

/** Segmented tab control used on fees / confirmations / settings. */
export function AdminTabBar({
  children,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display: "flex",
        gap: 3,
        background: "var(--card2)",
        padding: 4,
        borderRadius: 12,
        marginBottom: 16,
        flexWrap: "wrap",
        width: "fit-content",
        maxWidth: "100%",
      }}
    >
      {children}
    </div>
  );
}

export function AdminTabLink({
  href,
  active,
  children,
  count,
  tone,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  count?: number;
  /** Optional accent for the active count pill. */
  tone?: "gold" | "danger" | "pos";
}) {
  const toneBg =
    tone === "danger" ? "var(--dangerBg)" : tone === "pos" ? "var(--posBg)" : "var(--goldSoft)";
  const toneFg =
    tone === "danger" ? "var(--danger)" : tone === "pos" ? "var(--pos)" : "var(--gold)";

  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        textDecoration: "none",
        border: "none",
        font: "600 13px/1 'Inter'",
        padding: "9px 15px",
        borderRadius: 9,
        background: active ? "var(--card)" : "transparent",
        color: active ? "var(--ink)" : "var(--ink2)",
        boxShadow: active ? "0 1px 3px rgba(58,53,45,.14)" : "none",
      }}
    >
      {children}
      {typeof count === "number" && (
        <span
          style={{
            font: "600 11px/1 var(--mono)",
            color: active ? toneFg : "var(--ink3)",
            background: active ? toneBg : "var(--chipBg)",
            padding: "3px 7px",
            borderRadius: 999,
          }}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

/** Strong empty state for admin list surfaces. */
export function AdminEmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "48px 28px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      {icon && (
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: "var(--card2)",
            border: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--ink3)",
            marginBottom: 4,
          }}
        >
          {icon}
        </div>
      )}
      <p style={{ margin: 0, font: "600 16px/1.35 'Inter'", color: "var(--ink)" }}>{title}</p>
      {description && (
        <p
          style={{
            margin: 0,
            maxWidth: 360,
            font: "400 14px/1.55 'Inter'",
            color: "var(--ink3)",
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
}
