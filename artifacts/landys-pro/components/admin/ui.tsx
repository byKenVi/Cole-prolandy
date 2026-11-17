import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ProjectGlyph } from "@/components/project-glyph";

/**
 * Shared admin design primitives used across every admin screen. They render
 * with the admin CSS-variable tokens (var(--card) etc.) defined in globals.css,
 * so a single implementation works in both the light and dark themes. Purely
 * presentational (no hooks) so they can render on the server.
 *
 * House rules: panels are separated by a 1px rule, never by a shadow or a
 * coloured side stripe; headings use the condensed face (var(--head)).
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
        borderRadius: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Short line above a screen title. Sentence case, same face as the UI. */
export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: "0 0 6px",
        font: "500 14px/1.35 var(--ui)",
        color: "var(--ink2)",
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
          className="font-head admin-page-title"
          style={{
            fontWeight: 700,
            // Upper bound only: .admin-page-title clamps this down on phones.
            "--admin-title-max": `${titleSize}px`,
            margin: 0,
            color: "var(--ink)",
          } as React.CSSProperties}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: "8px 0 0", maxWidth: "68ch", color: "var(--ink2)", fontSize: 16, lineHeight: 1.5 }}>
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
        height: 42,
        padding: "0 18px",
        background: "var(--gold)",
        color: "#fff",
        border: "none",
        borderRadius: 8,
        font: "600 15px/1 var(--ui)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        textDecoration: "none",
      }}
    >
      <Plus size={17} strokeWidth={2.4} aria-hidden />
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
        font: "500 13px/1 var(--ui)",
        color: fg,
        background: bg,
        padding: "5px 10px",
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

/** Plain KPI card (white surface, sentence-case label, big number, sub line). */
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
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: "16px 20px",
      }}
    >
      <p style={{ margin: 0, font: "500 14px/1.3 var(--ui)", color: "var(--ink2)" }}>{label}</p>
      <p style={{ margin: "8px 0 0", font: "700 28px/1 var(--head)", color: valueColor }}>{value}</p>
      {sub && <p style={{ margin: "6px 0 0", font: "400 13px/1.35 var(--ui)", color: "var(--ink3)" }}>{sub}</p>}
    </div>
  );
}

/** Square tile holding the line icon of a kind of work. */
export function IconTile({
  src,
  size = 44,
  imgSize,
  radius = 8,
}: {
  src?: string | null;
  alt?: string;
  size?: number;
  imgSize?: number;
  radius?: number;
}) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "var(--sage)",
        color: "var(--sageFg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
      }}
    >
      <ProjectGlyph src={src} size={imgSize ?? Math.round(size * 0.48)} />
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
        gap: 2,
        background: "var(--card2)",
        border: "1px solid var(--line)",
        padding: 3,
        borderRadius: 9,
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
        font: `${active ? 600 : 500} 14px/1 var(--ui)`,
        padding: "9px 14px",
        borderRadius: 7,
        background: active ? "var(--card)" : "transparent",
        color: active ? "var(--ink)" : "var(--ink2)",
        border: active ? "1px solid var(--line)" : "1px solid transparent",
      }}
    >
      {children}
      {typeof count === "number" && (
        <span
          style={{
            font: "600 12px/1 var(--ui)",
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
            width: 48,
            height: 48,
            borderRadius: 10,
            background: "var(--sage)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--sageFg)",
            marginBottom: 4,
          }}
        >
          {icon}
        </div>
      )}
      <p style={{ margin: 0, font: "600 18px/1.3 var(--head)", color: "var(--ink)" }}>{title}</p>
      {description && (
        <p
          style={{
            margin: 0,
            maxWidth: 360,
            font: "400 15px/1.5 var(--ui)",
            color: "var(--ink2)",
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
}
