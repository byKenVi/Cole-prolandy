"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { AdminTheme } from "@/lib/admin-theme";
import { AdminThemeProvider, useAdminTheme } from "@/components/admin/theme-context";

/**
 * The admin application shell: a fixed dark sidebar, a sticky glass topbar with
 * the working light/dark toggle, and the themed main content area. Rebuilt to
 * match the client's design model pixel-for-pixel while staying wired to the
 * real Next routes/auth. The whole thing is the theme provider root, so the
 * topbar toggle and the Settings "Appearance" picker drive the same state.
 */

type NavItem = { href: string; label: string; icon: React.ReactNode; badge?: number };

function icon(path: React.ReactNode) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}

function navItems(leadCount: number): NavItem[] {
  return [
    {
      href: "/admin",
      label: "Dashboard",
      icon: icon(
        <>
          <rect x="3" y="3" width="8" height="8" rx="1.6" />
          <rect x="13" y="3" width="8" height="5" rx="1.6" />
          <rect x="13" y="11" width="8" height="10" rx="1.6" />
          <rect x="3" y="14" width="8" height="7" rx="1.6" />
        </>,
      ),
    },
    {
      href: "/admin/leads",
      label: "Leads",
      badge: leadCount,
      icon: icon(<path d="M4 6h16M4 12h16M4 18h10" />),
    },
    {
      href: "/admin/contractors",
      label: "Contractors",
      icon: icon(
        <>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3 20c.8-3.6 3.3-5 6-5s5.2 1.4 6 5" />
          <path d="M16 6.5a3 3 0 0 1 0 6M22 20c-.5-2.6-1.8-4-3.6-4.6" />
        </>,
      ),
    },
    {
      href: "/admin/finance",
      label: "Finance",
      icon: icon(
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M14.5 9.2c-.5-.9-1.5-1.4-2.7-1.4-1.6 0-2.6.8-2.6 2 0 2.8 5.6 1.4 5.6 4.3 0 1.3-1.1 2.1-2.9 2.1-1.4 0-2.5-.6-3-1.6M12 6.4v11.2" />
        </>,
      ),
    },
    {
      href: "/admin/pricing",
      label: "Pricing",
      icon: icon(
        <>
          <path d="M20 12l-8 8-9-9V4h7l10 8Z" />
          <circle cx="7.5" cy="7.5" r="1.4" fill="currentColor" stroke="none" />
        </>,
      ),
    },
    {
      href: "/admin/settings",
      label: "Settings",
      icon: icon(
        <>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 13a7.9 7.9 0 0 0 0-2l1.7-1.3-1.7-3-2 .8a7.6 7.6 0 0 0-1.7-1l-.3-2.1H10l-.3 2.1a7.6 7.6 0 0 0-1.7 1l-2-.8-1.7 3L6 11a7.9 7.9 0 0 0 0 2l-1.7 1.3 1.7 3 2-.8a7.6 7.6 0 0 0 1.7 1l.3 2.1h3.4l.3-2.1a7.6 7.6 0 0 0 1.7-1l2 .8 1.7-3Z" />
        </>,
      ),
    },
  ];
}

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className="a-navitem"
      style={{
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: "12px 14px",
        borderRadius: 12,
        textDecoration: "none",
        borderLeft: `3px solid ${active ? "#E0A95C" : "transparent"}`,
        background: active ? "rgba(224,169,92,.14)" : "transparent",
        color: active ? "#F6EEDF" : "#B4AA98",
        font: `${active ? 600 : 500} 15px/1 'Inter'`,
      }}
    >
      <span style={{ display: "flex" }}>{item.icon}</span>
      <NavLabel label={item.label} badge={item.badge} />
    </Link>
  );
}

function NavLabel({ label, badge }: { label: string; badge?: number }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {label}
      {pending && <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" aria-hidden />}
      {typeof badge === "number" && badge > 0 && !pending && (
        <span
          style={{
            marginLeft: "auto",
            font: "600 11px/1 'Inter'",
            color: "#E0A95C",
            background: "rgba(224,169,92,.14)",
            padding: "4px 8px",
            borderRadius: 999,
          }}
        >
          {badge}
        </span>
      )}
    </>
  );
}

function Sidebar({
  leadCount,
  walletFloat,
  heldAcross,
}: {
  leadCount: number;
  walletFloat: string;
  heldAcross: number;
}) {
  const pathname = usePathname();
  const items = navItems(leadCount);
  return (
    <aside
      style={{
        width: 262,
        flex: "none",
        background: "#332F28",
        color: "#EFE7D8",
        display: "flex",
        flexDirection: "column",
        padding: "26px 18px 20px",
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
        height: "100vh",
      }}
    >
      <Link
        href="/admin"
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 9,
          padding: "2px 8px 0",
          textDecoration: "none",
        }}
      >
        <span className="font-vibes" style={{ fontSize: 34, lineHeight: 1, color: "#F1E7D6" }}>
          Landys
        </span>
        <span
          style={{
            font: "700 9px/1 'Inter'",
            letterSpacing: ".2em",
            color: "#E0A95C",
            border: "1px solid #C0803C",
            borderRadius: 999,
            padding: "3px 6px",
          }}
        >
          PRO
        </span>
        <span
          style={{
            font: "500 12px/1 'Inter'",
            color: "#8B8272",
            marginLeft: "auto",
            alignSelf: "center",
          }}
        >
          Admin
        </span>
      </Link>

      <nav style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 32 }}>
        {items.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <div
        style={{
          background: "rgba(255,255,255,.05)",
          border: "1px solid rgba(255,255,255,.07)",
          borderRadius: 16,
          padding: "15px 16px",
          marginBottom: 14,
        }}
      >
        <p
          style={{
            margin: "0 0 3px",
            font: "600 10px/1 'Inter'",
            letterSpacing: ".09em",
            textTransform: "uppercase",
            color: "#948B7B",
          }}
        >
          Wallet float
        </p>
        <p
          style={{
            margin: "0 0 2px",
            font: "600 24px/1 'Inter'",
            letterSpacing: "-.02em",
            color: "#F6EEDF",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {walletFloat}
        </p>
        <p style={{ margin: 0, font: "500 12px/1 'Inter'", color: "#7FA07E" }}>
          held across {heldAcross} contractor{heldAcross === 1 ? "" : "s"}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          paddingTop: 15,
          borderTop: "1px solid rgba(255,255,255,.07)",
        }}
      >
        <span
          style={{
            width: 37,
            height: 37,
            borderRadius: 999,
            background: "#5A5142",
            color: "#F1E7D6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: "600 13px/1 'Inter'",
            flex: "none",
          }}
        >
          AD
        </span>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, font: "600 13px/1.2 'Inter'", color: "#F1E7D6" }}>Admin Desk</p>
          <p style={{ margin: "2px 0 0", font: "400 12px/1 'Inter'", color: "#948B7B" }}>
            Landy&apos;s Pro HQ
          </p>
        </div>
      </div>
    </aside>
  );
}

function ThemeSegment() {
  const { theme, setTheme } = useAdminTheme();
  const onSeg = "var(--gold)";
  const seg = (active: boolean) => ({
    cursor: "pointer",
    border: "none",
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 11px",
    borderRadius: 8,
    font: "600 12px/1 'Inter'",
    background: active ? onSeg : "transparent",
    color: active ? "#fff" : "var(--ink2)",
  });
  return (
    <div
      style={{
        display: "flex",
        gap: 3,
        background: "var(--card2)",
        border: "1px solid var(--line)",
        padding: 3,
        borderRadius: 11,
      }}
    >
      <button type="button" title="Light" onClick={() => setTheme("light")} style={seg(theme === "light")}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        Light
      </button>
      <button type="button" title="Dark" onClick={() => setTheme("dark")} style={seg(theme === "dark")}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z" />
        </svg>
        Dark
      </button>
    </div>
  );
}

function Topbar({ userMenu }: { userMenu?: React.ReactNode }) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 20,
        padding: "16px 34px",
        background: "color-mix(in srgb,var(--surface) 82%,transparent)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <form
        action="/admin/contractors"
        method="get"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 42,
          padding: "0 15px",
          background: "var(--field)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          minWidth: 280,
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" />
        </svg>
        <input
          name="q"
          placeholder="Search leads, contractors, trades…"
          className="a-input"
          style={{ font: "400 14px/1 'Inter'", width: "100%" }}
        />
      </form>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <ThemeSegment />
        {userMenu ?? (
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              background: "#464137",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              font: "600 13px/1 'Inter'",
            }}
          >
            AD
          </span>
        )}
      </div>
    </header>
  );
}

export function AdminShell({
  initialTheme,
  leadCount,
  walletFloat,
  heldAcross,
  userMenu,
  children,
}: {
  initialTheme: AdminTheme;
  leadCount: number;
  walletFloat: string;
  heldAcross: number;
  userMenu?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <AdminThemeProvider initialTheme={initialTheme}>
      {(theme) => (
        <div
          className="admin-theme"
          data-theme={theme}
          style={{ minWidth: 1200, minHeight: "100vh", display: "flex" }}
        >
          <Sidebar leadCount={leadCount} walletFloat={walletFloat} heldAcross={heldAcross} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <Topbar userMenu={userMenu} />
            <main style={{ padding: "34px 40px 64px", maxWidth: 1240, width: "100%" }}>
              {children}
            </main>
          </div>
        </div>
      )}
    </AdminThemeProvider>
  );
}
