export type PermitBundle = {
  issuer: string;
  contractAddress: string;
  chainId: number;
  signature: string;
  issuedAt: string;
};

export type TreasuryAdapterConfig = {
  adapter: string;
  routeId: string;
  adapterId: string;
  adapterName: string;
  supportsConfidentialSettlement: boolean;
};

export type AdminBudgetSummaryHandle = {
  budget: string;
  committed: string;
  available: string;
};

export type PayrollAllocationHandle = {
  paymentId: string;
  memoHash: string;
  createdAt: number;
  handle: string;
};

export type EmployeePayrollView = {
  paymentId: string;
  memoHash: string;
  createdAt: number;
  amount: string | null;
  handle: string;
};
