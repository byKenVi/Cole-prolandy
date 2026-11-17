"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type NavCounts = { requests: number; feesDue: number };

const ITEMS = [
  { href: "/dashboard", label: "Home", longLabel: "Home", icon: "/nav-icons/nav-home.png", count: null },
  { href: "/opportunities", label: "Requests", longLabel: "Job requests", icon: "/nav-icons/nav-leads.png", count: "requests" },
  { href: "/jobs", label: "My jobs", longLabel: "My jobs", icon: "/nav-icons/nav-jobs.png", count: null },
  { href: "/fees", label: "Fees", longLabel: "Fees to pay", icon: "/nav-icons/nav-wallet.png", count: "feesDue" },
  { href: "/profile", label: "Account", longLabel: "My account", icon: "/nav-icons/nav-profile.png", count: null },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function CountBadge({ value, label }: { value: number; label: string }) {
  if (value <= 0) return null;
  return (
    <span className="pro-tab-count" aria-label={label}>
      {value > 99 ? "99+" : value}
    </span>
  );
}

export function ProTabs({ counts }: { counts: NavCounts }) {
  const pathname = usePathname();
  return (
    <nav className="pro-tabs" aria-label="Main">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const count = item.count ? counts[item.count] : 0;
        return (
          <Link key={item.href} href={item.href} className="pro-tab" aria-current={active ? "page" : undefined}>
            <Image src={item.icon} alt="" width={28} height={28} aria-hidden />
            <span>{item.label}</span>
            <CountBadge value={count} label={`${count} waiting`} />
          </Link>
        );
      })}
    </nav>
  );
}

export function ProSidebarNav({ counts, footer, top }: { counts: NavCounts; footer?: ReactNode; top: ReactNode }) {
  const pathname = usePathname();
  return (
    <aside className="pro-sidebar" aria-label="Main">
      {top}
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const count = item.count ? counts[item.count] : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="pro-sidebar-link"
            aria-current={active ? "page" : undefined}
          >
            <Image src={item.icon} alt="" width={26} height={26} aria-hidden />
            <span>{item.longLabel}</span>
            <CountBadge value={count} label={`${count} waiting`} />
          </Link>
        );
      })}
      {footer && <div className="pro-sidebar-foot">{footer}</div>}
    </aside>
  );
}
