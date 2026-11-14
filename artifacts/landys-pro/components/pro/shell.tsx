import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { authMode } from "@/lib/auth";
import { UserMenu } from "@/components/auth/user-menu";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { ExitViewAsButton } from "@/components/auth/exit-view-as";
import { ProSidebarNav, ProTabs, type NavCounts } from "./nav";
import { Wordmark } from "./ui";

export async function loadNavCounts(contractorId: string | null): Promise<NavCounts> {
  if (!contractorId) return { requests: 0, feesDue: 0 };
  const now = new Date();
  const [requests, feesDue] = await Promise.all([
    prisma.leadMatch.count({
      where: {
        contractorId,
        status: "PENDING",
        lead: { expiresAt: { gt: now }, status: { in: ["NEW", "DISTRIBUTED"] } },
      },
    }),
    prisma.successFee.count({ where: { status: "DUE", leadMatch: { contractorId } } }),
  ]);
  return { requests, feesDue };
}

/** Signed-in contractor frame: forest top bar + bottom tabs on phones, sidebar on desktop. */
export async function ProShell({
  contractorId,
  contractorName,
  viewingAs,
  children,
}: {
  contractorId: string | null;
  contractorName?: string | null;
  viewingAs: boolean;
  children: ReactNode;
}) {
  const clerk = authMode() === "clerk";
  const counts = await loadNavCounts(contractorId);
  const { runScheduledJobsIfStale } = await import("@/lib/services/scheduled-jobs");
  await runScheduledJobsIfStale();
  return (
    <div className="pro pro-shell">
      <ProSidebarNav
        counts={counts}
        top={<Wordmark />}
        footer={
          <>
            {clerk ? <UserMenu /> : null}
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {contractorName ?? "Your account"}
            </span>
            {viewingAs && <ExitViewAsButton variant="sidebar" />}
            {clerk && <SignOutLink variant="sidebarIcon" label="Sign out" />}
          </>
        }
      />
      <div className="pro-main">
        <header className="pro-topbar">
          <Wordmark />
          <div className="pro-topbar-actions">
            {viewingAs && <ExitViewAsButton variant="mobile" />}
            {clerk && <UserMenu />}
          </div>
        </header>
        <main className="pro-content">{children}</main>
      </div>
      <ProTabs counts={counts} />
    </div>
  );
}

/** Page frame for login-free pages opened from a text or email. */
export function PublicFrame({ children, homeowner = false }: { children: ReactNode; homeowner?: boolean }) {
  return (
    <div className="pro pro-public">
      <header className="pro-public-head">
        <Wordmark href={null} pro={!homeowner} />
      </header>
      <main className="pro-content">{children}</main>
    </div>
  );
}
