"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, User, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bottom tab bar (DESIGN.md §5 — thumb-reachable, phone-first). Gives INSTANT
 * feedback on tap: the tapped tab shows a spinner the moment it's pressed
 * (useLinkStatus) and the active tab is highlighted, so navigation never feels
 * frozen while the next page's data loads.
 */
const TABS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/home", label: "Leads", Icon: Home },
  { href: "/wallet", label: "Wallet", Icon: Wallet },
  { href: "/profile", label: "Profile", Icon: User },
];

export function ContractorTabs() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-border bg-surface">
      <div className="grid grid-cols-3">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-tap flex-col items-center justify-center gap-1 py-3 transition-colors",
                active ? "text-primary" : "text-text-muted hover:text-primary",
              )}
            >
              <TabInner Icon={Icon} label={label} active={active} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function TabInner({
  Icon,
  label,
  active,
}: {
  Icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span className="relative flex h-6 w-6 items-center justify-center">
        <Icon className={cn("h-6 w-6", pending && "opacity-0")} aria-hidden />
        {pending && <Loader2 className="absolute h-6 w-6 animate-spin" aria-hidden />}
      </span>
      <span className={cn("text-xs", active ? "font-semibold" : "font-medium")}>{label}</span>
    </>
  );
}
