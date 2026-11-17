import { redirect } from "next/navigation";
import { getSession, authMode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserMenu } from "@/components/auth/user-menu";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminTheme, getAdminSidebarCollapsed } from "@/lib/admin-theme.server";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.role !== "admin") {
    redirect(authMode() === "clerk" ? "/home" : "/");
  }
  const clerk = authMode() === "clerk";
  // getSession() already resolves the Clerk user and linked AdminUser. Avoid a
  // second Clerk Backend API request on every admin route transition.
  const adminName = session.email?.split("@")[0] || "Administrator";

  // Success fees collected: the primary revenue metric of the success-fee model.
  const [theme, collapsed, successFeesAgg, paidFeesCount, heldLeads, flaggedConfirmations, feesDue] =
    await Promise.all([
      getAdminTheme(),
      getAdminSidebarCollapsed(),
      prisma.successFee.aggregate({
        where: { status: "PAID" },
        _sum: { feeAmountCents: true },
      }),
      prisma.successFee.count({ where: { status: "PAID" } }),
      // Menu counters: only things that are waiting on an admin.
      prisma.lead.count({ where: { reviewStatus: "PENDING_REVIEW", status: { in: ["NEW", "DISTRIBUTED"] } } }),
      prisma.landownerConfirmation.count({ where: { mismatchFlagged: true } }),
      prisma.successFee.count({ where: { status: "DUE" } }),
    ]);
  const successFeesTotal = formatMoney(successFeesAgg._sum.feeAmountCents ?? 0);
  const { runScheduledJobsIfStale } = await import("@/lib/services/scheduled-jobs");
  await runScheduledJobsIfStale();

  return (
    <AdminShell
      initialTheme={theme}
      initialCollapsed={collapsed}
      successFeesTotal={successFeesTotal}
      paidFeesCount={paidFeesCount}
      counts={{ leads: heldLeads, confirmations: flaggedConfirmations, fees: feesDue }}
      userMenu={clerk ? <UserMenu /> : undefined}
      showSignOut={clerk}
      identity={{
        name: adminName,
        email: session.email ?? undefined,
        adminRole: session.adminRole,
      }}
    >
      {children}
    </AdminShell>
  );
}
