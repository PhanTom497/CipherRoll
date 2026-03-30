export const cipherRollAbi = [
  "function createOrganization(bytes32 orgId, bytes32 metadataHash, uint64 reservedAdminSlots, uint64 reservedQuorum)",
  "function configureTreasury(bytes32 orgId, address treasuryAdapter, bytes32 treasuryRouteId)",
  "function depositBudget(bytes32 orgId, uint128 amount)",
  "function issueConfidentialPayroll(bytes32 orgId, address employee, uint128 amount, bytes32 paymentId, bytes32 memoHash)",
  "function getOrganization(bytes32 orgId) view returns ((address admin,address treasuryAdapter,bytes32 metadataHash,bytes32 treasuryRouteId,uint64 reservedAdminSlots,uint64 reservedQuorum,uint64 createdAt,uint64 updatedAt,bool exists))",
  "function getTreasuryAdapterDetails(bytes32 orgId) view returns (address adapter, bytes32 routeId, bytes32 adapterId, string adapterName, bool supportsConfidentialSettlement)",
  "function getAdminSummaryHandles(bytes32 orgId) view returns (uint256 budget, uint256 committed, uint256 available)",
  "function getEmployeeHandles(bytes32 orgId, address employee) view returns (bytes32[] paymentIds, bytes32[] memoHashes, uint64[] createdAts, uint256[] handles)"
] as const;
