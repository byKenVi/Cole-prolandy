"use server";

import { z } from "zod";
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
const SettingSchema = z.object({
  key: z.enum(["maxLeadRecipients", "leadExpiryHours"]),
  value: z.coerce.number().int().min(1),
});

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

export async function createContractorType(name: string, icon?: string): Promise<Result & { id?: string }> {
  const admin = await requireAdmin();
  const parsed = ContractorTypeSchema.safeParse({ name, icon });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid name" };
  }
  const clean = parsed.data.name;
  const iconValue = parsed.data.icon ?? ICON_AUTO;
  const existing = await prisma.contractorType.findUnique({ where: { name: clean }, select: { id: true } });
  if (existing) return { ok: false, message: "A project with this name already exists." };

  const created = await prisma.contractorType.create({
    data: { name: clean, icon: iconValue },
    select: { id: true },
  });

  // Every project is 1:1 with a selectable ProjectType + exactly 3 tiers.
  // Admins never manage a nested project-type level.
  const { DEFAULT_PROJECT_PRICES } = await import("@/lib/catalog");
  const pt = await prisma.projectType.create({
    data: { name: clean, contractorTypeId: created.id },
    select: { id: true },
  });
  await prisma.service.create({
    data: { name: clean, contractorTypeId: created.id },
  });
  for (let tier = 1; tier <= 3; tier++) {
    await prisma.priceTier.create({
      data: {
        contractorTypeId: created.id,
        projectTypeId: pt.id,
        tier,
        priceCents: DEFAULT_PROJECT_PRICES[tier - 1]! * 100,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: admin.email,
      action: "project.created.admin",
      targetType: "ContractorType",
      targetId: created.id,
      metadata: { name: clean, icon: iconValue },
    },
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
    const projects = await tx.projectType.findMany({
      where: { contractorTypeId: id },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });
    if (projects.length === 1) {
      await tx.projectType.update({
        where: { id: projects[0]!.id },
        data: { name: clean },
      });
    } else if (projects.length > 1) {
      // Collapse extras: rename primary, leave cleanup to flatten script if needed.
      const primary =
        projects.find((p) => p.name === current.name) ?? projects[0]!;
      await tx.projectType.update({ where: { id: primary.id }, data: { name: clean } });
    }
    await tx.service.updateMany({
      where: { contractorTypeId: id, name: current.name },
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
      _count: { select: { contractors: true } },
      projectTypes: {
        select: { id: true, _count: { select: { leads: true } } },
      },
    },
  });
  if (!ct) return { ok: false, message: "Project not found." };

  const leadCount = ct.projectTypes.reduce((sum, p) => sum + p._count.leads, 0);
  // Block while in use so we never orphan contractors or leads.
  if (ct._count.contractors > 0 || leadCount > 0) {
    return {
      ok: false,
      message: `Can't delete "${ct.name}" — it still has ${ct._count.contractors} contractor(s) and ${leadCount} lead(s). Reassign those first.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    // Cascade the 1:1 shadow project type + its three tiers + services.
    await tx.priceTier.deleteMany({ where: { contractorTypeId: id } });
    await tx.projectType.deleteMany({ where: { contractorTypeId: id } });
    await tx.service.deleteMany({ where: { contractorTypeId: id } });
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
const ContractorSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("A valid email is required"),
  phone: z.string().min(7, "A valid phone number is required"),
  contractorTypeId: z.string().min(1, "Choose a trade"),
  aboutSection: z.string().max(1000).optional().or(z.literal("")),
  businessHours: z.string().max(280).optional().or(z.literal("")),
  serviceIds: z.array(z.string()).default([]),
  isPro: z.boolean().default(false),
});

export type ContractorInput = z.infer<typeof ContractorSchema>;

async function validServiceIds(contractorTypeId: string, serviceIds: string[]): Promise<string[]> {
  if (serviceIds.length === 0) return [];
  const rows = await prisma.service.findMany({
    where: { id: { in: serviceIds }, contractorTypeId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
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

  const svcIds = await validServiceIds(data.contractorTypeId, data.serviceIds);

  try {
    const contractor = await prisma.$transaction(async (tx) => {
      // clerkUserId intentionally omitted (null): contractor is usable for
      // leads + wallet immediately, and will be claimed on first sign-in.
      const created = await tx.contractor.create({
        data: {
          email,
          name: data.name,
          phone,
          contractorTypeId: data.contractorTypeId,
          aboutSection: data.aboutSection || null,
          businessHours: data.businessHours || null,
          isPro: data.isPro,
          services: { create: svcIds.map((serviceId) => ({ serviceId })) },
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
          metadata: { email, name: data.name },
        },
      });
      return created;
    });
    revalidatePath("/admin/contractors");
    return { ok: true, message: "Contractor created", contractorId: contractor.id };
  } catch {
    return { ok: false, message: "Could not create contractor. The email may already be in use." };
  }
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

  const svcIds = await validServiceIds(data.contractorTypeId, data.serviceIds);

  await prisma.$transaction(async (tx) => {
    await tx.contractor.update({
      where: { id },
      data: {
        email,
        name: data.name,
        phone,
        contractorTypeId: data.contractorTypeId,
        aboutSection: data.aboutSection || null,
        businessHours: data.businessHours || null,
        isPro: data.isPro,
      },
    });
    await tx.contractorService.deleteMany({ where: { contractorId: id } });
    for (const serviceId of svcIds) {
      await tx.contractorService.create({ data: { contractorId: id, serviceId } });
    }
    await tx.auditLog.create({
      data: {
        actorType: "admin",
        actorId: admin.email,
        action: "contractor.updated.admin",
        targetType: "Contractor",
        targetId: id,
        metadata: { email, name: data.name },
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
