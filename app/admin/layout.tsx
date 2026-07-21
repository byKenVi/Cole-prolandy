import { redirect } from "next/navigation";
import { getSession, authMode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserMenu } from "@/components/auth/user-menu";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminTheme, getAdminSidebarCollapsed } from "@/lib/admin-theme.server";
import { formatMoney } from "@/lib/money";
import { queryNetLeadRevenueCents } from "@/lib/finance";
import { currentUser } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.role !== "admin") {
    redirect(authMode() === "clerk" ? "/home" : "/");
  }
  const clerk = authMode() === "clerk";
  const clerkUser = clerk ? await currentUser() : null;
  const adminName =
    clerkUser?.fullName ||
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    session.email ||
    "Administrator";

  // Net lead revenue (CA) — same definition as Finance (charges − refunds).
  const [theme, collapsed, leadRevenueCents, chargedLeads] = await Promise.all([
    getAdminTheme(),
    getAdminSidebarCollapsed(),
    queryNetLeadRevenueCents(prisma),
    prisma.walletTransaction.count({ where: { type: "LEAD_CHARGE" } }),
  ]);

  return (
    <AdminShell
      initialTheme={theme}
      initialCollapsed={collapsed}
      leadRevenue={formatMoney(leadRevenueCents)}
      chargedLeads={chargedLeads}
      userMenu={clerk ? <UserMenu /> : undefined}
      showSignOut={clerk}
      identity={{ name: adminName, email: session.email ?? undefined }}
    >
      {children}
    </AdminShell>
  );
}
