'use client'

import {
  AUDITOR_DISCLOSURE_METRIC_INDEX,
  formatCiphertextHandle,
  mapAdminBudgetHandlesResult,
  mapAuditorOrganizationSummaryResult,
  mapOrganizationInsightsResult,
  mapOrganizationResult,
  mapPayrollAllocationMetaResult,
  mapPayrollRunIdResult,
  mapPayrollRunResult,
  mapPayrollSettlementRequestResult,
  mapTreasuryAdapterDetailsResult,
  mapTreasuryPayrollRunFundingResult,
  AUDITOR_DISCLOSURE_CONTRACT_ADDRESS,
  CONTRACT_ADDRESS,
  GOVERNANCE_CONTRACT_ADDRESS,
  TARGET_CHAIN_KEY,
  TARGET_CHAIN_RPC_URL
} from "./cipherroll-config";
import {
  CIPHERROLL_AUDITOR_ABI,
  CIPHERROLL_ABI,
  CIPHERROLL_GOVERNANCE_ABI,
  type CipherRollEncryptedInput,
  type CiphertextHandle,
} from "./generated/cipherroll-abi";
import { Contract, BrowserProvider as EthersBrowserProvider, JsonRpcProvider } from "ethers";
import type {
  AuditorAggregateDisclosureMetric,
  AuditorOrganizationSummaryView,
  PayrollAllocationMetaView,
  PayrollSettlementRequestView,
  OrganizationView,
  OrganizationInsightsView,
  PayrollRunView,
  TreasuryPayrollRunFundingView,
  TreasuryAdapterConfig
} from "./cipherroll-types";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)"
] as const;

const TREASURY_ADAPTER_ABI = [
  "function depositPayrollFunds(bytes32 orgId, uint256 amount)"
] as const;

const ARBITRUM_SEPOLIA_PRIORITY_FEE_FLOOR = 10_000_000n;
const ARBITRUM_SEPOLIA_MAX_FEE_FLOOR = 80_000_000n;

async function getFreshTransactionOverrides(ethersProvider: EthersBrowserProvider) {
  if (TARGET_CHAIN_KEY !== "arb-sepolia") {
    return {};
  }

  const fallbackRpcProvider = new JsonRpcProvider(TARGET_CHAIN_RPC_URL);
  const [feeData, latestBlock] = await Promise.all([
    ethersProvider.getFeeData().catch(() => null),
    fallbackRpcProvider.getBlock("latest").catch(() => null)
  ]);

  const baseFee = latestBlock?.baseFeePerGas ?? 0n;
  const priorityFee = [feeData?.maxPriorityFeePerGas, ARBITRUM_SEPOLIA_PRIORITY_FEE_FLOOR]
    .filter((value): value is bigint => typeof value === "bigint" && value > 0n)
    .reduce((max, value) => (value > max ? value : max), ARBITRUM_SEPOLIA_PRIORITY_FEE_FLOOR);
  const maxFee = [
    feeData?.maxFeePerGas,
    baseFee > 0n ? baseFee * 2n + priorityFee * 2n : null,
    ARBITRUM_SEPOLIA_MAX_FEE_FLOOR
  ]
    .filter((value): value is bigint => typeof value === "bigint" && value > 0n)
    .reduce((max, value) => (value > max ? value : max), ARBITRUM_SEPOLIA_MAX_FEE_FLOOR);

  return {
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: priorityFee
  };
}

type JsonRpcPayload = {
  method: string;
  params?: unknown[];
};

export interface Eip1193Provider {
  request: (payload: JsonRpcPayload) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export function hasEthereumProvider() {
  return typeof window !== "undefined" && !!window.ethereum;
}

export class BrowserProvider {
  constructor(public readonly transport: Eip1193Provider) {}

  async send(method: string, params: unknown[] = []) {
    return this.transport.request({ method, params });
  }

  async getSigner() {
    return new JsonRpcSigner(this);
  }

  async getNetwork() {
    const chainIdHex = String(await this.send("eth_chainId"));
    return {
      chainId: Number.parseInt(chainIdHex, 16)
    };
  }

  async getBlockNumber() {
    const blockHex = String(await this.send("eth_blockNumber"));
    return Number.parseInt(blockHex, 16);
  }
}

export class JsonRpcSigner {
  constructor(public readonly provider: BrowserProvider) {}

  async getAddress() {
    const accounts = (await this.provider.send("eth_accounts", [])) as string[];
    if (!accounts?.length) {
      throw new Error("No connected wallet account was found.");
    }
    return accounts[0];
  }

  async signTypedData(domain: unknown, types: unknown, message: unknown) {
    const address = await this.getAddress();
    const payload = JSON.stringify({
      domain,
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" }
        ],
        ...(types as Record<string, unknown>)
      },
      primaryType: Object.keys(types as Record<string, unknown>)[0],
      message
    });

    return String(
      await this.provider.send("eth_signTypedData_v4", [address, payload])
    );
  }

  async sendTransaction(data: string) {
    const from = await this.getAddress();
    const hash = String(
      await this.provider.send("eth_sendTransaction", [
        {
          from,
          to: CONTRACT_ADDRESS,
          data
        }
      ])
    );

    for (let attempt = 0; attempt < 40; attempt++) {
      const receipt = await this.provider.send("eth_getTransactionReceipt", [hash]);
      if (receipt) {
        return receipt;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    throw new Error("Transaction receipt was not observed in time.");
  }
}

export async function createBrowserProvider() {
  if (!hasEthereumProvider()) {
    throw new Error("No injected EVM wallet was found in this browser.");
  }

  return new BrowserProvider(window.ethereum!);
}

export function getCipherRollContract(runner: BrowserProvider | JsonRpcSigner) {
  if (!CONTRACT_ADDRESS) {
    throw new Error(
      "NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS is not configured."
    );
  }

  const transport = runner instanceof JsonRpcSigner ? runner.provider.transport : runner.transport;
  const ethersProvider = new EthersBrowserProvider(transport as any);
  const getEthersContract = async () => {
    const signer = runner instanceof JsonRpcSigner ? await ethersProvider.getSigner() : null;
    return new Contract(CONTRACT_ADDRESS, CIPHERROLL_ABI, signer ?? ethersProvider);
  };

  return {
    async createOrganization(
      orgId: string,
      metadataHash: string,
      reservedAdminSlots: number,
      reservedQuorum: number
    ) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.createOrganization(
        orgId,
        metadataHash,
        reservedAdminSlots,
        reservedQuorum,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async configureTreasury(orgId: string, adapter: string, routeId: string) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.configureTreasury(
        orgId,
        adapter,
        routeId,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async configureOrganizationGovernanceExecutor(orgId: string, governanceExecutor: string) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.configureOrganizationGovernanceExecutor(
        orgId,
        governanceExecutor,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async depositBudget(orgId: string, encryptedAmount: CipherRollEncryptedInput, cleartextFundingLimit: bigint) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.depositBudget(
        orgId,
        encryptedAmount,
        cleartextFundingLimit,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async issueConfidentialPayroll(
      orgId: string,
      employee: string,
      encryptedAmount: CipherRollEncryptedInput,
      paymentId: string,
      memoHash: string
    ) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.issueConfidentialPayroll(
        orgId,
        employee,
        encryptedAmount,
        paymentId,
        memoHash,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async issueVestingAllocation(
      orgId: string,
      employee: string,
      encryptedAmount: CipherRollEncryptedInput,
      paymentId: string,
      memoHash: string,
      startTimestamp: number,
      endTimestamp: number
    ) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.issueVestingAllocation(
        orgId,
        employee,
        encryptedAmount,
        paymentId,
        memoHash,
        startTimestamp,
        endTimestamp,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async createPayrollRun(
      orgId: string,
      payrollRunId: string,
      settlementAssetId: string,
      fundingDeadline: number,
      plannedHeadcount: number
    ) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.createPayrollRun(
        orgId,
        payrollRunId,
        settlementAssetId,
        fundingDeadline,
        plannedHeadcount,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async previewCreatePayrollRun(
      orgId: string,
      payrollRunId: string,
      settlementAssetId: string,
      fundingDeadline: number,
      plannedHeadcount: number
    ) {
      const contract = await getEthersContract();
      await contract.createPayrollRun.staticCall(
        orgId,
        payrollRunId,
        settlementAssetId,
        fundingDeadline,
        plannedHeadcount
      );
    },

    async fundPayrollRun(
      orgId: string,
      payrollRunId: string,
      encryptedAmount: CipherRollEncryptedInput
    ) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.fundPayrollRun(
        orgId,
        payrollRunId,
        encryptedAmount,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async fundPayrollRunFromTreasury(
      orgId: string,
      payrollRunId: string,
      cleartextAmount: bigint
    ) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.fundPayrollRunFromTreasury(
        orgId,
        payrollRunId,
        cleartextAmount,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async activatePayrollRun(orgId: string, payrollRunId: string) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.activatePayrollRun(orgId, payrollRunId, await getFreshTransactionOverrides(ethersProvider));
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async issueConfidentialPayrollToRun(
      orgId: string,
      payrollRunId: string,
      employee: string,
      encryptedAmount: CipherRollEncryptedInput,
      paymentId: string,
      memoHash: string
    ) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.issueConfidentialPayrollToRun(
        orgId,
        payrollRunId,
        employee,
        encryptedAmount,
        paymentId,
        memoHash,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async issueVestingAllocationToRun(
      orgId: string,
      payrollRunId: string,
      employee: string,
      encryptedAmount: CipherRollEncryptedInput,
      paymentId: string,
      memoHash: string,
      startTimestamp: number,
      endTimestamp: number
    ) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.issueVestingAllocationToRun(
        orgId,
        payrollRunId,
        employee,
        encryptedAmount,
        paymentId,
        memoHash,
        startTimestamp,
        endTimestamp,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async claimPayroll(orgId: string, paymentId: string) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.claimPayroll(orgId, paymentId, await getFreshTransactionOverrides(ethersProvider));
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async claimPayrollWithSettlement(
      orgId: string,
      paymentId: string,
      cleartextAmount: bigint,
      signature: string
    ) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.claimPayrollWithSettlement(
        orgId,
        paymentId,
        cleartextAmount,
        signature,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async requestPayrollSettlement(
      orgId: string,
      paymentId: string,
      cleartextAmount: bigint,
      signature: string
    ) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.requestPayrollSettlement(
        orgId,
        paymentId,
        cleartextAmount,
        signature,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async finalizePayrollSettlement(
      orgId: string,
      paymentId: string,
      decryptedAmount: bigint,
      signature: string
    ) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.finalizePayrollSettlement(
        orgId,
        paymentId,
        decryptedAmount,
        signature,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async getOrganization(orgId: string): Promise<OrganizationView> {
      const contract = await getEthersContract();
      const result = await contract.getOrganization(orgId);
      return mapOrganizationResult(result);
    },

    async getOrganizationGovernanceExecutor(orgId: string) {
      const contract = await getEthersContract();
      return contract.getOrganizationGovernanceExecutor(orgId) as Promise<string>;
    },

    async getTreasuryAdapterDetails(orgId: string): Promise<TreasuryAdapterConfig> {
      const contract = await getEthersContract();
      const result = await contract.getTreasuryAdapterDetails(orgId);
      return mapTreasuryAdapterDetailsResult(result);
    },

    async getTreasuryPayrollRunFunding(
      orgId: string,
      payrollRunId: string
    ): Promise<TreasuryPayrollRunFundingView> {
      const contract = await getEthersContract();
      const result = await contract.getTreasuryPayrollRunFunding(orgId, payrollRunId);
      return mapTreasuryPayrollRunFundingResult(result);
    },

    async approveSettlementToken(tokenAddress: string, spender: string, amount: bigint) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const signer = await ethersProvider.getSigner();
      const token = new Contract(tokenAddress, ERC20_ABI, signer);
      const tx = await token.approve(spender, amount, await getFreshTransactionOverrides(ethersProvider));
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async depositPayrollFunds(adapterAddress: string, orgId: string, amount: bigint) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const signer = await ethersProvider.getSigner();
      const adapter = new Contract(adapterAddress, TREASURY_ADAPTER_ABI, signer);
      const tx = await adapter.depositPayrollFunds(orgId, amount, await getFreshTransactionOverrides(ethersProvider));
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async getOrganizationInsights(orgId: string): Promise<OrganizationInsightsView> {
      const contract = await getEthersContract();
      const result = await contract.getOrganizationInsights(orgId);
      return mapOrganizationInsightsResult(result);
    },

    /**
     * Returns raw euint128 ciphertext handles (bytes32).
     * Use client.decryptForView() on the client to decrypt.
     */
    async getAdminBudgetHandles(orgId: string) {
      const contract = await getEthersContract();
      const result = await contract.getAdminBudgetHandles(orgId);
      return mapAdminBudgetHandlesResult(result);
    },

    /**
     * Returns raw euint128 ciphertext handles (bytes32[]) for each allocation.
     * Use client.decryptForView() on the client to decrypt each amount.
     */
    async getEmployeeAllocations(orgId: string, employee: string) {
      const contract = await getEthersContract();
      const result = await contract.getEmployeeAllocations(orgId, employee);
      return {
        paymentIds: result[0] as string[],
        memoHashes: result[1] as string[],
        createdAts: (result[2] as bigint[]).map(Number),
        amounts: result[3] as CiphertextHandle[]
      };
    },

    async getPayrollAllocationMeta(paymentId: string): Promise<PayrollAllocationMetaView> {
      const contract = await getEthersContract();
      const result = await contract.getPayrollAllocationMeta(paymentId);
      return mapPayrollAllocationMetaResult(result);
    },

    async getPayrollRun(payrollRunId: string): Promise<PayrollRunView> {
      const contract = await getEthersContract();
      const result = await contract.getPayrollRun(payrollRunId);
      return mapPayrollRunResult(result);
    },

    async getOrganizationPayrollRunIds(orgId: string) {
      const contract = await getEthersContract();
      return (await contract.getOrganizationPayrollRunIds(orgId)) as string[];
    },

    async getPayrollRunForPayment(paymentId: string) {
      const contract = await getEthersContract();
      const result = await contract.getPayrollRunForPayment(paymentId);
      return mapPayrollRunIdResult(result);
    },

    async getPayrollSettlementRequest(
      paymentId: string
    ): Promise<PayrollSettlementRequestView> {
      const contract = await getEthersContract();
      const result = await contract.getPayrollSettlementRequest(paymentId);
      return mapPayrollSettlementRequestResult(result);
    },

    async isPayrollClaimed(paymentId: string) {
      const contract = await getEthersContract();
      return Boolean(await contract.isPayrollClaimed(paymentId));
    }
  };
}

export function getCipherRollAuditorContract(runner: BrowserProvider | JsonRpcSigner) {
  if (!AUDITOR_DISCLOSURE_CONTRACT_ADDRESS) {
    throw new Error(
      "NEXT_PUBLIC_CIPHERROLL_AUDITOR_DISCLOSURE_ADDRESS is not configured."
    );
  }

  const transport = runner instanceof JsonRpcSigner ? runner.provider.transport : runner.transport;
  const ethersProvider = new EthersBrowserProvider(transport as any);
  const getEthersContract = async () => {
    const signer = runner instanceof JsonRpcSigner ? await ethersProvider.getSigner() : null;
    return new Contract(
      AUDITOR_DISCLOSURE_CONTRACT_ADDRESS,
      CIPHERROLL_AUDITOR_ABI,
      signer ?? ethersProvider
    );
  };

  return {
    async getAuditorOrganizationSummary(orgId: string): Promise<AuditorOrganizationSummaryView> {
      const contract = await getEthersContract();
      const result = await contract.getAuditorOrganizationSummary(orgId);
      return mapAuditorOrganizationSummaryResult(result);
    },

    async getAuditorEncryptedSummaryHandles(orgId: string) {
      const contract = await getEthersContract();
      const result = await contract.getAuditorEncryptedSummaryHandles(orgId);
      return {
        budget: result[0] as CiphertextHandle,
        committed: result[1] as CiphertextHandle,
        available: result[2] as CiphertextHandle
      };
    },

    async getAuditorAggregateHandle(orgId: string, metric: AuditorAggregateDisclosureMetric) {
      const contract = await getEthersContract();
      const result = await contract.getAuditorAggregateHandle(
        orgId,
        AUDITOR_DISCLOSURE_METRIC_INDEX[metric]
      );
      return result as CiphertextHandle;
    },

    async verifyAuditorAggregateDisclosure(
      orgId: string,
      metric: AuditorAggregateDisclosureMetric,
      cleartextValue: bigint,
      signature: string
    ) {
      const contract = await getEthersContract();
      const tx = await contract.verifyAuditorAggregateDisclosure(
        orgId,
        AUDITOR_DISCLOSURE_METRIC_INDEX[metric],
        cleartextValue,
        signature,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async publishAuditorAggregateDisclosure(
      orgId: string,
      metric: AuditorAggregateDisclosureMetric,
      cleartextValue: bigint,
      signature: string
    ) {
      const contract = await getEthersContract();
      const tx = await contract.publishAuditorAggregateDisclosure(
        orgId,
        AUDITOR_DISCLOSURE_METRIC_INDEX[metric],
        cleartextValue,
        signature,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async verifyAuditorAggregateDisclosureBatch(
      orgId: string,
      metrics: AuditorAggregateDisclosureMetric[],
      cleartextValues: bigint[],
      signatures: string[]
    ) {
      const contract = await getEthersContract();
      const tx = await contract.verifyAuditorAggregateDisclosureBatch(
        orgId,
        metrics.map((metric) => AUDITOR_DISCLOSURE_METRIC_INDEX[metric]),
        cleartextValues,
        signatures,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async publishAuditorAggregateDisclosureBatch(
      orgId: string,
      metrics: AuditorAggregateDisclosureMetric[],
      cleartextValues: bigint[],
      signatures: string[]
    ) {
      const contract = await getEthersContract();
      const tx = await contract.publishAuditorAggregateDisclosureBatch(
        orgId,
        metrics.map((metric) => AUDITOR_DISCLOSURE_METRIC_INDEX[metric]),
        cleartextValues,
        signatures,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    }
  };
}

export function getCipherRollGovernanceContract(runner: BrowserProvider | JsonRpcSigner) {
  const transport = runner instanceof JsonRpcSigner ? runner.provider.transport : runner.transport;
  const ethersProvider = new EthersBrowserProvider(transport as any);

  const getEthersContract = async () => {
    if (!GOVERNANCE_CONTRACT_ADDRESS) {
      throw new Error("NEXT_PUBLIC_CIPHERROLL_GOVERNANCE_ADDRESS is not configured.");
    }

    const signer = runner instanceof JsonRpcSigner ? await ethersProvider.getSigner() : null;
    return new Contract(
      GOVERNANCE_CONTRACT_ADDRESS,
      CIPHERROLL_GOVERNANCE_ABI,
      signer ?? ethersProvider
    );
  };

  return {
    async bootstrapOrganization(orgId: string) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.bootstrapOrganization(orgId, await getFreshTransactionOverrides(ethersProvider));
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async bootstrapOrganizationAdmin(orgId: string, adminToAdd: string) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.bootstrapOrganizationAdmin(
        orgId,
        adminToAdd,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async getOrganizationGovernance(orgId: string) {
      const contract = await getEthersContract();
      return contract.getOrganizationGovernance(orgId);
    },

    async getOrganizationAdmins(orgId: string) {
      const contract = await getEthersContract();
      return contract.getOrganizationAdmins(orgId) as Promise<string[]>;
    },

    async isOrganizationAdmin(orgId: string, account: string) {
      const contract = await getEthersContract();
      return contract.isOrganizationAdmin(orgId, account) as Promise<boolean>;
    },

    async isGovernanceActive(orgId: string) {
      const contract = await getEthersContract();
      return contract.isGovernanceActive(orgId) as Promise<boolean>;
    },

    async getOrganizationGovernanceProposalIds(orgId: string) {
      const contract = await getEthersContract();
      return contract.getOrganizationGovernanceProposalIds(orgId) as Promise<string[]>;
    },

    async getGovernanceProposal(proposalId: string) {
      const contract = await getEthersContract();
      return contract.getGovernanceProposal(proposalId);
    },

    async hasApprovedGovernanceProposal(proposalId: string, account: string) {
      const contract = await getEthersContract();
      return contract.hasApprovedGovernanceProposal(proposalId, account) as Promise<boolean>;
    },

    async proposeGovernanceAction(
      orgId: string,
      actionType: number,
      payload: string,
      expiresAt: number
    ) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.proposeGovernanceAction(
        orgId,
        actionType,
        payload,
        expiresAt,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async approveGovernanceProposal(proposalId: string) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.approveGovernanceProposal(
        proposalId,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async revokeGovernanceApproval(proposalId: string) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.revokeGovernanceApproval(
        proposalId,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async executeGovernanceProposal(proposalId: string) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.executeGovernanceProposal(
        proposalId,
        await getFreshTransactionOverrides(ethersProvider)
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    }
  };
}

export function formatHandle(handle: CiphertextHandle | bigint | null | undefined) {
  return formatCiphertextHandle(handle);
}
