import { redirect } from "next/navigation";
import { getSession, authMode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserMenu } from "@/components/auth/user-menu";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminTheme, getAdminSidebarCollapsed } from "@/lib/admin-theme.server";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

/**
 * The admin UI still names fonts literally in inline styles ("Inter", "Rubik"),
 * so it keeps the Google Fonts stylesheet. Public and contractor pages use the
 * self-hosted fonts from lib/fonts.ts instead (faster, no layout shift).
 */
const ADMIN_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.role !== "admin") {
    redirect(authMode() === "clerk" ? "/home" : "/");
  }
  const clerk = authMode() === "clerk";
  // getSession() already resolves the Clerk user and linked AdminUser. Avoid a
  // second Clerk Backend API request on every admin route transition.
  const adminName = session.email?.split("@")[0] || "Administrator";

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
  const { runScheduledJobsIfStale } = await import("@/lib/services/scheduled-jobs");
  await runScheduledJobsIfStale();

  return (
    <>
    <link rel="stylesheet" href={ADMIN_FONTS_HREF} precedence="default" />
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
    </>
  );
}
