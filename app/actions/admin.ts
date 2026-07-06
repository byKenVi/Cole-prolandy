"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { WalletTransactionType } from "@prisma/client";
import { applyWalletTransaction } from "@/lib/domain/wallet";
import { refundLeadMatch } from "@/lib/domain/leads";
import { createAndDistributeLead } from "@/lib/services/lead-intake";
import { requireAdmin } from "@/lib/auth";
import { DomainError } from "@/lib/domain/errors";

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

// ── Wallet management (manual add / refund) ──
const AdjustSchema = z.object({
  contractorId: z.string().min(1),
  amountCents: z.number().int().refine((n) => n !== 0, "Amount cannot be zero"),
  type: z.enum(["ADMIN_ADJUST", "REFUND"]),
  reason: z.string().min(1, "A reason is required"),
});

export async function adjustWallet(input: {
  contractorId: string;
  amountCents: number;
  type: "ADMIN_ADJUST" | "REFUND";
  reason: string;
}): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = AdjustSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
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
          phone: data.phone,
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
        phone: data.phone,
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
