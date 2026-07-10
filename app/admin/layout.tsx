import { redirect } from "next/navigation";
import { getSession, authMode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserMenu } from "@/components/auth/user-menu";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminTheme, getAdminSidebarCollapsed } from "@/lib/admin-theme.server";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.role !== "admin") {
    redirect(authMode() === "clerk" ? "/home" : "/");
  }
  const clerk = authMode() === "clerk";

  // Sidebar summary + initial theme. All read-only, no money/state mutation.
  const [theme, collapsed, openLeads, walletAgg, heldAcross] = await Promise.all([
    getAdminTheme(),
    getAdminSidebarCollapsed(),
    prisma.lead.count({ where: { status: { in: ["NEW", "DISTRIBUTED"] } } }),
    prisma.contractor.aggregate({ _sum: { walletBalanceCents: true } }),
    prisma.contractor.count({ where: { walletBalanceCents: { gt: 0 } } }),
  ]);

  return (
    <AdminShell
      initialTheme={theme}
      initialCollapsed={collapsed}
      leadCount={openLeads}
      walletFloat={formatMoney(walletAgg._sum.walletBalanceCents ?? 0)}
      heldAcross={heldAcross}
      userMenu={clerk ? <UserMenu /> : undefined}
    >
      {children}
    </AdminShell>
  );
}
