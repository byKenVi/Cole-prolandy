import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { authMode, getSession } from "@/lib/auth";
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

export default async function ContractorLayout({ children }: { children: React.ReactNode }) {
  const clerk = authMode() === "clerk";
  const session = await getSession();

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
    <div className="contractor-shell">
      <ContractorSidebar
        name={contractor?.name}
        subtitle={contractor?.contractorType?.name}
        initials={initialsFrom(contractor?.name)}
        userMenu={clerk ? <UserMenu /> : undefined}
        showSignOut={clerk}
        viewingAs={session.viewingAs}
      />

      <main className="contractor-main">
        <header className="contractor-mobile-header">
          <Link href="/dashboard" className="flex min-w-0 flex-none items-baseline gap-2 pl-0.5">
            <span className="font-vibes text-[26px] leading-none text-[#5C5142]">Landys</span>
            <span className="rounded-full border border-[#C0803C] px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.2em] text-[#C0803C]">
              Pro
            </span>
          </Link>

          <div className="ml-auto flex flex-none items-center gap-1">
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
