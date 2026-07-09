"use client";

import Image from "next/image";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bottom tab bar (DESIGN.md §5 — thumb-reachable, phone-first). Gives INSTANT
 * feedback on tap: the tapped tab shows a spinner the moment it's pressed
 * (useLinkStatus) and the active tab is highlighted, so navigation never feels
 * frozen while the next page's data loads.
 */
const TABS: { href: string; label: string; icon: string }[] = [
  { href: "/home", label: "Home", icon: "/nav-icons/nav-home.png" },
  { href: "/leads", label: "My leads", icon: "/nav-icons/nav-leads.png" },
  { href: "/wallet", label: "Wallet", icon: "/nav-icons/nav-wallet.png" },
  { href: "/profile", label: "Profile", icon: "/nav-icons/nav-profile.png" },
];

export function ContractorTabs() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-[#E3DAC9] bg-[#3B372F] md:hidden">
      <div className="grid grid-cols-4">
        {TABS.map(({ href, label, icon }) => {
          const active =
            href === "/home"
              ? pathname === "/home"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex min-h-tap flex-col items-center justify-center gap-1 py-3 transition-colors",
                active ? "text-[#E0A95C]" : "text-[#B4AA98] hover:text-[#EFE7D8]",
              )}
            >
              <TabInner icon={icon} label={label} active={active} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function TabInner({
  icon,
  label,
  active,
}: {
  icon: string;
  label: string;
  active: boolean;
}) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span className="relative flex h-[26px] w-[26px] items-center justify-center">
        <Image
          src={icon}
          alt=""
          width={26}
          height={26}
          aria-hidden
          draggable={false}
          className={cn(
            "nav-icon-3d h-[26px] w-[26px] select-none object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]",
            active && "nav-icon-3d--active",
            pending && "opacity-0",
          )}
        />
        {pending && <Loader2 className="absolute h-6 w-6 animate-spin" aria-hidden />}
      </span>
      <span className={cn("text-xs", active ? "font-semibold" : "font-medium")}>{label}</span>
    </>
  );
}
