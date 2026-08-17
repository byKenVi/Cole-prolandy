import { createHash } from "node:crypto";
import { normalizePhoneForStorage } from "@/lib/phone";
import type {
  ContractorSyncOwnershipPolicy,
  ContractorSyncProfileField,
  ContractorSyncResult,
  NormalizedContractorSyncRecord,
} from "./contract";
import type {
  ContractorSyncStore,
  ContractorSyncWrite,
  StoredContractorSyncView,
} from "./store";

const SOURCE_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

function unresolved(
  record: Pick<NormalizedContractorSyncRecord, "source" | "externalId">,
  dryRun: boolean,
  reasons: string[],
): ContractorSyncResult {
  return {
    status: "unresolved",
    source: record.source,
    externalId: record.externalId,
    dryRun,
    changes: [],
    reasons,
  };
}

function canonicalRecord(record: NormalizedContractorSyncRecord) {
  return {
    source: record.source.trim().toLowerCase(),
    externalId: record.externalId.trim(),
    profile: record.profile
      ? {
          name: record.profile.name?.trim(),
          email: record.profile.email?.trim().toLowerCase(),
          phone: record.profile.phone
            ? normalizePhoneForStorage(record.profile.phone)
            : undefined,
          aboutSection:
            record.profile.aboutSection === undefined
              ? undefined
              : record.profile.aboutSection?.trim() || null,
          businessHours:
            record.profile.businessHours === undefined
              ? undefined
              : record.profile.businessHours?.trim() || null,
        }
      : undefined,
    contractorCategoryCode: record.contractorCategoryCode?.trim().toLowerCase(),
    projectTypeCodes: record.projectTypeCodes
      ? [...new Set(record.projectTypeCodes.map((code) => code.trim().toLowerCase()))].sort()
      : undefined,
  };
}

export function contractorSyncPayloadHash(record: NormalizedContractorSyncRecord): string {
  return createHash("sha256").update(JSON.stringify(canonicalRecord(record))).digest("hex");
}

function sorted(values: readonly string[]) {
  return [...values].sort();
}

function sameStrings(left: readonly string[], right: readonly string[]) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

export async function syncContractor(
  store: ContractorSyncStore,
  input: NormalizedContractorSyncRecord,
  policy: ContractorSyncOwnershipPolicy,
  options: { dryRun?: boolean } = {},
): Promise<ContractorSyncResult> {
  const dryRun = options.dryRun ?? true;
  const record = canonicalRecord(input);
  const reasons: string[] = [];

  if (!SOURCE_RE.test(record.source)) reasons.push("Invalid source identifier.");
  if (!record.externalId) reasons.push("External contractor ID is required.");
  if (reasons.length > 0) return unresolved(record, dryRun, reasons);

  const writable = new Set(policy.writableProfileFields);
  const existing = await store.findByExternalIdentity(record.source, record.externalId);

  if (!existing && !policy.allowCreate) {
    return unresolved(record, dryRun, [
      "External identity is not mapped and contractor creation is disabled by policy.",
    ]);
  }

  const target = existing
    ? {
        name: existing.name,
        email: existing.email,
        phone: existing.phone,
        aboutSection: existing.aboutSection,
        businessHours: existing.businessHours,
        contractorCategoryCode: existing.contractorCategoryCode,
        projectTypeCodes: existing.projectTypeCodes,
      }
    : {
        name: "",
        email: "",
        phone: "",
        aboutSection: null,
        businessHours: null,
        contractorCategoryCode: null,
        projectTypeCodes: [] as string[],
      };

  const changes: ContractorSyncProfileField[] = [];
  const assign = <K extends "name" | "email" | "phone" | "aboutSection" | "businessHours">(
    field: K,
    value: typeof target[K] | undefined,
  ) => {
    if (!writable.has(field) || value === undefined || target[field] === value) return;
    target[field] = value;
    changes.push(field);
  };

  assign("name", record.profile?.name);
  assign("email", record.profile?.email);
  assign("phone", record.profile?.phone);
  assign("aboutSection", record.profile?.aboutSection);
  assign("businessHours", record.profile?.businessHours);

  if (
    writable.has("contractorCategory") &&
    record.contractorCategoryCode !== undefined &&
    target.contractorCategoryCode !== record.contractorCategoryCode
  ) {
    target.contractorCategoryCode = record.contractorCategoryCode;
    changes.push("contractorCategory");
  }

  if (
    writable.has("projects") &&
    record.projectTypeCodes !== undefined &&
    !sameStrings(target.projectTypeCodes, record.projectTypeCodes)
  ) {
    target.projectTypeCodes = record.projectTypeCodes;
    changes.push("projects");
  }

  if (!target.name) reasons.push("A contractor name is required for creation.");
  if (!target.email) reasons.push("A contractor email is required for creation.");
  if (!target.phone) reasons.push("A contractor phone is required for creation.");
  if (!target.contractorCategoryCode) reasons.push("An active contractor category is required.");
  if (target.projectTypeCodes.length === 0) {
    reasons.push("At least one active project type is required.");
  }
  if (!existing) {
    for (const required of [
      "name",
      "email",
      "phone",
      "contractorCategory",
      "projects",
    ] as const) {
      if (!writable.has(required)) {
        reasons.push(`Creation policy must explicitly own ${required}.`);
      }
    }
  }
  if (reasons.length > 0) return unresolved(record, dryRun, [...new Set(reasons)]);

  const taxonomy = await store.resolveTaxonomies(
    target.contractorCategoryCode ?? undefined,
    target.projectTypeCodes,
  );
  if (
    taxonomy.unresolvedCodes.length > 0 ||
    !taxonomy.contractorCategoryId ||
    !taxonomy.contractorCategoryCode ||
    !taxonomy.projects ||
    taxonomy.projects.length === 0
  ) {
    return unresolved(record, dryRun, [
      ...taxonomy.unresolvedCodes.map((code) => `Unknown or archived taxonomy code: ${code}`),
      ...(!taxonomy.contractorCategoryId ? ["Contractor category could not be resolved."] : []),
      ...(!taxonomy.projects?.length ? ["Project types could not be resolved."] : []),
    ]);
  }

  const payloadHash = contractorSyncPayloadHash(input);
  if (existing && changes.length === 0) {
    return {
      status: "unchanged",
      source: record.source,
      externalId: record.externalId,
      contractorId: existing.contractorId,
      dryRun,
      changes,
      reasons: [],
    };
  }

  const write: ContractorSyncWrite = {
    source: record.source,
    externalId: record.externalId,
    payloadHash,
    profile: {
      name: target.name,
      email: target.email,
      phone: target.phone,
      aboutSection: target.aboutSection,
      businessHours: target.businessHours,
    },
    contractorCategoryId: taxonomy.contractorCategoryId,
    contractorCategoryCode: taxonomy.contractorCategoryCode,
    projects: taxonomy.projects,
    changes,
  };

  if (dryRun) {
    return {
      status: existing ? "updated" : "created",
      source: record.source,
      externalId: record.externalId,
      contractorId: existing?.contractorId,
      dryRun: true,
      changes,
      reasons: [],
    };
  }

  const saved = existing
    ? await store.updateContractor(existing.contractorId, write)
    : await store.createContractor(write);

  return {
    status: existing ? "updated" : "created",
    source: record.source,
    externalId: record.externalId,
    contractorId: saved.contractorId,
    dryRun: false,
    changes,
    reasons: [],
  };
}

export type { StoredContractorSyncView };
