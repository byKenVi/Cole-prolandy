"use client";

import Link, { useLinkStatus } from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import type { AdminTheme } from "@/lib/admin-theme";
import { ADMIN_SIDEBAR_COOKIE } from "@/lib/admin-theme";
import { AdminThemeProvider } from "@/components/admin/theme-context";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { AdminGlobalSearch } from "@/components/admin/global-search";

/**
 * The admin application shell: a flat forest sidebar, a topbar with search,
 * and the themed content area. The sidebar collapses to an icon rail on
 * desktop (cookie-persisted) and becomes an off-canvas drawer below 900px.
 *
 * Every destination has its own 3D icon (the client likes them; never reuse
 * one for two entries). Counters only appear on entries where
 * something is waiting for the admin, so the menu doubles as a to-do signal.
 *
 * Layout-critical properties live in the `.admin-*` classes in globals.css,
 * driven by the `data-collapsed` / `data-mobile-open` attributes on the root.
 */

export type AdminNavCounts = {
  /** Requests held for admin review. */
  leads: number;
  /** Landowner confirmations flagged as a mismatch. */
  confirmations: number;
  /** Success fees due. */
  fees: number;
};

type NavItem = {
  href: string;
  label: string;
  /** 3D PNG, unique per entry. */
  icon: string;
  count?: keyof AdminNavCounts;
};
type AdminIdentity = { name: string; email?: string; adminRole?: "owner" | "admin" };

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "/admin-icons/dashboard.png" },
  { href: "/admin/leads", label: "Requests", icon: "/admin-icons/leads.png", count: "leads" },
  { href: "/admin/contractors", label: "Contractors", icon: "/admin-icons/contractors.png" },
  { href: "/admin/invitations", label: "Invitations", icon: "/nav-icons/nav-profile.png" },
  {
    href: "/admin/confirmations",
    label: "Confirmations",
    icon: "/admin-icons/confirmations.png",
    count: "confirmations",
  },
  { href: "/admin/fees", label: "Success fees", icon: "/admin-icons/success-fees.png", count: "fees" },
  { href: "/admin/settings", label: "Settings", icon: "/admin-icons/settings.png" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function initialsOf(name: string): string {
  return (
    name
      .split(/[\s._-]+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "A"
  );
}

function NavLink({ item, active, count }: { item: NavItem; active: boolean; count: number }) {
  return (
    <Link
      href={item.href}
      className="admin-navitem"
      data-active={active}
      aria-current={active ? "page" : undefined}
      title={item.label}
    >
      <span className="admin-nav-icon">
        <Image src={item.icon} alt="" aria-hidden width={26} height={26} className="admin-nav-icon-img" />
      </span>
      <NavLabel label={item.label} />
      {count > 0 && (
        <span className="admin-nav-count" aria-label={`${count} waiting`}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

function NavLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span className="admin-nav-label">{label}</span>
      {pending && <Loader2 size={14} className="animate-spin admin-nav-label" aria-hidden />}
    </>
  );
}

function Sidebar({
  successFeesTotal,
  paidFeesCount,
  counts,
  collapsed,
  onToggleCollapse,
  onCloseMobile,
  showSignOut,
  identity,
}: {
  successFeesTotal: string;
  paidFeesCount: number;
  counts: AdminNavCounts;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  showSignOut?: boolean;
  identity: AdminIdentity;
}) {
  const pathname = usePathname();
  return (
    <aside className="admin-sidebar">
      <div className="admin-brand-row">
        <Link href="/admin" className="admin-brand" aria-label="Landys Pro dashboard">
          <span className="font-vibes admin-brand-word" style={{ fontSize: 34, lineHeight: 1, color: "#f1f2ec" }}>
            Landys
          </span>
          <span
            className="admin-brand-tag"
            style={{
              font: "600 11px/1 var(--ui)",
              color: "#d6a95e",
              border: "1px solid rgba(214,169,94,.6)",
              borderRadius: 999,
              padding: "3px 7px",
            }}
          >
            Pro
          </span>
        </Link>

        <button
          type="button"
          className="admin-collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <PanelLeftOpen size={18} aria-hidden /> : <PanelLeftClose size={18} aria-hidden />}
        </button>

        <button type="button" className="admin-drawer-close" onClick={onCloseMobile} aria-label="Close menu">
          <X size={20} aria-hidden />
        </button>
      </div>

      <nav className="admin-nav" aria-label="Admin">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
            count={item.count ? counts[item.count] : 0}
          />
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <Link href="/admin/fees?tab=paid" className="admin-wallet-card" style={{ textDecoration: "none" }}>
        <div className="admin-wallet-body" style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: "0 0 4px", font: "500 13px/1.3 var(--ui)", color: "#a9bbae" }}>
            Success fees collected
          </p>
          <p style={{ margin: 0, font: "600 24px/1.1 var(--head)", color: "#ffffff" }}>{successFeesTotal}</p>
          <p style={{ margin: "3px 0 0", font: "400 13px/1.3 var(--ui)", color: "#a9bbae" }}>
            {paidFeesCount} paid fee{paidFeesCount === 1 ? "" : "s"}
          </p>
        </div>
      </Link>

      <div className="admin-user">
        <span
          aria-hidden
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: "#34503f",
            color: "#f1f2ec",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: "600 13px/1 var(--ui)",
            flex: "none",
          }}
        >
          {initialsOf(identity.name)}
        </span>
        <div className="admin-foot-text" style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: 0,
              font: "600 14px/1.2 var(--ui)",
              color: "#f1f2ec",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {identity.name}
            <span style={{ fontWeight: 400, color: "#a9bbae" }}>
              {", "}
              {identity.adminRole === "owner" ? "owner" : "admin"}
            </span>
          </p>
          <p className="admin-foot-email">{identity.email ?? "Administrator"}</p>
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
  identity,
}: {
  userMenu?: React.ReactNode;
  onOpenMobile: () => void;
  showSignOut?: boolean;
  identity: AdminIdentity;
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
        padding: "12px 40px",
        background: "var(--bg)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <button type="button" className="admin-hamburger" onClick={onOpenMobile} aria-label="Open menu">
        <Menu size={22} aria-hidden />
      </button>

      <AdminGlobalSearch />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {showSignOut && <SignOutLink variant="icon" label="Sign out" />}
        {userMenu ?? (
          <span
            aria-hidden
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              background: "var(--gold)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              font: "600 13px/1 var(--ui)",
            }}
          >
            {initialsOf(identity.name)}
          </span>
        )}
      </div>
    </header>
  );
}

export function AdminShell({
  initialTheme,
  initialCollapsed = false,
  successFeesTotal,
  paidFeesCount,
  counts = { leads: 0, confirmations: 0, fees: 0 },
  userMenu,
  showSignOut = false,
  identity,
  children,
}: {
  initialTheme: AdminTheme;
  initialCollapsed?: boolean;
  successFeesTotal: string;
  paidFeesCount: number;
  counts?: AdminNavCounts;
  userMenu?: React.ReactNode;
  showSignOut?: boolean;
  identity: AdminIdentity;
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
            successFeesTotal={successFeesTotal}
            paidFeesCount={paidFeesCount}
            counts={counts}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
            onCloseMobile={() => setMobileOpen(false)}
            showSignOut={showSignOut}
            identity={identity}
          />
          <div className="admin-scrim" aria-hidden onClick={() => setMobileOpen(false)} />
          <div className="admin-content">
            <Topbar
              userMenu={userMenu}
              onOpenMobile={() => setMobileOpen(true)}
              showSignOut={showSignOut}
              identity={identity}
            />
            <main className="admin-main">{children}</main>
          </div>
        </div>
      )}
    </AdminThemeProvider>
  );
}
