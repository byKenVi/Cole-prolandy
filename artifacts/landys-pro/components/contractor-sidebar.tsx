"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { ExitViewAsButton } from "@/components/auth/exit-view-as";

const NAV: { href: string; label: string; icon: string }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "/nav-icons/nav-home.png" },
  { href: "/opportunities", label: "Opportunities", icon: "/nav-icons/nav-leads.png" },
  { href: "/jobs", label: "My Jobs", icon: "/icon-job-mono.png" },
  { href: "/fees", label: "Fees & Payments", icon: "/nav-icons/nav-wallet.png" },
  { href: "/profile", label: "Profile", icon: "/nav-icons/nav-profile.png" },
];

export function ContractorSidebar({
  name,
  subtitle,
  initials,
  userMenu,
  showSignOut = false,
  viewingAs = false,
}: {
  name?: string | null;
  subtitle?: string | null;
  initials?: string | null;
  userMenu?: ReactNode;
  showSignOut?: boolean;
  viewingAs?: boolean;
}) {
  const pathname = usePathname();
  return (
    <aside className="contractor-sidebar">
      <div className="flex items-baseline gap-[9px] px-[6px] pt-[2px]">
        <Link href="/dashboard" className="font-vibes text-[34px] leading-none text-[#F1E7D6]">
          Landys
        </Link>
        <span className="rounded-full border border-[#C0803C] px-[6px] py-[3px] text-[9px] font-bold uppercase leading-none tracking-[0.2em] text-[#E0A95C]">
          Pro
        </span>
      </div>

      <nav className="mt-[34px] flex flex-col gap-[3px]">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-[13px] rounded-[12px] border-l-[3px] px-[14px] py-3 text-[15px] transition-colors",
                active
                  ? "border-[#E0A95C] bg-[#E0A95C24] font-semibold text-[#F6EEDF]"
                  : "border-transparent font-medium text-[#B4AA98] hover:bg-white/5 hover:text-[#EFE7D8]",
              )}
            >
              <NavIcon icon={icon} active={active} />
              <span className="min-w-0 flex-1">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {viewingAs && (
        <div className="mb-4">
          <ExitViewAsButton variant="sidebar" />
        </div>
      )}

      <div className="flex min-w-0 items-center gap-2.5 border-t border-white/[0.07] px-[6px] pb-[2px] pt-4">
        {userMenu ? (
          <span className="flex-none">{userMenu}</span>
        ) : (
          <Link
            href="/profile"
            className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[#5A5142] text-[14px] font-semibold text-[#F1E7D6]"
          >
            {initials ?? "?"}
          </Link>
        )}
        <Link href="/profile" className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-[14px] font-semibold leading-[1.2] text-[#F1E7D6]">
            {name ?? "Your profile"}
          </p>
          {subtitle && (
            <p className="mt-0.5 truncate text-[12px] leading-none text-[#9A9084]">{subtitle}</p>
          )}
        </Link>
        {showSignOut ? (
          <span className="ml-1 flex-none">
            <SignOutLink variant="sidebarIcon" label="Sign out" />
          </span>
        ) : (
          <ChevronRight className="h-4 w-4 flex-none text-[#9A9084]" strokeWidth={1.8} aria-hidden />
        )}
      </div>
    </aside>
  );
}

function NavIcon({ icon, active }: { icon: string; active: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <span className="relative flex h-[22px] w-[22px] items-center justify-center">
      <Image
        src={icon}
        alt=""
        width={22}
        height={22}
        aria-hidden
        draggable={false}
        className={cn(
          "nav-icon-3d h-[22px] w-[22px] select-none object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]",
          active && "nav-icon-3d--active",
          pending && "opacity-0",
        )}
      />
      {pending && (
        <Loader2 className="absolute h-[19px] w-[19px] animate-spin text-[#E0A95C]" aria-hidden />
      )}
    </span>
  );
}
