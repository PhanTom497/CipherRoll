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

const runtime = getCipherRollRuntimeConfig(process.env as Record<string, string | undefined>);

export const CONTRACT_ADDRESS = runtime.contractAddress;
export const AUDITOR_DISCLOSURE_CONTRACT_ADDRESS = runtime.auditorDisclosureAddress;
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
