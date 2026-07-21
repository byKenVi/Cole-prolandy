"use server";

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { refundLeadMatch } from "@/lib/domain/leads";
import { chargeContractorSavedCard } from "@/lib/services/recharge";
import { createAndDistributeLead } from "@/lib/services/lead-intake";
import { requireAdmin } from "@/lib/auth";
import { DomainError } from "@/lib/domain/errors";
import { normalizePhoneForStorage } from "@/lib/phone";
import { ICON_KEYS, ICON_AUTO, ICON_NONE } from "@/lib/project-icons";
import { revalidateAdminShell, revalidateContractorShell } from "@/lib/revalidate";
import { sendContractorAccountInvitation } from "@/lib/contractor-invitations";

type Result = { ok: true; message?: string } | { ok: false; message: string };

// ── Pricing matrix ──
export async function updatePriceTier(id: string, priceCents: number): Promise<Result> {
  await requireAdmin();
  if (!Number.isInteger(priceCents) || priceCents < 0) {
    return { ok: false, message: "Price must be a positive whole number of cents." };
  }
  const before = await prisma.priceTier.findUnique({ where: { id } });
  if (!before) return { ok: false, message: "Price tier not found." };

  await prisma.priceTier.update({ where: { id }, data: { priceCents } });
  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      action: "PRICE_TIER_UPDATED",
      targetType: "PriceTier",
      targetId: id,
      metadata: { from: before.priceCents, to: priceCents },
    },
  });
  revalidatePath("/admin/pricing");
  return { ok: true, message: "Saved" };
}

// ── Settings ──
const SettingSchema = z.discriminatedUnion("key", [
  z.object({
    key: z.literal("maxLeadRecipients"),
    value: z.coerce.number().int().min(1).max(100),
  }),
  z.object({
    key: z.literal("leadExpiryHours"),
    value: z.coerce.number().int().min(1).max(8760),
  }),
  z.object({
    key: z.literal("defaultLeadTier"),
    value: z.coerce.number().int().min(1).max(3),
  }),
]);

export async function updateSetting(key: string, value: number): Promise<Result> {
  await requireAdmin();
  const parsed = SettingSchema.safeParse({ key, value });
  if (!parsed.success) {
    return { ok: false, message: "Value must be a whole number of at least 1." };
  }
  await prisma.appSetting.upsert({
    where: { key: parsed.data.key },
    update: { value: String(parsed.data.value) },
    create: { key: parsed.data.key, value: String(parsed.data.value) },
  });
  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      action: "SETTING_UPDATED",
      targetType: "AppSetting",
      targetId: parsed.data.key,
      metadata: { value: parsed.data.value },
    },
  });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Saved" };
}

// ── Lead restitution (restore charge to contractor wallet) ──

export async function refundLead(leadMatchId: string, reason: string): Promise<Result> {
  const admin = await requireAdmin();
  try {
    const res = await refundLeadMatch({ leadMatchId, reason, actorId: admin.email });
    revalidatePath("/admin/leads");
    revalidatePath("/admin/contractors");
    revalidateAdminShell();
    revalidateContractorShell();
    return { ok: true, message: `Restored ${res.refundedCents} cents to wallet` };
  } catch (e) {
    return { ok: false, message: e instanceof DomainError ? e.message : "Restore failed." };
  }
}

// ── Charge the contractor's SAVED card & top up their wallet (off-session) ──

export async function chargeSavedCardTopUp(input: {
  contractorId: string;
  amountCents: number;
  reason: string;
}): Promise<Result> {
  const admin = await requireAdmin();
  if (!input.reason?.trim()) {
    return { ok: false, message: "A reason is required." };
  }
  const res = await chargeContractorSavedCard({
    contractorId: input.contractorId,
    amountCents: input.amountCents,
    actor: { type: "admin", id: admin.email, reason: input.reason },
  });
  if (!res.ok) {
    return { ok: false, message: res.message };
  }
  revalidatePath(`/admin/contractors/${input.contractorId}`);
  revalidateAdminShell();
  revalidateContractorShell();
  return {
    ok: true,
    message: res.mocked
      ? `Saved card charged. ${res.message}`
      : "Payment submitted — the wallet credits once the card payment confirms.",
  };
}

// ── Contractor soft-deactivate / hard-delete ──

/** Soft-archive (deactivate): blocks login + lead distribution. Preserves wallet
 * balance, WalletTransactions, LeadMatches, and AuditLog — never hard-deletes. */
export async function deactivateContractor(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const contractor = await prisma.contractor.findUnique({
    where: { id },
    select: { id: true, name: true, deactivatedAt: true },
  });
  if (!contractor) return { ok: false, message: "Contractor not found." };
  if (contractor.deactivatedAt) {
    return { ok: false, message: "Contractor is already deactivated." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.contractor.update({
      where: { id },
      data: { deactivatedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorType: "admin",
        actorId: admin.email,
        action: "contractor.deactivated.admin",
        targetType: "Contractor",
        targetId: id,
        metadata: { name: contractor.name },
      },
    });
  });
  revalidatePath("/admin/contractors");
  revalidatePath(`/admin/contractors/${id}`);
  return { ok: true, message: "Contractor deactivated" };
}

export async function reactivateContractor(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const contractor = await prisma.contractor.findUnique({
    where: { id },
    select: { id: true, name: true, deactivatedAt: true },
  });
  if (!contractor) return { ok: false, message: "Contractor not found." };
  if (!contractor.deactivatedAt) {
    return { ok: false, message: "Contractor is already active." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.contractor.update({
      where: { id },
      data: { deactivatedAt: null },
    });
    await tx.auditLog.create({
      data: {
        actorType: "admin",
        actorId: admin.email,
        action: "contractor.reactivated.admin",
        targetType: "Contractor",
        targetId: id,
        metadata: { name: contractor.name },
      },
    });
  });
  revalidatePath("/admin/contractors");
  revalidatePath(`/admin/contractors/${id}`);
  return { ok: true, message: "Contractor reactivated" };
}

/**
 * Hard delete — only for empty contractors with zero financial, match, or audit
 * history. Anything with history must use deactivateContractor (archive) so
 * wallet balance, WalletTransactions, LeadMatches, and AuditLog stay intact.
 * Prisma cascades would otherwise destroy lead matches + wallet rows.
 */
export async function deleteContractor(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const contractor = await prisma.contractor.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      walletBalanceCents: true,
      _count: { select: { walletTransactions: true, leadMatches: true } },
    },
  });
  if (!contractor) return { ok: false, message: "Contractor not found." };

  if (contractor.walletBalanceCents !== 0) {
    return {
      ok: false,
      message:
        "This contractor still has a wallet balance. Archive (deactivate) instead to preserve history.",
    };
  }
  if (contractor._count.leadMatches > 0) {
    return {
      ok: false,
      message:
        "This contractor has associated leads. Archive (deactivate) instead to preserve history.",
    };
  }
  if (contractor._count.walletTransactions > 0) {
    return {
      ok: false,
      message:
        "This contractor has wallet history (top-ups, charges or refunds), so it can't be deleted. Archive (deactivate) instead.",
    };
  }

  const auditCount = await prisma.auditLog.count({
    where: { targetType: "Contractor", targetId: id },
  });
  if (auditCount > 0) {
    return {
      ok: false,
      message:
        "This contractor has audit history, so it can't be deleted. Archive (deactivate) instead.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.contractor.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        actorType: "admin",
        actorId: admin.email,
        action: "contractor.deleted.admin",
        targetType: "Contractor",
        targetId: id,
        metadata: { name: contractor.name },
      },
    });
  });
  revalidatePath("/admin/contractors");
  return { ok: true, message: "Contractor deleted" };
}

// ── Lead edit / delete ──
const LeadEditSchema = z.object({
  landownerName: z.string().min(2, "Landowner name is required"),
  landownerEmail: z.string().email("A valid email is required"),
  landownerPhone: z.string().min(7, "A valid phone number is required"),
  propertyLocation: z.string().min(2, "Property location is required"),
});

export async function updateLead(
  id: string,
  input: {
    landownerName: string;
    landownerEmail: string;
    landownerPhone: string;
    propertyLocation: string;
  },
): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = LeadEditSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const lead = await prisma.lead.findUnique({ where: { id }, select: { id: true } });
  if (!lead) return { ok: false, message: "Lead not found." };

  // Only landowner contact + location are editable. Project/tier/price are NOT
  // editable here — the price is snapshotted at creation and money must not move.
  await prisma.lead.update({ where: { id }, data: parsed.data });
  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: admin.email,
      action: "lead.updated.admin",
      targetType: "Lead",
      targetId: id,
      metadata: { ...parsed.data },
    },
  });
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${id}`);
  return { ok: true, message: "Lead updated" };
}

export async function deleteLead(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      matches: { select: { id: true, status: true } },
      _count: { select: { matches: true } },
    },
  });
  if (!lead) return { ok: false, message: "Lead not found." };

  // Hard-delete cascades LeadMatches (and unlinks wallet rows). Never destroy
  // distribution history once matches exist — including pending/expired/declined.
  if (lead._count.matches > 0) {
    const accepted = lead.matches.some((m) => m.status === "ACCEPTED");
    return {
      ok: false,
      message: accepted
        ? "This lead has match history and an accepted match with wallet charges, so it can't be deleted. Leave it in place to preserve the audit trail."
        : "This lead has match history (pending, declined, or expired). Deleting would destroy those records — leave the lead in place to preserve the trail.",
    };
  }

  const linkedWalletTx = await prisma.walletTransaction.count({
    where: { leadMatch: { leadId: id } },
  });
  if (linkedWalletTx > 0) {
    return {
      ok: false,
      message:
        "This lead is linked to wallet transactions, so it can't be deleted. Leave it in place to preserve financial history.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.lead.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        actorType: "admin",
        actorId: admin.email,
        action: "lead.deleted.admin",
        targetType: "Lead",
        targetId: id,
      },
    });
  });
  revalidatePath("/admin/leads");
  return { ok: true, message: "Lead deleted" };
}

// ── Categories (ContractorType) CRUD ──
// `icon` stores an icon key (base filename in /public/icons), or the sentinels
// "auto" (keyword match) / "none" (no icon). Empty string is normalized to
// "auto". See lib/project-icons.ts for how it is resolved.
const ALLOWED_ICONS = [...ICON_KEYS, ICON_AUTO, ICON_NONE] as const;
const IconSchema = z
  .string()
  .trim()
  .transform((v) => (v === "" ? ICON_AUTO : v))
  .refine((v) => (ALLOWED_ICONS as readonly string[]).includes(v), "Invalid icon")
  .optional();
const ContractorTypeSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  icon: IconSchema,
});
const CreateContractorTypeSchema = ContractorTypeSchema.extend({
  tierPricesCents: z.tuple([
    z.number().int().min(100).max(1_000_000),
    z.number().int().min(100).max(1_000_000),
    z.number().int().min(100).max(1_000_000),
  ]),
});

export async function createContractorType(
  name: string,
  icon: string | undefined,
  tierPricesCents: [number, number, number],
): Promise<Result & { id?: string }> {
  const admin = await requireAdmin();
  const parsed = CreateContractorTypeSchema.safeParse({ name, icon, tierPricesCents });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid project" };
  }
  const clean = parsed.data.name;
  const iconValue = parsed.data.icon ?? ICON_AUTO;
  const existing = await prisma.contractorType.findUnique({ where: { name: clean }, select: { id: true } });
  if (existing) return { ok: false, message: "A project with this name already exists." };

  const created = await prisma.$transaction(async (tx) => {
    const project = await tx.contractorType.create({
      data: { name: clean, icon: iconValue },
      select: { id: true },
    });
    const pt = await tx.projectType.create({
      data: { name: clean, contractorTypeId: project.id },
      select: { id: true },
    });
    for (let tier = 1; tier <= 3; tier++) {
      await tx.priceTier.create({
        data: {
          contractorTypeId: project.id,
          projectTypeId: pt.id,
          tier,
          priceCents: parsed.data.tierPricesCents[tier - 1]!,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorType: "admin",
        actorId: admin.email,
        action: "project.created.admin",
        targetType: "ContractorType",
        targetId: project.id,
        metadata: {
          name: clean,
          icon: iconValue,
          tierPricesCents: parsed.data.tierPricesCents,
        },
      },
    });
    return project;
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/pricing");
  revalidatePath("/admin/leads/new");
  return { ok: true, message: "Project added", id: created.id };
}

export async function updateContractorType(id: string, name: string, icon?: string): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = ContractorTypeSchema.safeParse({ name, icon });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid name" };
  }
  const clean = parsed.data.name;
  const current = await prisma.contractorType.findUnique({ where: { id }, select: { name: true, icon: true } });
  if (!current) return { ok: false, message: "Category not found." };

  const owner = await prisma.contractorType.findUnique({ where: { name: clean }, select: { id: true } });
  if (owner && owner.id !== id) {
    return { ok: false, message: "Another project already uses this name." };
  }

  // If no icon arg was supplied, preserve the existing one (rename-only path).
  const iconValue = parsed.data.icon ?? current.icon ?? ICON_AUTO;

  // Keep the 1:1 ProjectType name in sync — UI only exposes the project level.
  await prisma.$transaction(async (tx) => {
    await tx.contractorType.update({ where: { id }, data: { name: clean, icon: iconValue } });
    await tx.projectType.update({
      where: { contractorTypeId: id },
      data: { name: clean },
    });
  });
  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: admin.email,
      action: "project.updated.admin",
      targetType: "ContractorType",
      targetId: id,
      metadata: { from: current.name, to: clean, icon: iconValue },
    },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/pricing");
  revalidatePath("/admin/leads/new");
  return { ok: true, message: "Project saved" };
}

export async function deleteContractorType(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const ct = await prisma.contractorType.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          contractors: true,
          assignedContractors: true,
        },
      },
      projectType: {
        select: { id: true, _count: { select: { leads: true } } },
      },
    },
  });
  if (!ct) return { ok: false, message: "Project not found." };

  const leadCount = ct.projectType?._count.leads ?? 0;
  const assigned = ct._count.assignedContractors + ct._count.contractors;
  // Block while in use so we never orphan contractors or leads.
  if (assigned > 0 || leadCount > 0) {
    return {
      ok: false,
      message: `Can't delete "${ct.name}" — it still has ${ct._count.assignedContractors || ct._count.contractors} contractor assignment(s) and ${leadCount} lead(s). Reassign those first.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    // Price tiers reference both records, so remove them before the project.
    await tx.priceTier.deleteMany({ where: { contractorTypeId: id } });
    await tx.projectType.deleteMany({ where: { contractorTypeId: id } });
    await tx.contractorType.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        actorType: "admin",
        actorId: admin.email,
        action: "project.deleted.admin",
        targetType: "ContractorType",
        targetId: id,
        metadata: { name: ct.name },
      },
    });
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/pricing");
  revalidatePath("/admin/leads/new");
  return { ok: true, message: "Project deleted" };
}

// ── Land types CRUD ──
const LandTypeSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
});

export async function createLandType(name: string): Promise<Result & { id?: string }> {
  const admin = await requireAdmin();
  const parsed = LandTypeSchema.safeParse({ name });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid name" };
  }
  const clean = parsed.data.name;
  const existing = await prisma.landType.findUnique({ where: { name: clean }, select: { id: true } });
  if (existing) return { ok: false, message: "A land type with this name already exists." };

  const created = await prisma.landType.create({ data: { name: clean }, select: { id: true } });
  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: admin.email,
      action: "landType.created.admin",
      targetType: "LandType",
      targetId: created.id,
      metadata: { name: clean },
    },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/leads/new");
  return { ok: true, message: "Land type added", id: created.id };
}

export async function updateLandType(id: string, name: string): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = LandTypeSchema.safeParse({ name });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid name" };
  }
  const clean = parsed.data.name;
  const current = await prisma.landType.findUnique({ where: { id }, select: { name: true } });
  if (!current) return { ok: false, message: "Land type not found." };

  const owner = await prisma.landType.findUnique({ where: { name: clean }, select: { id: true } });
  if (owner && owner.id !== id) {
    return { ok: false, message: "Another land type already uses this name." };
  }

  await prisma.landType.update({ where: { id }, data: { name: clean } });
  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: admin.email,
      action: "landType.updated.admin",
      targetType: "LandType",
      targetId: id,
      metadata: { from: current.name, to: clean },
    },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/leads/new");
  return { ok: true, message: "Land type saved" };
}

export async function deleteLandType(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const lt = await prisma.landType.findUnique({
    where: { id },
    select: { id: true, name: true, _count: { select: { leads: true } } },
  });
  if (!lt) return { ok: false, message: "Land type not found." };
  if (lt._count.leads > 0) {
    return {
      ok: false,
      message: `Can't delete "${lt.name}" — ${lt._count.leads} lead(s) still reference it.`,
    };
  }

  await prisma.landType.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: admin.email,
      action: "landType.deleted.admin",
      targetType: "LandType",
      targetId: id,
      metadata: { name: lt.name },
    },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/leads/new");
  return { ok: true, message: "Land type deleted" };
}

// ── Contractor creation / editing (admin-driven, no Clerk account required) ──
// Contractors may have multiple projects; assignment is admin-controlled.
// Default: multi-project, admin-only.
const ContractorSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("A valid email is required"),
  phone: z.string().min(7, "A valid phone number is required"),
  /** Assigned projects (ContractorType ids). At least one required. */
  projectIds: z.array(z.string().min(1)).min(1, "Assign at least one project"),
  aboutSection: z.string().max(1000).optional().or(z.literal("")),
  businessHours: z.string().max(280).optional().or(z.literal("")),
  isPro: z.boolean().default(false),
});

export type ContractorInput = z.infer<typeof ContractorSchema>;

async function validProjectIds(projectIds: string[]): Promise<string[]> {
  const unique = Array.from(new Set(projectIds.filter(Boolean)));
  if (unique.length === 0) return [];
  const rows = await prisma.contractorType.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function syncContractorProjects(
  tx: Prisma.TransactionClient,
  contractorId: string,
  projectIds: string[],
  primaryProjectId: string,
) {
  await tx.contractorProject.deleteMany({ where: { contractorId } });
  for (const contractorTypeId of projectIds) {
    await tx.contractorProject.create({
      data: { contractorId, contractorTypeId },
    });
  }
  await tx.contractor.update({
    where: { id: contractorId },
    data: { contractorTypeId: primaryProjectId },
  });
}

export async function createContractor(
  input: ContractorInput,
): Promise<Result & { contractorId?: string }> {
  const admin = await requireAdmin();
  const parsed = ContractorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  const email = data.email.trim().toLowerCase();
  // E.164 so first-login matching by verified phone works regardless of format.
  const phone = normalizePhoneForStorage(data.phone);

  const existing = await prisma.contractor.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { ok: false, message: "A contractor with this email already exists." };
  }

  const projectIds = await validProjectIds(data.projectIds);
  if (projectIds.length === 0) {
    return { ok: false, message: "Assign at least one valid project." };
  }
  const primaryProjectId = projectIds[0]!;

  try {
    const contractor = await prisma.$transaction(async (tx) => {
      // clerkUserId intentionally omitted (null): contractor is usable for
      // leads + wallet immediately, and will be claimed on first sign-in.
      const created = await tx.contractor.create({
        data: {
          email,
          name: data.name,
          phone,
          contractorTypeId: primaryProjectId,
          aboutSection: data.aboutSection || null,
          businessHours: data.businessHours || null,
          isPro: data.isPro,
          projects: {
            create: projectIds.map((contractorTypeId) => ({ contractorTypeId })),
          },
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: admin.email,
          action: "contractor.created.admin",
          targetType: "Contractor",
          targetId: created.id,
          metadata: { email, name: data.name, projectIds },
        },
      });
      return created;
    });

    const invitation = await sendContractorAccountInvitation({
      name: data.name,
      email,
    });
    if (!invitation.ok) {
      console.error("[contractor.create] Account invitation failed", {
        contractorId: contractor.id,
        error: invitation.error,
      });
      return {
        ok: true,
        message: "Contractor created, but the invitation failed. Retry it from the contractor list.",
        contractorId: contractor.id,
      };
    }

    try {
      await prisma.auditLog.create({
        data: {
          actorType: "system",
          action: "contractor.invitation.sent",
          targetType: "Contractor",
          targetId: contractor.id,
          metadata: { email, provider: invitation.provider },
        },
      });
    } catch (auditError) {
      console.error("[contractor.create] Invitation audit failed", auditError);
    }
    revalidatePath("/admin/contractors");
    return {
      ok: true,
      message: "Contractor created and invitation sent",
      contractorId: contractor.id,
    };
  } catch {
    return { ok: false, message: "Could not create contractor. The email may already be in use." };
  }
}

export async function resendContractorInvitation(contractorId: string): Promise<Result> {
  const admin = await requireAdmin();
  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: { id: true, name: true, email: true, clerkUserId: true, deactivatedAt: true },
  });
  if (!contractor) return { ok: false, message: "Contractor not found." };
  if (contractor.deactivatedAt) return { ok: false, message: "Reactivate this contractor first." };
  if (contractor.clerkUserId) return { ok: false, message: "This contractor has already signed in." };

  const invitation = await sendContractorAccountInvitation(contractor);
  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: admin.email,
      action: invitation.ok ? "contractor.invitation.resent" : "contractor.invitation.failed",
      targetType: "Contractor",
      targetId: contractor.id,
      metadata: invitation.ok ? { email: contractor.email } : { error: invitation.error },
    },
  });
  if (!invitation.ok) return { ok: false, message: "Invitation failed. Check Clerk configuration." };
  revalidatePath("/admin/contractors");
  return { ok: true, message: "Invitation sent." };
}

export async function updateContractor(id: string, input: ContractorInput): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = ContractorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  const email = data.email.trim().toLowerCase();
  const phone = normalizePhoneForStorage(data.phone);

  const current = await prisma.contractor.findUnique({ where: { id }, select: { id: true } });
  if (!current) return { ok: false, message: "Contractor not found." };

  // Prevent stealing another contractor's email.
  const emailOwner = await prisma.contractor.findUnique({ where: { email }, select: { id: true } });
  if (emailOwner && emailOwner.id !== id) {
    return { ok: false, message: "Another contractor already uses this email." };
  }

  const projectIds = await validProjectIds(data.projectIds);
  if (projectIds.length === 0) {
    return { ok: false, message: "Assign at least one valid project." };
  }
  const primaryProjectId = projectIds[0]!;

  await prisma.$transaction(async (tx) => {
    await tx.contractor.update({
      where: { id },
      data: {
        email,
        name: data.name,
        phone,
        aboutSection: data.aboutSection || null,
        businessHours: data.businessHours || null,
        isPro: data.isPro,
      },
    });
    await syncContractorProjects(tx, id, projectIds, primaryProjectId);
    await tx.auditLog.create({
      data: {
        actorType: "admin",
        actorId: admin.email,
        action: "contractor.updated.admin",
        targetType: "Contractor",
        targetId: id,
        metadata: { email, name: data.name, projectIds },
      },
    });
  });

  revalidatePath("/admin/contractors");
  revalidatePath(`/admin/contractors/${id}`);
  return { ok: true, message: "Contractor updated" };
}

// ── Manual lead creation ──
const ManualLeadSchema = z.object({
  landownerName: z.string().min(2),
  landownerEmail: z.string().email(),
  landownerPhone: z.string().min(7),
  propertyLocation: z.string().min(2),
  projectTypeId: z.string().min(1),
  tier: z.coerce.number().int().min(1).max(3),
  landTypeId: z.string().optional().or(z.literal("")),
});

export async function createManualLead(input: {
  landownerName: string;
  landownerEmail: string;
  landownerPhone: string;
  propertyLocation: string;
  projectTypeId: string;
  tier: number;
  landTypeId?: string;
}): Promise<Result & { leadId?: string; recipients?: number }> {
  await requireAdmin();
  const parsed = ManualLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const res = await createAndDistributeLead({
      ...parsed.data,
      landTypeId: parsed.data.landTypeId || null,
      source: "admin_manual",
    });
    revalidatePath("/admin/leads");
    return {
      ok: true,
      message: `Lead created and sent to ${res.recipients} contractor(s).`,
      leadId: res.leadId,
      recipients: res.recipients,
    };
  } catch (e) {
    return { ok: false, message: e instanceof DomainError ? e.message : "Failed to create lead." };
  }
}
