import {
  AUDITOR_DISCLOSURE_METRIC_INDEX,
  formatBytes32Preview,
  formatCiphertextHandle,
  getCipherRollRuntimeConfig,
  makeDeterministicLabel,
  makeHighEntropyBytes32Label,
  makeHighEntropyLabel,
  mapAdminBudgetHandlesResult,
  mapAuditorOrganizationSummaryResult,
  mapOrganizationInsightsResult,
  mapOrganizationResult,
  mapPayrollAllocationMetaResult,
  mapPayrollRunIdResult,
  mapPayrollRunResult,
  mapPayrollSettlementRequestResult,
  mapTreasuryAdapterDetailsResult,
  safeAddress,
  SUPPORTED_CHAIN_CONFIG,
  toBytes32Label,
  type SupportedChainKey
} from "../../packages/cipherroll-sdk/src";

export {
  AUDITOR_DISCLOSURE_METRIC_INDEX,
  formatBytes32Preview,
  formatCiphertextHandle,
  getCipherRollRuntimeConfig,
  mapAdminBudgetHandlesResult,
  mapAuditorOrganizationSummaryResult,
  makeDeterministicLabel,
  makeHighEntropyBytes32Label,
  makeHighEntropyLabel,
  mapOrganizationInsightsResult,
  mapOrganizationResult,
  mapPayrollAllocationMetaResult,
  mapPayrollRunIdResult,
  mapPayrollRunResult,
  mapPayrollSettlementRequestResult,
  mapTreasuryAdapterDetailsResult,
  safeAddress,
  SUPPORTED_CHAIN_CONFIG,
  toBytes32Label,
  type SupportedChainKey
};

const runtime = getCipherRollRuntimeConfig({
  NEXT_PUBLIC_CIPHERROLL_TARGET_CHAIN: process.env.NEXT_PUBLIC_CIPHERROLL_TARGET_CHAIN,
  NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS,
  NEXT_PUBLIC_CIPHERROLL_AUDITOR_DISCLOSURE_ADDRESS:
    process.env.NEXT_PUBLIC_CIPHERROLL_AUDITOR_DISCLOSURE_ADDRESS,
  NEXT_PUBLIC_CIPHERROLL_GOVERNANCE_ADDRESS:
    process.env.NEXT_PUBLIC_CIPHERROLL_GOVERNANCE_ADDRESS,
  NEXT_PUBLIC_CIPHERROLL_DIRECT_SETTLEMENT_ADAPTER:
    process.env.NEXT_PUBLIC_CIPHERROLL_DIRECT_SETTLEMENT_ADAPTER,
  NEXT_PUBLIC_CIPHERROLL_WRAPPER_SETTLEMENT_ADAPTER:
    process.env.NEXT_PUBLIC_CIPHERROLL_WRAPPER_SETTLEMENT_ADAPTER,
  NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL:
    process.env.NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL,
  NEXT_PUBLIC_DEFAULT_ORG_ID: process.env.NEXT_PUBLIC_DEFAULT_ORG_ID,
  NODE_ENV: process.env.NODE_ENV
});

export const CONTRACT_ADDRESS = runtime.contractAddress;
export const AUDITOR_DISCLOSURE_CONTRACT_ADDRESS = runtime.auditorDisclosureAddress;
export const GOVERNANCE_CONTRACT_ADDRESS = runtime.governanceAddress;
export const DIRECT_SETTLEMENT_ADAPTER_ADDRESS = runtime.directSettlementAdapterAddress;
export const WRAPPER_SETTLEMENT_ADAPTER_ADDRESS = runtime.wrapperSettlementAdapterAddress;
export const BACKEND_BASE_URL = runtime.backendBaseUrl;
export const DEFAULT_ORG_ID = runtime.defaultOrgId;
export const TARGET_CHAIN_KEY = runtime.targetChainKey;
export const TARGET_CHAIN_NAME = runtime.targetChainName;
export const TARGET_CHAIN_ID = runtime.targetChainId;
export const TARGET_CHAIN_HEX = runtime.targetChainHex;
export const TARGET_CHAIN_RPC_URL = runtime.targetChainRpcUrl;
export const TARGET_CHAIN_PARAMS = runtime.targetChainParams;
export const SUPPORTED_CHAIN_IDS = runtime.supportedChainIds;
export const SUPPORTED_CHAIN_NAMES = runtime.supportedChainNames;
