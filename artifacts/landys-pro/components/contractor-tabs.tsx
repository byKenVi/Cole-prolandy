"use client";

import Image from "next/image";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: { href: string; label: string; icon: string }[] = [
  { href: "/dashboard", label: "Home", icon: "/nav-icons/nav-home.png" },
  { href: "/opportunities", label: "Opps", icon: "/nav-icons/nav-leads.png" },
  { href: "/jobs", label: "My Jobs", icon: "/icon-job-mono.png" },
  { href: "/fees", label: "Fees", icon: "/nav-icons/nav-wallet.png" },
  { href: "/profile", label: "Profile", icon: "/nav-icons/nav-profile.png" },
];

export function ContractorTabs() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t border-[#E3DAC9] bg-[#4A3E2D] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {TABS.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex min-h-tap flex-col items-center justify-center gap-1 py-2 transition-colors",
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
      <span className="relative flex h-[24px] w-[24px] items-center justify-center">
        <Image
          src={icon}
          alt=""
          width={24}
          height={24}
          aria-hidden
          draggable={false}
          className={cn(
            "nav-icon-3d h-[24px] w-[24px] select-none object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]",
            active && "nav-icon-3d--active",
            pending && "opacity-0",
          )}
        />
        {pending && <Loader2 className="absolute h-5 w-5 animate-spin" aria-hidden />}
      </span>
      <span className={cn("text-[10px] leading-tight", active ? "font-semibold" : "font-medium")}>
        {label}
      </span>
    </>
  );
}
