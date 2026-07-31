import Link from "next/link";
import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { authMode, getSession } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { UserMenu } from "@/components/auth/user-menu";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { ExitViewAsButton } from "@/components/auth/exit-view-as";
import { ContractorTabs } from "@/components/contractor-tabs";
import { ContractorSidebar } from "@/components/contractor-sidebar";

export const dynamic = "force-dynamic";

function initialsFrom(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/**
 * Contractor shell — phone-first. Layout widths / overflow live in
 * `.contractor-*` CSS (globals.css) so a missing Tailwind variant can never
 * leave the 266px sidebar in the flow on a phone.
 */
export default async function ContractorLayout({ children }: { children: React.ReactNode }) {
  const clerk = authMode() === "clerk";
  const session = await getSession();

  // Admins land on /admin after login; keep them out of the blank contractor shell
  // unless they are explicitly "viewing as" a contractor.
  if (session.role === "admin" && !session.viewingAs) {
    redirect("/admin");
  }
  if (session.deactivated) {
    redirect("/deactivated");
  }

  const contractor = session.contractorId
    ? await prisma.contractor.findUnique({
        where: { id: session.contractorId },
        select: {
          walletBalanceCents: true,
          name: true,
          deactivatedAt: true,
          contractorType: { select: { name: true } },
        },
      })
    : null;

  if (contractor?.deactivatedAt) {
    redirect("/deactivated");
  }

  const walletCents = contractor?.walletBalanceCents ?? null;

  return (
    <div className="contractor-shell">
      <ContractorSidebar
        walletCents={walletCents}
        name={contractor?.name}
        subtitle={contractor?.contractorType?.name}
        initials={initialsFrom(contractor?.name)}
        userMenu={clerk ? <UserMenu /> : undefined}
        showSignOut={clerk}
        viewingAs={session.viewingAs}
      />

      <main className="contractor-main">
        <header className="contractor-mobile-header">
          <Link href="/home" className="flex min-w-0 flex-none items-baseline gap-2 pl-0.5">
            <span className="font-vibes text-[26px] leading-none text-[#5C5142]">Landys</span>
            <span className="rounded-full border border-[#C0803C] px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.2em] text-[#C0803C]">
              Pro
            </span>
          </Link>

          {/* Wallet chip shrinks before the controls so a long balance never
              pushes sign-out / avatar off the right edge. */}
          {typeof walletCents === "number" && (
            <Link
              href="/wallet"
              className="ml-auto flex min-w-0 max-w-[42%] items-center gap-[6px] rounded-full bg-[#3B372F] px-[11px] py-2 text-[13px] font-semibold text-[#F6EEDF] transition-colors hover:bg-[#4A453C]"
            >
              <Wallet className="h-[13px] w-[13px] flex-none text-[#E0A95C]" strokeWidth={1.8} aria-hidden />
              <span className="truncate tabular-nums">{formatMoney(walletCents)}</span>
            </Link>
          )}

          <div
            className={`flex flex-none items-center gap-1 ${
              typeof walletCents === "number" ? "" : "ml-auto"
            }`}
          >
            {session.viewingAs && <ExitViewAsButton variant="mobile" />}
            {clerk && <SignOutLink variant="icon" />}
            {clerk && <UserMenu />}
          </div>
        </header>

        <div className="contractor-page flex-1 pb-24 md:pb-0">{children}</div>
      </main>

      <ContractorTabs />
    </div>
  );
}
