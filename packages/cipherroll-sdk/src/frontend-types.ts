export type CiphertextHandle = `0x${string}`;

export type PermitBundle = {
  issuer: string;
  contractAddress: string;
  chainId: number;
  signature: string;
  issuedAt: string;
};

export type AuditorSharingPermitView = {
  hash: string;
  name: string;
  issuer: string;
  recipient: string;
  expiration: number;
  validatorId: number;
  validatorContract: string;
  exportPayload: string;
};

export type AuditorRecipientPermitView = {
  hash: string;
  name: string;
  issuer: string;
  recipient: string;
  expiration: number;
  validatorId: number;
  validatorContract: string;
};

export type TreasuryAdapterConfig = {
  adapter: string;
  routeId: string;
  adapterId: string;
  adapterName: string;
  supportsConfidentialSettlement: boolean;
  settlementAsset: string;
  confidentialSettlementAsset: string;
  availablePayrollFunds: string;
  reservedPayrollFunds: string;
};

export type OrganizationView = {
  admin: string;
  treasuryAdapter: string;
  metadataHash: string;
  treasuryRouteId: string;
  reservedAdminSlots: number;
  reservedQuorum: number;
  createdAt: number;
  updatedAt: number;
  exists: boolean;
};

export type AdminBudgetSummaryHandle = {
  budget: CiphertextHandle;
  committed: CiphertextHandle;
  available: CiphertextHandle;
};

export type OrganizationInsightsView = {
  totalPayrollItems: number;
  activePayrollItems: number;
  claimedPayrollItems: number;
  vestingPayrollItems: number;
  employeeRecipients: number;
  lastIssuedAt: number;
  lastClaimedAt: number;
};

export type AuditorOrganizationSummaryView = {
  treasuryRouteConfigured: boolean;
  supportsConfidentialSettlement: boolean;
  settlementAsset: string;
  confidentialSettlementAsset: string;
  availableTreasuryFunds: string;
  reservedTreasuryFunds: string;
  totalPayrollRuns: number;
  draftPayrollRuns: number;
  fundedPayrollRuns: number;
  activePayrollRuns: number;
  finalizedPayrollRuns: number;
  totalPayrollItems: number;
  activePayrollItems: number;
  claimedPayrollItems: number;
  vestingPayrollItems: number;
  employeeRecipients: number;
  lastIssuedAt: number;
  lastClaimedAt: number;
};

export type AuditorAggregateDisclosureMetric =
  | "budget"
  | "committed"
  | "available";

export type AuditorEvidenceMode = "verify" | "publish";

export type AuditorEvidenceReceiptView = {
  orgId: string;
  metric: AuditorAggregateDisclosureMetric;
  mode: AuditorEvidenceMode;
  cleartextValue: string;
  txHash: string;
  ctHash: string;
};

export type AuditorBatchEvidenceReceiptView = {
  orgId: string;
  metrics: AuditorAggregateDisclosureMetric[];
  mode: AuditorEvidenceMode;
  cleartextValues: Record<AuditorAggregateDisclosureMetric, string>;
  txHash: string;
  ctHashes: Record<AuditorAggregateDisclosureMetric, string>;
};

export type PayrollRunView = {
  orgId: string;
  settlementAssetId: string;
  fundingDeadline: number;
  plannedHeadcount: number;
  allocationCount: number;
  claimedCount: number;
  createdAt: number;
  fundedAt: number;
  activatedAt: number;
  finalizedAt: number;
  status: number;
  exists: boolean;
};

export type PayrollAllocationMetaView = {
  employee: string;
  paymentId: string;
  memoHash: string;
  createdAt: number;
  isVesting: boolean;
  vestingStart: number;
  vestingEnd: number;
  exists: boolean;
};

export type PayrollSettlementRequestView = {
  requestId: string;
  payoutAsset: string;
  confidentialAsset: string;
  requestedAt: number;
  exists: boolean;
};

export type PayrollAllocationHandle = {
  paymentId: string;
  memoHash: string;
  createdAt: number;
  handle: CiphertextHandle;
};

export type EmployeePayrollView = {
  paymentId: string;
  memoHash: string;
  createdAt: number;
  amount: string | null;
  handle: CiphertextHandle;
  isClaimed: boolean;
  isVesting: boolean;
  vestingStart: number;
  vestingEnd: number;
  payrollRunId: string | null;
  payrollRunStatus: number | null;
  settlementRequestId: string | null;
  settlementRequestedAt: number | null;
  settlementPayoutAsset: string | null;
  confidentialSettlementAsset: string | null;
};
