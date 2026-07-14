"use client";

import Link, { useLinkStatus } from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { AdminTheme } from "@/lib/admin-theme";
import { ADMIN_SIDEBAR_COOKIE } from "@/lib/admin-theme";
import { AdminThemeProvider } from "@/components/admin/theme-context";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { AdminGlobalSearch } from "@/components/admin/global-search";

/**
 * The admin application shell: a fixed dark/green sidebar, a sticky glass
 * topbar, and the themed main content area. The sidebar can collapse to an
 * icon-only rail on desktop (preference persisted in a cookie) and becomes an
 * off-canvas drawer on tablet/phone widths, toggled by a topbar hamburger.
 *
 * Layout-critical properties (widths, positioning, collapse/drawer transforms,
 * responsive hiding) live in the `.admin-*` CSS classes in globals.css so they
 * can be driven by the `data-collapsed` / `data-mobile-open` attributes on the
 * root; only decorative styling stays inline here.
 */

type NavItem = { href: string; label: string; icon: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "/admin-icons/dashboard.png" },
  { href: "/admin/leads", label: "Leads", icon: "/admin-icons/leads.png" },
  { href: "/admin/contractors", label: "Contractors", icon: "/admin-icons/contractors.png" },
  { href: "/admin/finance", label: "Finance", icon: "/admin-icons/finance.png" },
  { href: "/admin/pricing", label: "Pricing", icon: "/admin-icons/pricing.png" },
  { href: "/admin/settings", label: "Settings", icon: "/admin-icons/settings.png" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} className="admin-navitem" data-active={active} title={item.label}>
      <span className="admin-nav-icon">
        <Image
          src={item.icon}
          alt=""
          aria-hidden
          width={26}
          height={26}
          className="admin-nav-icon-img"
        />
      </span>
      <NavLabel label={item.label} />
    </Link>
  );
}

function NavLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span className="admin-nav-label">{label}</span>
      {pending && <Loader2 style={{ width: 14, height: 14 }} className="animate-spin admin-nav-label" aria-hidden />}
    </>
  );
}

/** Soft concentric-ring texture that gives the green sidebar/hero its depth. */
function RingTexture() {
  return (
    <svg
      viewBox="0 0 300 700"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      style={{ position: "absolute", inset: 0, opacity: 0.5, pointerEvents: "none" }}
    >
      <g fill="none" stroke="rgba(224,169,92,.13)" strokeWidth="1.2">
        {[1, 0.72, 0.46].map((s) => (
          <path
            key={`a${s}`}
            transform={`translate(150,150) scale(${s}) translate(-150,-150)`}
            d="M30,150 C30,80 110,40 180,60 C250,80 290,140 270,210 C250,280 160,300 100,270 C55,248 30,215 30,150 Z"
          />
        ))}
        {[1, 0.7].map((s) => (
          <path
            key={`b${s}`}
            transform={`translate(160,520) scale(${s}) translate(-150,-150)`}
            d="M30,150 C30,80 110,40 180,60 C250,80 290,140 270,210 C250,280 160,300 100,270 C55,248 30,215 30,150 Z"
          />
        ))}
      </g>
    </svg>
  );
}

function Chevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform .26s ease" }}
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function Sidebar({
  leadRevenue,
  acceptedLeads,
  collapsed,
  onToggleCollapse,
  onCloseMobile,
  showSignOut,
}: {
  leadRevenue: string;
  acceptedLeads: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  showSignOut?: boolean;
}) {
  const pathname = usePathname();
  return (
    <aside className="admin-sidebar">
      <RingTexture />

      <div className="admin-brand-row">
        <Link href="/admin" className="admin-brand">
          <span className="font-vibes admin-brand-word" style={{ fontSize: 35, lineHeight: 1, color: "#F1E7D6" }}>
            Landys
          </span>
          <span
            className="admin-brand-tag"
            style={{
              font: "700 9px/1 'Inter'",
              letterSpacing: ".2em",
              color: "#E3AB5E",
              border: "1px solid var(--gold)",
              borderRadius: 999,
              padding: "3px 6px",
            }}
          >
            PRO
          </span>
        </Link>

        <button
          type="button"
          className="admin-collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <Chevron collapsed={collapsed} />
        </button>

        <button
          type="button"
          className="admin-drawer-close"
          onClick={onCloseMobile}
          aria-label="Close menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="admin-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <div className="admin-wallet-card">
        <div className="admin-wallet-body" style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: "0 0 3px",
              font: "600 10px/1 var(--mono)",
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "#9BB09F",
            }}
          >
            Lead revenue
          </p>
          <p
            style={{
              margin: "0 0 2px",
              font: "600 24px/1 var(--display)",
              letterSpacing: "-.01em",
              color: "#F6EEDF",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {leadRevenue}
          </p>
          <p style={{ margin: 0, font: "500 12px/1 'Inter'", color: "#8FA592" }}>
            from {acceptedLeads} accepted lead{acceptedLeads === 1 ? "" : "s"}
          </p>
        </div>
        <svg
          width="42"
          height="42"
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden
          style={{ flex: "none", filter: "drop-shadow(0 5px 8px rgba(0,0,0,.4))" }}
        >
          <ellipse cx="24" cy="30" rx="15" ry="6" fill="#B98038" />
          <ellipse cx="24" cy="24" rx="15" ry="6" fill="#E3AB5E" />
          <ellipse cx="24" cy="18" rx="15" ry="6" fill="#F0C27E" />
          <text x="24" y="21.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#7A5320">$</text>
        </svg>
      </div>

      <div className="admin-user">
        <span
          style={{
            width: 37,
            height: 37,
            borderRadius: 999,
            background: "#3E5544",
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
        <div className="admin-foot-text" style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
              font: "600 13px/1.2 'Inter'",
              color: "#F1E7D6",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Admin Desk
            </span>
            <span
              style={{
                flex: "none",
                font: "700 8px/1 'Inter'",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "#E3AB5E",
                border: "1px solid rgba(227,171,94,.55)",
                borderRadius: 999,
                padding: "3px 6px",
              }}
            >
              Admin
            </span>
          </p>
          <p style={{ margin: "2px 0 0", font: "400 12px/1 'Inter'", color: "#8FA592" }}>
            Landy&apos;s Pro HQ
          </p>
        </div>
        {showSignOut && (
          <span className="admin-sidebar-signout">
            <SignOutLink variant="adminIcon" label="Sign out" />
          </span>
        )}
      </div>
    </aside>
  );
}

function Topbar({
  userMenu,
  onOpenMobile,
  showSignOut,
}: {
  userMenu?: React.ReactNode;
  onOpenMobile: () => void;
  showSignOut?: boolean;
}) {
  return (
    <header
      className="admin-topbar"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "15px 34px",
        background: "color-mix(in srgb,var(--surface) 82%,transparent)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <button type="button" className="admin-hamburger" onClick={onOpenMobile} aria-label="Open menu">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <AdminGlobalSearch />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {showSignOut && <SignOutLink variant="icon" label="Sign out" />}
        {userMenu ?? (
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: "#3E5544",
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
  initialCollapsed = false,
  leadRevenue,
  acceptedLeads,
  userMenu,
  showSignOut = false,
  children,
}: {
  initialTheme: AdminTheme;
  initialCollapsed?: boolean;
  leadRevenue: string;
  acceptedLeads: number;
  userMenu?: React.ReactNode;
  showSignOut?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      document.cookie = `${ADMIN_SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  return (
    <AdminThemeProvider initialTheme={initialTheme}>
      {(theme) => (
        <div
          className="admin-theme admin-shell-root"
          data-theme={theme}
          data-collapsed={collapsed}
          data-mobile-open={mobileOpen}
        >
          <Sidebar
            leadRevenue={leadRevenue}
            acceptedLeads={acceptedLeads}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
            onCloseMobile={() => setMobileOpen(false)}
            showSignOut={showSignOut}
          />
          <div className="admin-scrim" aria-hidden onClick={() => setMobileOpen(false)} />
          <div className="admin-content">
            <Topbar
              userMenu={userMenu}
              onOpenMobile={() => setMobileOpen(true)}
              showSignOut={showSignOut}
            />
            <main className="admin-main">{children}</main>
          </div>
        </div>
      )}
    </AdminThemeProvider>
  );
}
