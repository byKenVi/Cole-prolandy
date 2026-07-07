"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Admin top nav. Highlights the active section and shows a small inline spinner
 * on the tapped link while its page loads (useLinkStatus), so admin navigation
 * gives instant feedback instead of feeling frozen.
 */
const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/contractors", label: "Contractors" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/settings", label: "Settings" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminNav() {
  const pathname = usePathname();
  return (
    <>
      {NAV.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "rounded-sm px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary-soft text-primary" : "text-text hover:bg-primary-soft",
            )}
          >
            <NavInner label={n.label} />
          </Link>
        );
      })}
    </>
  );
}

function NavInner({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
    </span>
  );
}
