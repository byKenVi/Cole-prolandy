"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOwner, getSession } from "@/lib/auth";
import { email } from "@/lib/integrations/email";
import { buildAdminInviteEmail } from "@/lib/emails/admin-invite";
import { appUrl } from "@/lib/app-url";

type Result<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; message: string };

const INVITE_TTL_DAYS = 7;

function inviteToken(): string {
  return randomBytes(32).toString("hex");
}

// ── Invite ────────────────────────────────────────────────────────────────────

export async function inviteAdmin(data: {
  name: string;
  email: string;
  role: "OWNER" | "ADMIN";
}): Promise<Result> {
  const session = await requireOwner();
  const normalizedEmail = data.email.trim().toLowerCase();

  // 1. Check for existing active admin with that email.
  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, disabledAt: true },
  });
  if (existingAdmin && !existingAdmin.disabledAt) {
    return { ok: false, message: "An active administrator with this email already exists." };
  }

  // 2. Check for an unexpired pending invite.
  const existingInvite = await prisma.adminInvite.findFirst({
    where: {
      email: normalizedEmail,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (existingInvite) {
    return { ok: false, message: "A pending invitation for this email already exists." };
  }

  // 3. Create the invite.
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  const token = inviteToken();
  await prisma.adminInvite.create({
    data: {
      email: normalizedEmail,
      name: data.name.trim(),
      role: data.role,
      token,
      status: "PENDING",
      expiresAt,
      invitedById: session.adminUserId ?? undefined,
    },
  });

  // 4. Resolve inviter name.
  const inviterName = session.adminUserId
    ? ((await prisma.adminUser.findUnique({
        where: { id: session.adminUserId },
        select: { name: true },
      }))?.name ?? "An administrator")
    : "An administrator";

  // 5. Send the email.
  const inviteUrl = `${appUrl()}/admin/invite?token=${token}`;
  const emailContent = buildAdminInviteEmail({
    inviteeName: data.name.trim(),
    inviterName,
    role: data.role,
    inviteUrl,
    expiresAt,
  });

  const sendResult = await email.send({
    to: normalizedEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  });

  // Log audit — include email result note.
  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: session.userId ?? undefined,
      action: "ADMIN_INVITED",
      targetType: "AdminInvite",
      metadata: {
        email: normalizedEmail,
        name: data.name.trim(),
        role: data.role,
        emailSent: sendResult.ok,
        emailError: sendResult.ok ? undefined : sendResult.error,
      },
    },
  });

  revalidatePath("/admin/team");
  return {
    ok: true,
    message: sendResult.ok
      ? `Invitation sent to ${normalizedEmail}`
      : `Invite created but email failed: ${sendResult.error}`,
  };
}

// ── Resend invitation ─────────────────────────────────────────────────────────

export async function resendInvite(inviteId: string): Promise<Result> {
  const session = await requireOwner();

  const invite = await prisma.adminInvite.findUnique({ where: { id: inviteId } });
  if (!invite) return { ok: false, message: "Invitation not found." };
  if (invite.status !== "PENDING") {
    return { ok: false, message: "Only pending invitations can be resent." };
  }

  // Create a fresh token and extend expiry.
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);
  const token = inviteToken();

  await prisma.adminInvite.update({
    where: { id: inviteId },
    data: { token, expiresAt },
  });

  // Resolve inviter name.
  const inviterName = session.adminUserId
    ? ((await prisma.adminUser.findUnique({
        where: { id: session.adminUserId },
        select: { name: true },
      }))?.name ?? "An administrator")
    : "An administrator";

  const inviteUrl = `${appUrl()}/admin/invite?token=${token}`;
  const emailContent = buildAdminInviteEmail({
    inviteeName: invite.name,
    inviterName,
    role: invite.role,
    inviteUrl,
    expiresAt,
  });

  const sendResult = await email.send({
    to: invite.email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  });

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: session.userId ?? undefined,
      action: "ADMIN_INVITE_RESENT",
      targetType: "AdminInvite",
      targetId: inviteId,
      metadata: { email: invite.email, emailSent: sendResult.ok },
    },
  });

  revalidatePath("/admin/team");
  return { ok: true, message: sendResult.ok ? "Invitation resent." : `Resent but email failed: ${sendResult.error}` };
}

// ── Revoke invitation ─────────────────────────────────────────────────────────

export async function revokeInvite(inviteId: string): Promise<Result> {
  const session = await requireOwner();

  const invite = await prisma.adminInvite.findUnique({ where: { id: inviteId } });
  if (!invite) return { ok: false, message: "Invitation not found." };
  if (invite.status !== "PENDING") {
    return { ok: false, message: "Only pending invitations can be revoked." };
  }

  await prisma.adminInvite.update({
    where: { id: inviteId },
    data: { status: "REVOKED" },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: session.userId ?? undefined,
      action: "ADMIN_INVITE_REVOKED",
      targetType: "AdminInvite",
      targetId: inviteId,
      metadata: { email: invite.email },
    },
  });

  revalidatePath("/admin/team");
  return { ok: true };
}

// ── Disable / enable admin ────────────────────────────────────────────────────

export async function disableAdmin(adminUserId: string): Promise<Result> {
  const session = await requireOwner();
  if (adminUserId === session.adminUserId) {
    return { ok: false, message: "You cannot disable your own account." };
  }

  const target = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (!target) return { ok: false, message: "Administrator not found." };
  if (target.disabledAt) return { ok: false, message: "Administrator is already disabled." };

  await prisma.adminUser.update({
    where: { id: adminUserId },
    data: { disabledAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: session.userId ?? undefined,
      action: "ADMIN_DISABLED",
      targetType: "AdminUser",
      targetId: adminUserId,
      metadata: { email: target.email },
    },
  });

  revalidatePath("/admin/team");
  return { ok: true };
}

export async function enableAdmin(adminUserId: string): Promise<Result> {
  const session = await requireOwner();

  const target = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (!target) return { ok: false, message: "Administrator not found." };
  if (!target.disabledAt) return { ok: false, message: "Administrator is already active." };

  await prisma.adminUser.update({
    where: { id: adminUserId },
    data: { disabledAt: null },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: session.userId ?? undefined,
      action: "ADMIN_ENABLED",
      targetType: "AdminUser",
      targetId: adminUserId,
      metadata: { email: target.email },
    },
  });

  revalidatePath("/admin/team");
  return { ok: true };
}

// ── Change role ───────────────────────────────────────────────────────────────

export async function changeAdminRole(
  adminUserId: string,
  newRole: "OWNER" | "ADMIN",
): Promise<Result> {
  const session = await requireOwner();
  if (adminUserId === session.adminUserId) {
    return { ok: false, message: "You cannot change your own role." };
  }

  const target = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (!target) return { ok: false, message: "Administrator not found." };

  await prisma.adminUser.update({
    where: { id: adminUserId },
    data: { role: newRole },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: session.userId ?? undefined,
      action: "ADMIN_ROLE_CHANGED",
      targetType: "AdminUser",
      targetId: adminUserId,
      metadata: { email: target.email, from: target.role, to: newRole },
    },
  });

  revalidatePath("/admin/team");
  return { ok: true };
}

// ── Remove admin ──────────────────────────────────────────────────────────────

export async function removeAdmin(adminUserId: string): Promise<Result> {
  const session = await requireOwner();
  if (adminUserId === session.adminUserId) {
    return { ok: false, message: "You cannot remove your own account." };
  }

  const target = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (!target) return { ok: false, message: "Administrator not found." };

  await prisma.adminUser.delete({ where: { id: adminUserId } });

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: session.userId ?? undefined,
      action: "ADMIN_REMOVED",
      targetType: "AdminUser",
      targetId: adminUserId,
      metadata: { email: target.email, name: target.name },
    },
  });

  revalidatePath("/admin/team");
  return { ok: true };
}

// ── Accept invitation (called from the invite acceptance page) ────────────────

export async function acceptInvitation(token: string): Promise<Result> {
  const session = await getSession();
  if (!session.userId || !session.email) {
    return { ok: false, message: "You must be signed in to accept an invitation." };
  }

  const invite = await prisma.adminInvite.findUnique({ where: { token } });
  if (!invite) return { ok: false, message: "Invalid invitation link." };
  if (invite.status !== "PENDING") {
    return {
      ok: false,
      message:
        invite.status === "ACCEPTED"
          ? "This invitation has already been accepted."
          : invite.status === "EXPIRED"
            ? "This invitation has expired."
            : "This invitation has been revoked.",
    };
  }
  if (invite.expiresAt < new Date()) {
    await prisma.adminInvite.update({ where: { token }, data: { status: "EXPIRED" } });
    return { ok: false, message: "This invitation has expired." };
  }

  // Email check — the signed-in user must match the invitation email.
  const signedInEmail = session.email.toLowerCase();
  if (signedInEmail !== invite.email.toLowerCase()) {
    return {
      ok: false,
      message: `This invitation was sent to ${invite.email}. Please sign in with that email address.`,
    };
  }

  // Create or update AdminUser.
  await prisma.adminUser.upsert({
    where: { email: invite.email.toLowerCase() },
    create: {
      email: invite.email.toLowerCase(),
      name: invite.name,
      role: invite.role,
      clerkUserId: session.userId,
      invitedById: invite.invitedById ?? undefined,
      lastLoginAt: new Date(),
    },
    update: {
      name: invite.name,
      role: invite.role,
      clerkUserId: session.userId,
      disabledAt: null, // re-enable if previously disabled
      lastLoginAt: new Date(),
    },
  });

  // Mark invite as accepted.
  await prisma.adminInvite.update({
    where: { token },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: session.userId,
      action: "ADMIN_INVITE_ACCEPTED",
      targetType: "AdminInvite",
      targetId: invite.id,
      metadata: { email: invite.email, role: invite.role },
    },
  });

  return { ok: true, message: "Invitation accepted. Welcome to the team!" };
}
