import { redirect } from "next/navigation";
import { getSession, authMode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserMenu } from "@/components/auth/user-menu";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminTheme, getAdminSidebarCollapsed } from "@/lib/admin-theme.server";
import { formatMoney } from "@/lib/money";
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

  // Success fees collected — primary revenue metric for the success-fee model.
  const [theme, collapsed, successFeesAgg, paidFeesCount] = await Promise.all([
    getAdminTheme(),
    getAdminSidebarCollapsed(),
    prisma.successFee.aggregate({
      where: { status: "PAID" },
      _sum: { feeAmountCents: true },
    }),
    prisma.successFee.count({ where: { status: "PAID" } }),
  ]);
  const successFeesTotal = formatMoney(successFeesAgg._sum.feeAmountCents ?? 0);

  return (
    <AdminShell
      initialTheme={theme}
      initialCollapsed={collapsed}
      successFeesTotal={successFeesTotal}
      paidFeesCount={paidFeesCount}
      userMenu={clerk ? <UserMenu /> : undefined}
      showSignOut={clerk}
      identity={{
        name: adminName,
        email: session.email ?? undefined,
        adminRole: session.adminRole,
      }}
      isOwner={session.adminRole === "owner"}
    >
      {children}
    </AdminShell>
  );
}
