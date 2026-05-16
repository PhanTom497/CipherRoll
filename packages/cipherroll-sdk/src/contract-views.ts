import type {
  AdminBudgetSummaryHandle,
  AuditorAggregateDisclosureMetric,
  AuditorOrganizationSummaryView,
  CiphertextHandle,
  OrganizationView,
  OrganizationInsightsView,
  PayrollAllocationMetaView,
  PayrollRunView,
  PayrollSettlementRequestView,
  TreasuryAdapterConfig
} from "./frontend-types";

export const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

type StringIndexedRecord = Record<string, unknown>;
type IndexedRecord = StringIndexedRecord & Record<number, unknown>;

function asString(value: unknown): string {
  return typeof value === "bigint" ? value.toString() : String(value);
}

function asNumber(value: unknown): number {
  return Number(value ?? 0);
}

function asBoolean(value: unknown): boolean {
  return Boolean(value);
}

function asCiphertextHandle(value: unknown): CiphertextHandle {
  return asString(value) as CiphertextHandle;
}

function pickIndexedValue(result: IndexedRecord, index: number): unknown {
  return result[index];
}

export const AUDITOR_DISCLOSURE_METRIC_INDEX: Record<
  AuditorAggregateDisclosureMetric,
  number
> = {
  budget: 0,
  committed: 1,
  available: 2
};

export function normalizeOptionalBytes32(value: string): string | null {
  return value === ZERO_BYTES32 ? null : value;
}

export function mapOrganizationResult(result: StringIndexedRecord): OrganizationView {
  return {
    admin: asString(result.admin),
    treasuryAdapter: asString(result.treasuryAdapter),
    metadataHash: asString(result.metadataHash),
    treasuryRouteId: asString(result.treasuryRouteId),
    reservedAdminSlots: asNumber(result.reservedAdminSlots),
    reservedQuorum: asNumber(result.reservedQuorum),
    createdAt: asNumber(result.createdAt),
    updatedAt: asNumber(result.updatedAt),
    exists: asBoolean(result.exists)
  };
}

export function mapTreasuryAdapterDetailsResult(
  result: IndexedRecord
): TreasuryAdapterConfig {
  return {
    adapter: asString(pickIndexedValue(result, 0)),
    routeId: asString(pickIndexedValue(result, 1)),
    adapterId: asString(pickIndexedValue(result, 2)),
    adapterName: asString(pickIndexedValue(result, 3)),
    supportsConfidentialSettlement: asBoolean(pickIndexedValue(result, 4)),
    settlementAsset: asString(pickIndexedValue(result, 5)),
    confidentialSettlementAsset: asString(pickIndexedValue(result, 6)),
    availablePayrollFunds: asString(pickIndexedValue(result, 7)),
    reservedPayrollFunds: asString(pickIndexedValue(result, 8))
  };
}

export function mapOrganizationInsightsResult(
  result: StringIndexedRecord
): OrganizationInsightsView {
  return {
    totalPayrollItems: asNumber(result.totalPayrollItems),
    activePayrollItems: asNumber(result.activePayrollItems),
    claimedPayrollItems: asNumber(result.claimedPayrollItems),
    vestingPayrollItems: asNumber(result.vestingPayrollItems),
    employeeRecipients: asNumber(result.employeeRecipients),
    lastIssuedAt: asNumber(result.lastIssuedAt),
    lastClaimedAt: asNumber(result.lastClaimedAt)
  };
}

export function mapAdminBudgetHandlesResult(result: IndexedRecord): AdminBudgetSummaryHandle {
  return {
    budget: asCiphertextHandle(pickIndexedValue(result, 0)),
    committed: asCiphertextHandle(pickIndexedValue(result, 1)),
    available: asCiphertextHandle(pickIndexedValue(result, 2))
  };
}

export function mapPayrollAllocationMetaResult(
  result: StringIndexedRecord
): PayrollAllocationMetaView {
  return {
    employee: asString(result.employee),
    paymentId: asString(result.paymentId),
    memoHash: asString(result.memoHash),
    createdAt: asNumber(result.createdAt),
    isVesting: asBoolean(result.isVesting),
    vestingStart: asNumber(result.vestingStart),
    vestingEnd: asNumber(result.vestingEnd),
    exists: asBoolean(result.exists)
  };
}

export function mapPayrollRunResult(result: StringIndexedRecord): PayrollRunView {
  return {
    orgId: asString(result.orgId),
    settlementAssetId: asString(result.settlementAssetId),
    fundingDeadline: asNumber(result.fundingDeadline),
    plannedHeadcount: asNumber(result.plannedHeadcount),
    allocationCount: asNumber(result.allocationCount),
    claimedCount: asNumber(result.claimedCount),
    createdAt: asNumber(result.createdAt),
    fundedAt: asNumber(result.fundedAt),
    activatedAt: asNumber(result.activatedAt),
    finalizedAt: asNumber(result.finalizedAt),
    status: asNumber(result.status),
    exists: asBoolean(result.exists)
  };
}

export function mapPayrollRunIdResult(value: unknown): string | null {
  const raw = asString(value);
  return normalizeOptionalBytes32(raw);
}

export function mapPayrollSettlementRequestResult(
  result: StringIndexedRecord
): PayrollSettlementRequestView {
  return {
    requestId: asString(result.requestId),
    payoutAsset: asString(result.payoutAsset),
    confidentialAsset: asString(result.confidentialAsset),
    requestedAt: asNumber(result.requestedAt),
    exists: asBoolean(result.exists)
  };
}

export function mapAuditorOrganizationSummaryResult(
  result: StringIndexedRecord
): AuditorOrganizationSummaryView {
  return {
    treasuryRouteConfigured: asBoolean(result.treasuryRouteConfigured),
    supportsConfidentialSettlement: asBoolean(result.supportsConfidentialSettlement),
    settlementAsset: asString(result.settlementAsset),
    confidentialSettlementAsset: asString(result.confidentialSettlementAsset),
    availableTreasuryFunds: asString(result.availableTreasuryFunds),
    reservedTreasuryFunds: asString(result.reservedTreasuryFunds),
    totalPayrollRuns: asNumber(result.totalPayrollRuns),
    draftPayrollRuns: asNumber(result.draftPayrollRuns),
    fundedPayrollRuns: asNumber(result.fundedPayrollRuns),
    activePayrollRuns: asNumber(result.activePayrollRuns),
    finalizedPayrollRuns: asNumber(result.finalizedPayrollRuns),
    totalPayrollItems: asNumber(result.totalPayrollItems),
    activePayrollItems: asNumber(result.activePayrollItems),
    claimedPayrollItems: asNumber(result.claimedPayrollItems),
    vestingPayrollItems: asNumber(result.vestingPayrollItems),
    employeeRecipients: asNumber(result.employeeRecipients),
    lastIssuedAt: asNumber(result.lastIssuedAt),
    lastClaimedAt: asNumber(result.lastClaimedAt)
  };
}

export function formatCiphertextHandle(
  handle: CiphertextHandle | bigint | null | undefined
): string {
  if (!handle) return "Unavailable";
  const raw = typeof handle === "string" ? handle : handle.toString(16);
  if (raw.length < 20) return raw;
  return `${raw.slice(0, 12)}...${raw.slice(-8)}`;
}
