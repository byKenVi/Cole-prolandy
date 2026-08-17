import type { DbClient } from "@/lib/domain/types";
import { prisma } from "@/lib/prisma";

export type ContractorIdResolution = {
  externalId: string;
  usedDeprecatedAlias: boolean;
  aliasType?: "contractorId" | "proPortalId";
};

/**
 * Resolve Wix contractor references. Canonical identity is Wix `_id`.
 * Deprecated aliases (contractorId, proPortalId) are resolved in one place.
 */
export async function resolveWixContractorExternalId(
  db: DbClient,
  rawId: string,
): Promise<ContractorIdResolution> {
  const trimmed = rawId.trim();
  const uuidLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);

  if (uuidLike) {
    return { externalId: trimmed, usedDeprecatedAlias: false };
  }

  const identities = await db.externalContractorIdentity.findMany({
    where: { source: "wix" },
    select: { externalId: true, sourceMetadata: true },
  });

  for (const identity of identities) {
    const meta = identity.sourceMetadata as Record<string, unknown> | null;
    if (!meta) continue;
    if (meta.contractorId === trimmed) {
      await writeAliasAudit(identity.externalId, "contractorId", trimmed);
      return {
        externalId: identity.externalId,
        usedDeprecatedAlias: true,
        aliasType: "contractorId",
      };
    }
    if (meta.proPortalId === trimmed) {
      await writeAliasAudit(identity.externalId, "proPortalId", trimmed);
      return {
        externalId: identity.externalId,
        usedDeprecatedAlias: true,
        aliasType: "proPortalId",
      };
    }
  }

  return { externalId: trimmed, usedDeprecatedAlias: false };
}

async function writeAliasAudit(
  canonicalId: string,
  aliasType: string,
  aliasValue: string,
) {
  await prisma.auditLog.create({
    data: {
      actorType: "system",
      action: "wix.contractor_id.deprecated_alias",
      targetType: "ExternalContractorIdentity",
      targetId: canonicalId,
      metadata: { aliasType, aliasValue },
    },
  });
}
