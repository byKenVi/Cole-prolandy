export type ContractorSyncProfileField =
  | "name"
  | "email"
  | "phone"
  | "aboutSection"
  | "businessHours"
  | "contractorCategory"
  | "projects";

export const PROTECTED_CONTRACTOR_FIELDS = [
  "walletBalanceCents",
  "stripeCustomerId",
  "stripeDefaultPaymentMethodId",
  "cardBrand",
  "cardLast4",
  "cardExpMonth",
  "cardExpYear",
  "clerkUserId",
  "isPro",
  "walletTransactions",
  "leadMatches",
  "pricingSnapshots",
  "promoHistory",
  "refundHistory",
  "auditLogs",
] as const;

export type NormalizedContractorSyncRecord = {
  source: string;
  externalId: string;
  profile?: {
    name?: string;
    email?: string;
    phone?: string;
    aboutSection?: string | null;
    businessHours?: string | null;
  };
  contractorCategoryCode?: string;
  projectTypeCodes?: string[];
};

export type ContractorSyncOwnershipPolicy = {
  allowCreate: boolean;
  writableProfileFields: readonly ContractorSyncProfileField[];
};

export const DENY_ALL_CONTRACTOR_SYNC_POLICY: ContractorSyncOwnershipPolicy = {
  allowCreate: false,
  writableProfileFields: [],
};

/**
 * A future provider adapter may only translate documented external data into
 * the normalized record. It must not write Landy's Pro models directly.
 */
export interface ContractorSyncProvider<ExternalRecord> {
  readonly source: string;
  normalize(record: ExternalRecord): Promise<NormalizedContractorSyncRecord>;
}

export type ContractorSyncStatus =
  | "created"
  | "updated"
  | "unchanged"
  | "unresolved";

export type ContractorSyncResult = {
  status: ContractorSyncStatus;
  source: string;
  externalId: string;
  contractorId?: string;
  dryRun: boolean;
  changes: readonly ContractorSyncProfileField[];
  reasons: string[];
};
