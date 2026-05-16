export type IndexerStatus = {
  chainId: string;
  payrollAddress: string;
  auditorDisclosureAddress: string;
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
  payrollRuns: PayrollRunRecord[];
  auditReceipts: AuditReceiptRecord[];
  notifications: NotificationRecord[];
};
