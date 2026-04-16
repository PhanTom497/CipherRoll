import type { CiphertextHandle } from "./generated/cipherroll-abi";

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
  budget: CiphertextHandle;
  committed: CiphertextHandle;
  available: CiphertextHandle;
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
};
