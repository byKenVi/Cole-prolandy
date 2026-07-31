"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOwner, getSession } from "@/lib/auth";
import { sendAdminInvitation, type InvitationResult } from "@/lib/contractor-invitations";
import { INVITE_TTL_DAYS } from "@/lib/admin-invites";

type Result<T = undefined> =
  | { ok: true; data?: T; message?: string; severity?: "success" | "warning" }
  | { ok: false; message: string };

function inviteToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Turn the delivery outcome into wording the inviter can act on. The invitation
 * row exists either way, so a delivery hiccup is a warning, never a failure —
 * but it must not be dressed up as a success.
 */
function deliveryFeedback(
  result: InvitationResult,
  email: string,
): { message: string; severity: "success" | "warning" } {
  if (!result.ok) {
    return {
      message: `Invitation saved, but the email could not be sent: ${result.error}`,
      severity: "warning",
    };
  }
  if (result.note === "existing-account") {
    return {
      message: `${email} already has an account. They get admin access the next time they sign in — no email needed.`,
      severity: "warning",
    };
  }
  if (result.note === "dev-no-email") {
    return {
      message: `Invitation created. No email in dev mode — accept it at ${result.inviteUrl}`,
      severity: "warning",
    };
  }
  return { message: `Invitation email sent to ${email}.`, severity: "success" };
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

  // 4. Send invitation via Clerk (same delivery as contractor invites — no custom domain needed).
  const sendResult = await sendAdminInvitation({
    email: normalizedEmail,
    name: data.name.trim(),
    token,
  });

  // Log audit — include send result.
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
        emailNote: sendResult.ok ? (sendResult.note ?? null) : undefined,
        emailError: sendResult.ok ? undefined : sendResult.error,
      },
    },
  });

  revalidatePath("/admin/team");
  return { ok: true, ...deliveryFeedback(sendResult, normalizedEmail) };
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

  // Re-send via Clerk using the refreshed token.
  const sendResult = await sendAdminInvitation({
    email: invite.email,
    name: invite.name,
    token,
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
  return { ok: true, ...deliveryFeedback(sendResult, invite.email) };
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
