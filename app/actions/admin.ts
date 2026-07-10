"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { WalletTransactionType } from "@prisma/client";
import { applyWalletTransaction } from "@/lib/domain/wallet";
import { refundLeadMatch } from "@/lib/domain/leads";
import { chargeContractorSavedCard } from "@/lib/services/recharge";
import { refundTopUpToCard, returnRealBalanceToCard } from "@/lib/services/card-refund";
import { createAndDistributeLead } from "@/lib/services/lead-intake";
import { requireAdmin } from "@/lib/auth";
import { DomainError } from "@/lib/domain/errors";
import { normalizePhoneForStorage } from "@/lib/phone";
import { ICON_KEYS, ICON_AUTO, ICON_NONE } from "@/lib/project-icons";

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

// ── Wallet management (refund / promo credit / correcting deduct) ──
//
// Real spendable money enters a wallet ONLY through the contractor's own card
// (Stripe top-up, credited by the verified webhook). The admin can never mint
// generic "funds" that imply a payment happened. The admin wallet actions are
// three DISTINCT, explicitly-labeled transaction types — never conflated:
//   • REFUND        — positive credit returning money the contractor actually
//                     paid (e.g. a bad lead). Traceable to a reason.
//   • PROMO_CREDIT  — positive, admin-granted PROMOTIONAL balance. Spendable,
//                     but NOT real money and NOT "funds" — a separate type so a
//                     balance's origin is always visible.
//   • ADMIN_ADJUST  — NEGATIVE correction only (fix a mistake / claw back).
// A positive ADMIN_ADJUST (money-from-nothing) is rejected here.
const AdjustSchema = z.object({
  contractorId: z.string().min(1),
  amountCents: z.number().int().refine((n) => n !== 0, "Amount cannot be zero"),
  type: z.enum(["ADMIN_ADJUST", "REFUND", "PROMO_CREDIT"]),
  reason: z.string().min(1, "A reason is required"),
});

export async function adjustWallet(input: {
  contractorId: string;
  amountCents: number;
  type: "ADMIN_ADJUST" | "REFUND" | "PROMO_CREDIT";
  reason: string;
}): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = AdjustSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { type, amountCents } = parsed.data;
  // Enforce honest money logic:
  //   - credits (REFUND / PROMO_CREDIT) must be positive
  //   - ADMIN_ADJUST is a deduct-only correction; it can never add balance
  if (type === "ADMIN_ADJUST" && amountCents > 0) {
    return {
      ok: false,
      message:
        "Admin cannot add spendable funds. Real money enters only through the contractor's own card. Use Refund (money they paid) or Promo credit (labeled promotional balance); use Deduct only to correct a balance.",
    };
  }
  if ((type === "REFUND" || type === "PROMO_CREDIT") && amountCents < 0) {
    return { ok: false, message: "A credit must be a positive amount." };
  }

  try {
    await applyWalletTransaction({
      contractorId: parsed.data.contractorId,
      amountCents: parsed.data.amountCents,
      type: parsed.data.type as WalletTransactionType,
      note: parsed.data.reason,
    });
    await prisma.auditLog.create({
      data: {
        actorType: "admin",
        actorId: admin.email,
        action: "WALLET_ADJUSTED",
        targetType: "Contractor",
        targetId: parsed.data.contractorId,
        metadata: {
          amountCents: parsed.data.amountCents,
          type: parsed.data.type,
          reason: parsed.data.reason,
        },
      },
    });
    revalidatePath(`/admin/contractors/${parsed.data.contractorId}`);
    return { ok: true, message: "Wallet updated" };
  } catch (e) {
    return { ok: false, message: e instanceof DomainError ? e.message : "Failed to adjust wallet." };
  }
}

export async function refundLead(leadMatchId: string, reason: string): Promise<Result> {
  const admin = await requireAdmin();
  try {
    const res = await refundLeadMatch({ leadMatchId, reason, actorId: admin.email });
    revalidatePath("/admin/leads");
    revalidatePath("/admin/contractors");
    return { ok: true, message: `Refunded ${res.refundedCents} cents` };
  } catch (e) {
    return { ok: false, message: e instanceof DomainError ? e.message : "Refund failed." };
  }
}

// ── Charge the contractor's SAVED card & top up their wallet (off-session) ──
//
// This charges the CONTRACTOR's own saved card (their money, not the admin's)
// and credits their wallet via the webhook (real) / shared mock credit path
// (mock). It is DISTINCT from Refund / Promo credit / Deduct — it moves real
// money IN from the contractor's card. Only usable when a card is on file.
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
  return {
    ok: true,
    message: res.mocked
      ? `Saved card charged. ${res.message}`
      : "Payment submitted — the wallet credits once the card payment confirms.",
  };
}

// ── Real refund to the contractor's card (Stripe) — DEBITS the wallet ──
//
// Sends real money BACK to the contractor's card and reduces their wallet by the
// same amount (never below zero; promo credit is never refundable). Distinct
// from the internal lead REFUND (which CREDITS the wallet).
export async function refundTopUpToCardAction(input: {
  contractorId: string;
  walletTransactionId: string;
  reason: string;
}): Promise<Result> {
  const admin = await requireAdmin();
  if (!input.reason?.trim()) {
    return { ok: false, message: "A reason is required." };
  }
  const res = await refundTopUpToCard({
    contractorId: input.contractorId,
    walletTransactionId: input.walletTransactionId,
    actorId: admin.email,
    reason: input.reason,
  });
  if (!res.ok) return { ok: false, message: res.message };
  revalidatePath(`/admin/contractors/${input.contractorId}`);
  return { ok: true, message: res.message };
}

export async function returnRealBalanceToCardAction(input: {
  contractorId: string;
  reason: string;
}): Promise<Result> {
  const admin = await requireAdmin();
  if (!input.reason?.trim()) {
    return { ok: false, message: "A reason is required." };
  }
  const res = await returnRealBalanceToCard({
    contractorId: input.contractorId,
    actorId: admin.email,
    reason: input.reason,
  });
  if (!res.ok) return { ok: false, message: res.message };
  revalidatePath(`/admin/contractors/${input.contractorId}`);
  return { ok: true, message: res.message };
}

// ── Contractor soft-deactivate / hard-delete ──

/** Soft-deactivate: blocks login + lead distribution, keeps money/lead history. */
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
 * Hard delete — only when there is no wallet balance, no lead associations, and
 * no wallet history. Prefer deactivateContractor for anything with history.
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

  if (contractor.walletBalanceCents > 0) {
    return {
      ok: false,
      message:
        "This contractor still has an active wallet balance. Deactivate instead, or clear the balance first.",
    };
  }
  if (contractor._count.leadMatches > 0) {
    return {
      ok: false,
      message:
        "This contractor has associated leads. Deactivate instead to preserve history.",
    };
  }
  if (contractor._count.walletTransactions > 0) {
    return {
      ok: false,
      message:
        "This contractor has wallet history (top-ups, charges or refunds), so it can't be deleted. Deactivate instead.",
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
    select: { id: true, matches: { select: { status: true } } },
  });
  if (!lead) return { ok: false, message: "Lead not found." };

  // Preserve money + audit integrity: a lead with an accepted match has a wallet
  // charge behind it. Block deletion so the charge/refund records stay intact.
  if (lead.matches.some((m) => m.status === "ACCEPTED")) {
    return {
      ok: false,
      message:
        "This lead has an accepted match with a wallet charge, so it can't be deleted. Refund the match first if it was a mistake.",
    };
  }

  await prisma.$transaction(async (tx) => {
    // Cascades pending/declined/expired matches (no money attached).
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
  if (existing) return { ok: false, message: "A category with this name already exists." };

  const created = await prisma.contractorType.create({
    data: { name: clean, icon: iconValue },
    select: { id: true },
  });
  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: admin.email,
      action: "category.created.admin",
      targetType: "ContractorType",
      targetId: created.id,
      metadata: { name: clean, icon: iconValue },
    },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/pricing");
  return { ok: true, message: "Category added", id: created.id };
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
    return { ok: false, message: "Another category already uses this name." };
  }

  // If no icon arg was supplied, preserve the existing one (rename-only path).
  const iconValue = parsed.data.icon ?? current.icon ?? ICON_AUTO;

  // Renaming is safe: leads, pricing and contractors reference the category by
  // id, not name, so existing data stays intact.
  await prisma.contractorType.update({ where: { id }, data: { name: clean, icon: iconValue } });
  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: admin.email,
      action: "category.updated.admin",
      targetType: "ContractorType",
      targetId: id,
      metadata: { from: current.name, to: clean, icon: iconValue },
    },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/pricing");
  return { ok: true, message: "Category saved" };
}

export async function deleteContractorType(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const ct = await prisma.contractorType.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: { select: { contractors: true, projectTypes: true } },
    },
  });
  if (!ct) return { ok: false, message: "Category not found." };

  // Block deletion while anything still references it, so we never orphan
  // contractors, project types, pricing or leads.
  if (ct._count.contractors > 0 || ct._count.projectTypes > 0) {
    return {
      ok: false,
      message: `Can't delete "${ct.name}" — it still has ${ct._count.contractors} contractor(s) and ${ct._count.projectTypes} project type(s). Reassign or remove those first.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.contractorType.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        actorType: "admin",
        actorId: admin.email,
        action: "category.deleted.admin",
        targetType: "ContractorType",
        targetId: id,
        metadata: { name: ct.name },
      },
    });
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/pricing");
  return { ok: true, message: "Category deleted" };
}

// ── Contractor creation / editing (admin-driven, no Clerk account required) ──
const ContractorSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("A valid email is required"),
  phone: z.string().min(7, "A valid phone number is required"),
  contractorTypeId: z.string().min(1, "Choose a trade"),
  aboutSection: z.string().max(1000).optional().or(z.literal("")),
  businessHours: z.string().max(200).optional().or(z.literal("")),
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
