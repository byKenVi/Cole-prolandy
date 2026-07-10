import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { authMode, getSession } from "@/lib/auth";
import { UserMenu } from "@/components/auth/user-menu";
import { ExitViewAsBanner } from "@/components/auth/exit-view-as";
import { ContractorTabs } from "@/components/contractor-tabs";
import { ContractorSidebar } from "@/components/contractor-sidebar";

export const dynamic = "force-dynamic";

function initialsFrom(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/**
 * Contractor shell — one rounded "app card" split into a dark sidebar and a
 * cream main pane on desktop (per the Landys Pro design), with a compact header
 * and a thumb-reachable bottom tab bar on mobile.
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

  return (
    <div className="min-h-screen bg-[#EFE7D8]">
      {session.viewingAs && <ExitViewAsBanner />}

      <div className="mx-4 mb-6 mt-4 flex min-h-[calc(100dvh-2.5rem)] items-stretch rounded-[26px] border border-[#E3DAC9] bg-[#FBF6EC] shadow-[0_24px_60px_rgba(58,53,45,0.12)] md:mx-6 md:min-h-[calc(100vh-2.5rem)]">
        <ContractorSidebar
          walletCents={contractor?.walletBalanceCents ?? null}
          name={contractor?.name}
          subtitle={contractor?.contractorType?.name}
          initials={initialsFrom(contractor?.name)}
          userMenu={clerk ? <UserMenu /> : undefined}
        />

        <main className="flex min-w-0 flex-1 flex-col rounded-[26px] bg-[#FBF6EC] md:rounded-l-none">
          {/* Mobile header (sidebar is hidden below md) */}
          <header className="flex items-center justify-between border-b border-[#EDE4D3] px-4 py-3 md:hidden">
            <Link href="/home" className="flex items-baseline gap-2">
              <span className="font-vibes text-[26px] leading-none text-[#5C5142]">Landys</span>
              <span className="rounded-full border border-[#C0803C] px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.2em] text-[#C0803C]">
                Pro
              </span>
            </Link>
            {clerk && <UserMenu />}
          </header>

          <div className="flex-1 pb-24 md:pb-0">{children}</div>
        </main>
      </div>

      <ContractorTabs />
    </div>
  );
}
