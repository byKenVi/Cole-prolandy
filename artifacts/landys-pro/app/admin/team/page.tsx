import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { consumeStalePendingInvites } from "@/lib/admin-invites";
import { TeamPageClient, type TeamMember, type PendingInvite } from "./team-client";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await getSession();

  if (session.role !== "admin") redirect("/sign-in");
  if (session.adminRole !== "owner") redirect("/admin");

  // Repair leftover PENDING rows (and wrong Owner badges) left by the old
  // ADMIN_EMAILS path that skipped invitation claims.
  await consumeStalePendingInvites().catch(() => undefined);

  const [rawMembers, rawInvites] = await Promise.all([
    prisma.adminUser.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        disabledAt: true,
        invitedById: true,
        lastLoginAt: true,
        createdAt: true,
        clerkUserId: true,
      },
    }),
    prisma.adminInvite.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        expiresAt: true,
      },
    }),
  ]);

  const members: TeamMember[] = rawMembers.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    status: m.disabledAt ? "disabled" : "active",
    invitedAt: m.createdAt,
    lastLoginAt: m.lastLoginAt,
    isSelf: m.clerkUserId === session.userId || m.id === session.adminUserId,
  }));

  const pendingInvites: PendingInvite[] = rawInvites.map((i) => ({
    id: i.id,
    name: i.name,
    email: i.email,
    role: i.role,
    invitedAt: i.createdAt,
    expiresAt: i.expiresAt,
  }));

  return <TeamPageClient members={members} pendingInvites={pendingInvites} />;
}
