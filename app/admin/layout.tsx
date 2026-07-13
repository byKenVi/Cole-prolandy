import { redirect } from "next/navigation";
import { getSession, authMode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserMenu } from "@/components/auth/user-menu";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminTheme, getAdminSidebarCollapsed } from "@/lib/admin-theme.server";
import { formatMoney } from "@/lib/money";
import { queryNetLeadRevenueCents } from "@/lib/finance";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.role !== "admin") {
    redirect(authMode() === "clerk" ? "/home" : "/");
  }
  const clerk = authMode() === "clerk";

  // Sidebar: net lead revenue (CA) — same definition as Finance (charges − refunds).
  const [theme, collapsed, openLeads, leadRevenueCents, acceptedLeads] = await Promise.all([
    getAdminTheme(),
    getAdminSidebarCollapsed(),
    prisma.lead.count({ where: { status: { in: ["NEW", "DISTRIBUTED"] } } }),
    queryNetLeadRevenueCents(prisma),
    prisma.leadMatch.count({ where: { status: "ACCEPTED" } }),
  ]);

  return (
    <AdminShell
      initialTheme={theme}
      initialCollapsed={collapsed}
      leadCount={openLeads}
      leadRevenue={formatMoney(leadRevenueCents)}
      acceptedLeads={acceptedLeads}
      userMenu={clerk ? <UserMenu /> : undefined}
      showSignOut={clerk}
    >
      {children}
    </AdminShell>
  );
}
