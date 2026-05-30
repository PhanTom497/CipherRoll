export type IndexerStatus = {
  chainId: string;
  payrollAddress: string;
  auditorDisclosureAddress: string;
  governanceAddress: string;
  latestIndexedBlock: number;
  latestKnownBlock: number;
  lastSyncStartedAt: number | null;
  lastSyncFinishedAt: number | null;
  lastSyncError: string | null;
  organizations: number;
  payrollRuns: number;
  payments: number;
  auditReceipts: number;
  rawEvents: number;
  notifications: number;
};

export type OrganizationRecord = {
  orgId: string;
  admin: string;
  treasuryAdapter: string;
  metadataHash: string;
  treasuryRouteId: string;
  reservedAdminSlots: number;
  reservedQuorum: number;
  createdAt: number;
  updatedAt: number;
  exists: boolean;
  lastEventBlock: number;
  syncedAt: number;
};

export type OrganizationInsightsRecord = {
  orgId: string;
  totalPayrollItems: number;
  activePayrollItems: number;
  claimedPayrollItems: number;
  vestingPayrollItems: number;
  employeeRecipients: number;
  lastIssuedAt: number;
  lastClaimedAt: number;
  syncedAt: number;
};

export type TreasuryRouteRecord = {
  orgId: string;
  adapter: string;
  routeId: string;
  adapterId: string;
  adapterName: string;
  supportsConfidentialSettlement: boolean;
  settlementAsset: string;
  confidentialSettlementAsset: string;
  availablePayrollFunds: string;
  reservedPayrollFunds: string;
  syncedAt: number;
};

export type PayrollRunRecord = {
  payrollRunId: string;
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
  lastEventBlock: number;
  syncedAt: number;
};

export type PaymentRecord = {
  paymentId: string;
  orgId: string;
  employee: string;
  payrollRunId: string | null;
  issuedAt: number | null;
  claimedAt: number | null;
  settledAt: number | null;
  requestedAt: number | null;
  requestId: string | null;
  payoutAsset: string | null;
  confidentialAsset: string | null;
  isClaimed: boolean;
  lastEventBlock: number;
  syncedAt: number;
};

export type BatchPayrollManifestRecord = {
  id: string;
  orgId: string;
  payrollRunId: string;
  employee: string;
  roleSlug: string;
  roleLabel: string;
  paymentId: string;
  txHash: string;
  createdAt: number;
  updatedAt: number;
};

export type AuditReceiptRecord = {
  id: string;
  orgId: string;
  txHash: string;
  blockNumber: number;
  blockTimestamp: number;
  auditor: string;
  receiptKind: "single" | "batch";
  metric: string | null;
  cleartextValue: string | null;
  batchHash: string | null;
  published: boolean;
  contractAddress: string;
};

export type RawEventRecord = {
  id: string;
  chainId: string;
  contractAddress: string;
  blockNumber: number;
  blockTimestamp: number;
  transactionHash: string;
  logIndex: number;
  eventName: string;
  orgId: string | null;
  payrollRunId: string | null;
  paymentId: string | null;
  payloadJson: string;
};

export type NotificationRecord = {
  id: string;
  orgId: string | null;
  payrollRunId: string | null;
  paymentId: string | null;
  category: string;
  severity: "info" | "success" | "warning";
  title: string;
  detail: string;
  eventName: string;
  transactionHash: string;
  blockNumber: number;
  createdAt: number;
  metadataJson: string;
};

export type OrganizationReportSummary = {
  orgId: string;
  generatedAt: number;
  admin: string;
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
  totalPayments: number;
  claimedPayments: number;
  pendingClaims: number;
  pendingSettlementRequests: number;
  settledPayments: number;
  employeeRecipients: number;
  totalPayrollItems: number;
  activePayrollItems: number;
  claimedPayrollItems: number;
  vestingPayrollItems: number;
  lastIssuedAt: number;
  lastClaimedAt: number;
  latestRunCreatedAt: number | null;
  latestRunActivatedAt: number | null;
  latestRunFinalizedAt: number | null;
};

export type TreasuryRunExposureRecord = {
  payrollRunId: string;
  status: number;
  allocationCount: number;
  claimedCount: number;
  pendingClaims: number;
  pendingSettlementRequests: number;
  settledPayments: number;
  payoutBacklog: number;
  fundingDeadline: number;
  fundedAt: number;
  activatedAt: number;
  finalizedAt: number;
};

export type TreasuryExposureSummary = {
  orgId: string;
  generatedAt: number;
  routeConfigured: boolean;
  routeHealth: "not_configured" | "healthy" | "action_needed" | "depleted";
  adapter: string;
  routeId: string;
  adapterName: string;
  supportsConfidentialSettlement: boolean;
  settlementAsset: string;
  confidentialSettlementAsset: string;
  availableTreasuryFunds: string;
  reservedTreasuryFunds: string;
  pendingClaims: number;
  pendingSettlementRequests: number;
  settledPayments: number;
  payoutBacklog: number;
  activeRuns: number;
  fundedRuns: number;
  runExposures: TreasuryRunExposureRecord[];
  safetyNotes: string[];
};

export type CompliancePolicySummary = {
  policyId: string;
  label: string;
  taxReserveBps: number;
  aggregateOnly: boolean;
  employeeRowsIncluded: false;
  decryptForTxRequired: boolean;
  scopeBoundary: string;
};

export type ComplianceEvidenceSummary = {
  verifiedReceipts: number;
  publishedReceipts: number;
  latestReceiptBlock: number | null;
  latestReceiptTxHash: string | null;
  evidenceModes: string[];
};

export type ComplianceTaxProvisionSummary = {
  reserveBasis: "reserved_treasury_funds";
  reservedTreasuryFunds: string;
  estimatedTaxReserve: string;
  pendingClaims: number;
  pendingSettlementRequests: number;
  settledPayments: number;
};

export type CompliancePackage = {
  orgId: string;
  generatedAt: number;
  packageKind: "tier_a_aggregate_compliance";
  policy: CompliancePolicySummary;
  report: OrganizationReportSummary;
  treasury: TreasuryExposureSummary;
  taxProvision: ComplianceTaxProvisionSummary;
  evidence: ComplianceEvidenceSummary;
  recentReceipts: AuditReceiptRecord[];
  safetyNotes: string[];
};

export type OrganizationAuditPackage = {
  orgId: string;
  generatedAt: number;
  summary: OrganizationReportSummary;
  recentAuditReceipts: AuditReceiptRecord[];
  recentNotifications: NotificationRecord[];
};

export type OrganizationExportPackage = {
  orgId: string;
  generatedAt: number;
  summary: OrganizationReportSummary;
  treasury: TreasuryExposureSummary;
  payrollRuns: PayrollRunRecord[];
  auditReceipts: AuditReceiptRecord[];
  notifications: NotificationRecord[];
};
