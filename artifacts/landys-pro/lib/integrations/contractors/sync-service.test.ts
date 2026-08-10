import { describe, expect, it } from "vitest";
import type { ContractorSyncOwnershipPolicy } from "./contract";
import type {
  ContractorSyncStore,
  ContractorSyncWrite,
  ResolvedContractorTaxonomies,
  StoredContractorSyncView,
} from "./store";
import { syncContractor } from "./sync-service";

const FULL_POLICY: ContractorSyncOwnershipPolicy = {
  allowCreate: true,
  writableProfileFields: [
    "name",
    "email",
    "phone",
    "aboutSection",
    "businessHours",
    "contractorCategory",
    "projects",
  ],
};

const RECORD = {
  source: "directory",
  externalId: "external-1",
  profile: {
    name: "Safe Contractor",
    email: "safe@example.com",
    phone: "5125550100",
  },
  contractorCategoryCode: "builders",
  projectTypeCodes: ["cabin-construction"],
};

class MemoryStore implements ContractorSyncStore {
  identities = new Map<string, StoredContractorSyncView>();
  createCount = 0;
  updateCount = 0;
  failUpdates = false;

  key(source: string, externalId: string) {
    return `${source}:${externalId}`;
  }

  async findByExternalIdentity(source: string, externalId: string) {
    return this.identities.get(this.key(source, externalId)) ?? null;
  }

  async resolveTaxonomies(
    contractorCategoryCode: string | undefined,
    projectTypeCodes: readonly string[] | undefined,
  ): Promise<ResolvedContractorTaxonomies> {
    const validCategory = contractorCategoryCode === "builders";
    const validProjects = (projectTypeCodes ?? []).filter(
      (code) => code === "cabin-construction",
    );
    return {
      contractorCategoryId: validCategory ? "category-builders" : undefined,
      contractorCategoryCode: validCategory ? "builders" : undefined,
      projects: validProjects.map((code) => ({
        projectTypeCode: code,
        contractorTypeId: "routing-cabin",
      })),
      unresolvedCodes: [
        ...(!validCategory && contractorCategoryCode ? [contractorCategoryCode] : []),
        ...(projectTypeCodes ?? []).filter((code) => !validProjects.includes(code)),
      ],
    };
  }

  async createContractor(write: ContractorSyncWrite) {
    this.createCount += 1;
    const contractorId = "contractor-1";
    this.identities.set(this.key(write.source, write.externalId), {
      contractorId,
      deactivated: false,
      ...write.profile,
      contractorCategoryCode: write.contractorCategoryCode,
      projectTypeCodes: write.projects.map((project) => project.projectTypeCode),
      lastPayloadHash: write.payloadHash,
    });
    return { contractorId };
  }

  async updateContractor(contractorId: string, write: ContractorSyncWrite) {
    this.updateCount += 1;
    if (this.failUpdates) throw new Error("simulated transaction rollback");
    this.identities.set(this.key(write.source, write.externalId), {
      contractorId,
      deactivated: false,
      ...write.profile,
      contractorCategoryCode: write.contractorCategoryCode,
      projectTypeCodes: write.projects.map((project) => project.projectTypeCode),
      lastPayloadHash: write.payloadHash,
    });
    return { contractorId };
  }
}

describe("provider-neutral contractor synchronization", () => {
  it("defaults to dry-run and makes no writes", async () => {
    const store = new MemoryStore();

    await expect(syncContractor(store, RECORD, FULL_POLICY)).resolves.toMatchObject({
      status: "created",
      dryRun: true,
    });
    expect(store.createCount).toBe(0);
    expect(store.identities.size).toBe(0);
  });

  it("creates once and treats an identical replay as unchanged", async () => {
    const store = new MemoryStore();

    const first = await syncContractor(store, RECORD, FULL_POLICY, { dryRun: false });
    const replay = await syncContractor(store, RECORD, FULL_POLICY, { dryRun: false });

    expect(first).toMatchObject({ status: "created", contractorId: "contractor-1" });
    expect(replay).toMatchObject({ status: "unchanged", contractorId: "contractor-1" });
    expect(store.createCount).toBe(1);
    expect(store.updateCount).toBe(0);
  });

  it("updates only explicitly owned profile fields and ignores protected input", async () => {
    const store = new MemoryStore();
    await syncContractor(store, RECORD, FULL_POLICY, { dryRun: false });
    const unsafeRecord = {
      ...RECORD,
      profile: { ...RECORD.profile, name: "Renamed Contractor" },
      walletBalanceCents: 999_999,
      clerkUserId: "external-user",
    };

    const result = await syncContractor(
      store,
      unsafeRecord,
      { allowCreate: false, writableProfileFields: ["name"] },
      { dryRun: false },
    );

    expect(result).toMatchObject({ status: "updated", changes: ["name"] });
    expect(store.identities.get("directory:external-1")?.name).toBe(
      "Renamed Contractor",
    );
    expect(store.updateCount).toBe(1);
  });

  it("returns unresolved for incomplete creates and unknown taxonomies", async () => {
    const store = new MemoryStore();
    const incomplete = await syncContractor(
      store,
      { source: "directory", externalId: "missing" },
      FULL_POLICY,
      { dryRun: false },
    );
    const unknown = await syncContractor(
      store,
      { ...RECORD, projectTypeCodes: ["unknown-project"] },
      FULL_POLICY,
      { dryRun: false },
    );

    expect(incomplete.status).toBe("unresolved");
    expect(unknown).toMatchObject({ status: "unresolved" });
    expect(unknown.reasons[0]).toContain("unknown-project");
    expect(store.createCount).toBe(0);
  });

  it("holds deactivated contractors for administrative review", async () => {
    const store = new MemoryStore();
    store.identities.set("directory:external-1", {
      contractorId: "contractor-1",
      deactivated: true,
      name: "Safe Contractor",
      email: "safe@example.com",
      phone: "+15125550100",
      aboutSection: null,
      businessHours: null,
      contractorCategoryCode: "builders",
      projectTypeCodes: ["cabin-construction"],
      lastPayloadHash: null,
    });

    const result = await syncContractor(store, RECORD, FULL_POLICY, { dryRun: false });

    expect(result.status).toBe("unresolved");
    expect(result.reasons[0]).toContain("deactivated");
    expect(store.updateCount).toBe(0);
  });

  it("does not publish a partial update when the store transaction fails", async () => {
    const store = new MemoryStore();
    await syncContractor(store, RECORD, FULL_POLICY, { dryRun: false });
    const before = store.identities.get("directory:external-1");
    store.failUpdates = true;

    await expect(
      syncContractor(
        store,
        { ...RECORD, profile: { ...RECORD.profile, name: "Should Roll Back" } },
        FULL_POLICY,
        { dryRun: false },
      ),
    ).rejects.toThrow("simulated transaction rollback");
    expect(store.identities.get("directory:external-1")).toEqual(before);
  });
});
