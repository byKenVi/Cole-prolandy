import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { AdminEmptyState, AdminTabBar, AdminTabLink, PageHeader, Panel } from "@/components/admin/ui";
import { InvitationsManager, type InvitationRow } from "@/components/admin/invitations-manager";

export const dynamic = "force-dynamic";

type Tab = "not_invited" | "invited" | "scheduled" | "with_account";

function parseTab(raw: string | undefined): Tab {
  return raw === "invited" || raw === "scheduled" || raw === "with_account" ? raw : "not_invited";
}

const base: Prisma.ContractorWhereInput = { deactivatedAt: null };

function where(tab: Tab): Prisma.ContractorWhereInput {
  switch (tab) {
    case "not_invited":
      return { ...base, clerkUserId: null, lastInvitedAt: null, inviteScheduledFor: null };
    case "invited":
      return { ...base, clerkUserId: null, lastInvitedAt: { not: null }, inviteScheduledFor: null };
    case "scheduled":
      return { ...base, clerkUserId: null, inviteScheduledFor: { not: null } };
    case "with_account":
      return { ...base, clerkUserId: { not: null } };
  }
}

export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin();
  const tab = parseTab((await searchParams).tab);
  const [rows, counts] = await Promise.all([
    prisma.contractor.findMany({
      where: where(tab),
      orderBy: { name: "asc" },
      take: 1000,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        clerkUserId: true,
        lastInvitedAt: true,
        inviteCount: true,
        inviteScheduledFor: true,
        inviteLastError: true,
        serviceZipCodes: true,
        serviceCounties: true,
        externalIdentities: { where: { source: "wix" }, select: { id: true } },
      },
    }),
    Promise.all(
      (["not_invited", "invited", "scheduled", "with_account"] as const).map((t) =>
        prisma.contractor.count({ where: where(t) }),
      ),
    ),
  ]);

  const data: InvitationRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    hasAccount: Boolean(r.clerkUserId),
    lastInvitedAt: r.lastInvitedAt?.toISOString() ?? null,
    inviteCount: r.inviteCount,
    inviteScheduledFor: r.inviteScheduledFor?.toISOString() ?? null,
    inviteLastError: r.inviteLastError,
    fromLandys: r.externalIdentities.length > 0,
    hasServiceArea: r.serviceZipCodes.length > 0 || r.serviceCounties.length > 0,
  }));

  return (
    <div>
      <PageHeader
        kicker="Contractor accounts"
        title="Invitations"
        subtitle="Invite contractors to create their free Landy's Pro account, now or at a date you choose. Each invitation is a branded email plus a text message with a personal sign-up link. Contractors still receive job requests by text before they sign up."
      />
      <AdminTabBar>
        <AdminTabLink href="/admin/invitations?tab=not_invited" active={tab === "not_invited"} count={counts[0]}>
          Not invited yet
        </AdminTabLink>
        <AdminTabLink href="/admin/invitations?tab=invited" active={tab === "invited"} count={counts[1]}>
          Invited, no account
        </AdminTabLink>
        <AdminTabLink href="/admin/invitations?tab=scheduled" active={tab === "scheduled"} count={counts[2]}>
          Scheduled
        </AdminTabLink>
        <AdminTabLink href="/admin/invitations?tab=with_account" active={tab === "with_account"} count={counts[3]}>
          Have an account
        </AdminTabLink>
      </AdminTabBar>
      <Panel style={{ marginTop: 16 }}>
        {data.length === 0 ? (
          <AdminEmptyState title="Nobody here" description="Sync contractors from landys.co on the Contractors page." />
        ) : (
          <InvitationsManager rows={data} />
        )}
      </Panel>
    </div>
  );
}
