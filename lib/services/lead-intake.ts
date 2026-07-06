import { prisma } from "@/lib/prisma";
import { LeadStatus } from "@prisma/client";
import { resolvePrice } from "@/lib/domain/pricing";
import { distributeLead } from "@/lib/domain/leads";
import { getLeadExpiryHours } from "@/lib/domain/settings";
import { notifyNewLead } from "@/lib/notifications";
import { NotFoundError } from "@/lib/domain/errors";

export type LeadIntakeInput = {
  landownerName: string;
  landownerEmail: string;
  landownerPhone: string;
  propertyLocation: string;
  projectTypeId: string;
  tier: number;
  landTypeId?: string | null;
  source?: string;
};

export type LeadIntakeResult = {
  leadId: string;
  priceCents: number;
  recipients: number;
};

/**
 * The core intake pipeline shared by the Wix estimate endpoint and admin manual
 * lead creation:
 *   1) snapshot price from the PriceTier matrix (business rule 4)
 *   2) create the Lead with an expiry
 *   3) distributeLead() → LeadMatches up to maxLeadRecipients (shared leads)
 *   4) fire SMS + email notifications (mocked) to each matched contractor
 */
export async function createAndDistributeLead(
  input: LeadIntakeInput,
): Promise<LeadIntakeResult> {
  const projectType = await prisma.projectType.findUnique({
    where: { id: input.projectTypeId },
    select: { id: true, name: true, contractorTypeId: true },
  });
  if (!projectType) throw new NotFoundError("Project type");

  const priceCents = await resolvePrice(prisma, {
    contractorTypeId: projectType.contractorTypeId,
    projectTypeId: projectType.id,
    tier: input.tier,
  });

  const expiryHours = await getLeadExpiryHours(prisma);
  const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000);

  const lead = await prisma.lead.create({
    data: {
      landownerName: input.landownerName,
      landownerEmail: input.landownerEmail,
      landownerPhone: input.landownerPhone,
      propertyLocation: input.propertyLocation,
      projectTypeId: projectType.id,
      landTypeId: input.landTypeId ?? null,
      tier: input.tier,
      priceCents,
      status: LeadStatus.NEW,
      source: input.source ?? "wix_form",
      expiresAt,
    },
  });

  const { matches } = await distributeLead(prisma, lead.id);

  await Promise.allSettled(
    matches.map((m) =>
      notifyNewLead({
        contractor: m.contractor,
        acceptToken: m.acceptToken,
        projectTypeName: projectType.name,
        propertyLocation: lead.propertyLocation,
        tier: lead.tier,
        priceCents: lead.priceCents,
      }),
    ),
  );

  await prisma.auditLog.create({
    data: {
      actorType: "system",
      action: "LEAD_CREATED",
      targetType: "Lead",
      targetId: lead.id,
      metadata: { source: lead.source, recipients: matches.length, priceCents },
    },
  });

  return { leadId: lead.id, priceCents, recipients: matches.length };
}
