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
 * Contractor shell — full-bleed like admin (dark sidebar + cream main), no
 * inset rounded "app card".
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
    <div className="flex min-h-screen bg-[#FEFBF6]">
      <ContractorSidebar
        walletCents={walletCents}
        name={contractor?.name}
        subtitle={contractor?.contractorType?.name}
        initials={initialsFrom(contractor?.name)}
        userMenu={clerk ? <UserMenu /> : undefined}
        showSignOut={clerk}
        viewingAs={session.viewingAs}
      />

      <main className="flex min-w-0 flex-1 flex-col bg-[#FEFBF6]">
        {/* Mobile header (sidebar is hidden below md) */}
        <header className="flex items-center justify-between border-b border-[#EDE4D3] px-4 py-3 md:hidden">
          <Link href="/home" className="flex items-baseline gap-2">
            <span className="font-vibes text-[26px] leading-none text-[#5C5142]">Landys</span>
            <span className="rounded-full border border-[#C0803C] px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.2em] text-[#C0803C]">
              Pro
            </span>
          </Link>

          {/* Wallet balance chip — always visible, links to Wallet page */}
          {typeof walletCents === "number" && (
            <Link
              href="/wallet"
              className="flex items-center gap-[6px] rounded-full bg-[#3B372F] px-[11px] py-[6px] text-[13px] font-semibold text-[#F6EEDF] transition-colors hover:bg-[#4A453C]"
            >
              <Wallet className="h-[13px] w-[13px] flex-none text-[#E0A95C]" strokeWidth={1.8} aria-hidden />
              {formatMoney(walletCents)}
            </Link>
          )}

          <div className="flex items-center gap-2">
            {session.viewingAs && <ExitViewAsButton variant="mobile" />}
            {clerk && <SignOutLink variant="icon" />}
            {clerk && <UserMenu />}
          </div>
        </header>

        <div className="flex-1 pb-24 md:pb-0">{children}</div>
      </main>

      <ContractorTabs />
    </div>
  );
}
