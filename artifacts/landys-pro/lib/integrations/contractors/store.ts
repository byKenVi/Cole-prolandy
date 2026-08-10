import type { ContractorSyncProfileField } from "./contract";

export type StoredContractorSyncView = {
  contractorId: string;
  deactivated: boolean;
  name: string;
  email: string;
  phone: string;
  aboutSection: string | null;
  businessHours: string | null;
  contractorCategoryCode: string | null;
  projectTypeCodes: string[];
  lastPayloadHash: string | null;
};

export type ResolvedContractorTaxonomies = {
  contractorCategoryId?: string;
  contractorCategoryCode?: string;
  projects?: Array<{
    projectTypeCode: string;
    contractorTypeId: string;
  }>;
  unresolvedCodes: string[];
};

export type ContractorSyncWrite = {
  source: string;
  externalId: string;
  payloadHash: string;
  profile: {
    name: string;
    email: string;
    phone: string;
    aboutSection: string | null;
    businessHours: string | null;
  };
  contractorCategoryId: string;
  contractorCategoryCode: string;
  projects: Array<{
    projectTypeCode: string;
    contractorTypeId: string;
  }>;
  changes: ContractorSyncProfileField[];
};

export interface ContractorSyncStore {
  findByExternalIdentity(
    source: string,
    externalId: string,
  ): Promise<StoredContractorSyncView | null>;
  resolveTaxonomies(
    contractorCategoryCode: string | undefined,
    projectTypeCodes: readonly string[] | undefined,
  ): Promise<ResolvedContractorTaxonomies>;
  createContractor(write: ContractorSyncWrite): Promise<{ contractorId: string }>;
  updateContractor(
    contractorId: string,
    write: ContractorSyncWrite,
  ): Promise<{ contractorId: string }>;
}
