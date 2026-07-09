"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Plus, ChevronRight, Loader2 } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: string }[] = [
  { href: "/home", label: "Home", icon: "/nav-icons/nav-home.png" },
  { href: "/leads", label: "My leads", icon: "/nav-icons/nav-leads.png" },
  { href: "/wallet", label: "Wallet", icon: "/nav-icons/nav-wallet.png" },
  { href: "/profile", label: "Profile", icon: "/nav-icons/nav-profile.png" },
];

export function ContractorSidebar({
  walletCents,
  name,
  subtitle,
  initials,
  userMenu,
}: {
  walletCents?: number | null;
  name?: string | null;
  subtitle?: string | null;
  initials?: string | null;
  userMenu?: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-[266px] flex-none flex-col bg-[#3B372F] px-5 pb-[22px] pt-[26px] text-[#EFE7D8] md:sticky md:top-4 md:flex md:h-[calc(100vh-2.5rem)] md:overflow-y-auto md:rounded-l-[26px]">
      {/* Wordmark */}
      <div className="flex items-baseline gap-[9px] px-[6px] pt-[2px]">
        <Link href="/home" className="font-vibes text-[34px] leading-none text-[#F1E7D6]">
          Landys
        </Link>
        <span className="rounded-full border border-[#C0803C] px-[6px] py-[3px] text-[9px] font-bold uppercase leading-none tracking-[0.2em] text-[#E0A95C]">
          Pro
        </span>
      </div>

      {/* Nav */}
      <nav className="mt-[34px] flex flex-col gap-[3px]">
        {NAV.map(({ href, label, icon }) => {
          const active =
            href === "/home"
              ? pathname === "/home"
              : pathname === href || pathname.startsWith(`${href}/`);
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
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Wallet inset */}
      {typeof walletCents === "number" && (
        <div className="mb-4 rounded-[18px] border border-white/[0.08] bg-white/[0.055] px-[18px] pb-4 pt-[18px]">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9A9084]">
              Wallet balance
            </span>
            <CreditCard className="h-[15px] w-[15px] text-[#9A9084]" strokeWidth={1.7} aria-hidden />
          </div>
          <p className="mb-[14px] text-[32px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[#F6EEDF]">
            {formatMoney(walletCents)}
          </p>
          <Link
            href="/wallet"
            className="flex h-11 w-full items-center justify-center gap-[7px] rounded-[12px] bg-[#C0803C] text-[15px] font-semibold text-white transition-colors hover:bg-[#A56A2B]"
          >
            <Plus className="h-[17px] w-[17px]" strokeWidth={2.2} aria-hidden /> Add funds
          </Link>
        </div>
      )}

      {/* Profile row */}
      <div className="flex items-center gap-[11px] border-t border-white/[0.07] px-[6px] pb-[2px] pt-4">
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
        <Link href="/profile" className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold leading-[1.2] text-[#F1E7D6]">
            {name ?? "Your profile"}
          </p>
          {subtitle && (
            <p className="mt-0.5 truncate text-[12px] leading-none text-[#9A9084]">{subtitle}</p>
          )}
        </Link>
        <ChevronRight className="h-4 w-4 flex-none text-[#9A9084]" strokeWidth={1.8} aria-hidden />
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
