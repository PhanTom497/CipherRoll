'use client'

import {
  AUDITOR_DISCLOSURE_CONTRACT_ADDRESS,
  CONTRACT_ADDRESS,
  TARGET_CHAIN_KEY,
  TARGET_CHAIN_RPC_URL
} from "./cipherroll-config";
import {
  CIPHERROLL_AUDITOR_ABI,
  CIPHERROLL_ABI,
  type CipherRollEncryptedInput,
  type CiphertextHandle,
} from "./generated/cipherroll-abi";
import { Contract, BrowserProvider as EthersBrowserProvider, JsonRpcProvider } from "ethers";
import type {
  AuditorAggregateDisclosureMetric,
  AuditorOrganizationSummaryView,
  TreasuryAdapterConfig
} from "./cipherroll-types";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)"
] as const;

const TREASURY_ADAPTER_ABI = [
  "function depositPayrollFunds(bytes32 orgId, uint256 amount)"
] as const;

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

const AUDITOR_DISCLOSURE_METRIC_INDEX: Record<AuditorAggregateDisclosureMetric, number> = {
  budget: 0,
  committed: 1,
  available: 2
};

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
  const fallbackRpcProvider = new JsonRpcProvider(TARGET_CHAIN_RPC_URL);

  const getTransactionOverrides = async () => {
    if (TARGET_CHAIN_KEY !== "arb-sepolia") {
      return {};
    }

    const [feeData, latestBlock] = await Promise.all([
      ethersProvider.getFeeData().catch(() => null),
      fallbackRpcProvider.getBlock("latest").catch(() => null)
    ]);

    const floorGasPrice = 50_000_000n;
    const baseFee = latestBlock?.baseFeePerGas ?? 0n;
    const gasPrice = [feeData?.gasPrice, feeData?.maxFeePerGas, baseFee + 1_000_000n, floorGasPrice]
      .filter((value): value is bigint => typeof value === "bigint" && value > 0n)
      .reduce((max, value) => (value > max ? value : max), floorGasPrice);

    return { gasPrice };
  };

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
        await getTransactionOverrides()
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
        await getTransactionOverrides()
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async depositBudget(orgId: string, encryptedAmount: CipherRollEncryptedInput) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.depositBudget(orgId, encryptedAmount, await getTransactionOverrides());
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
        await getTransactionOverrides()
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
      const tx = await contract.issueVestingAllocation(orgId, employee, encryptedAmount, paymentId, memoHash, startTimestamp, endTimestamp);
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
        await getTransactionOverrides()
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
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
        await getTransactionOverrides()
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
        await getTransactionOverrides()
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async activatePayrollRun(orgId: string, payrollRunId: string) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.activatePayrollRun(orgId, payrollRunId, await getTransactionOverrides());
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
        await getTransactionOverrides()
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
        await getTransactionOverrides()
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async claimPayroll(orgId: string, paymentId: string) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.claimPayroll(orgId, paymentId);
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
        await getTransactionOverrides()
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
        await getTransactionOverrides()
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
        await getTransactionOverrides()
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async getOrganization(orgId: string) {
      const contract = await getEthersContract();
      const result = await contract.getOrganization(orgId);
      return {
        admin: result.admin,
        treasuryAdapter: result.treasuryAdapter,
        metadataHash: result.metadataHash,
        treasuryRouteId: result.treasuryRouteId,
        reservedAdminSlots: Number(result.reservedAdminSlots),
        reservedQuorum: Number(result.reservedQuorum),
        createdAt: Number(result.createdAt),
        updatedAt: Number(result.updatedAt),
        exists: result.exists
      };
    },

    async getTreasuryAdapterDetails(orgId: string): Promise<TreasuryAdapterConfig> {
      const contract = await getEthersContract();
      const result = await contract.getTreasuryAdapterDetails(orgId);
      return {
        adapter: result[0] as string,
        routeId: result[1] as string,
        adapterId: result[2] as string,
        adapterName: result[3] as string,
        supportsConfidentialSettlement: result[4] as boolean,
        settlementAsset: result[5] as string,
        confidentialSettlementAsset: result[6] as string,
        availablePayrollFunds: String(result[7] as bigint),
        reservedPayrollFunds: String(result[8] as bigint)
      };
    },

    async approveSettlementToken(tokenAddress: string, spender: string, amount: bigint) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const signer = await ethersProvider.getSigner();
      const token = new Contract(tokenAddress, ERC20_ABI, signer);
      const tx = await token.approve(spender, amount, await getTransactionOverrides());
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async depositPayrollFunds(adapterAddress: string, orgId: string, amount: bigint) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const signer = await ethersProvider.getSigner();
      const adapter = new Contract(adapterAddress, TREASURY_ADAPTER_ABI, signer);
      const tx = await adapter.depositPayrollFunds(orgId, amount, await getTransactionOverrides());
      return { hash: tx.hash as string, wait: () => tx.wait() };
    },

    async getOrganizationInsights(orgId: string) {
      const contract = await getEthersContract();
      const result = await contract.getOrganizationInsights(orgId);
      return {
        totalPayrollItems: Number(result.totalPayrollItems),
        activePayrollItems: Number(result.activePayrollItems),
        claimedPayrollItems: Number(result.claimedPayrollItems),
        vestingPayrollItems: Number(result.vestingPayrollItems),
        employeeRecipients: Number(result.employeeRecipients),
        lastIssuedAt: Number(result.lastIssuedAt),
        lastClaimedAt: Number(result.lastClaimedAt)
      };
    },

    /**
     * Returns raw euint128 ciphertext handles (bytes32).
     * Use client.decryptForView() on the client to decrypt.
     */
    async getAdminBudgetHandles(orgId: string) {
      const contract = await getEthersContract();
      const result = await contract.getAdminBudgetHandles(orgId);
      return {
        budget: result[0] as CiphertextHandle,
        committed: result[1] as CiphertextHandle,
        available: result[2] as CiphertextHandle
      };
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

    async getPayrollAllocationMeta(paymentId: string) {
      const contract = await getEthersContract();
      const result = await contract.getPayrollAllocationMeta(paymentId);
      return {
        employee: result.employee as string,
        paymentId: result.paymentId as string,
        memoHash: result.memoHash as string,
        createdAt: Number(result.createdAt),
        isVesting: result.isVesting as boolean,
        vestingStart: Number(result.vestingStart),
        vestingEnd: Number(result.vestingEnd),
        exists: result.exists as boolean
      };
    },

    async getPayrollRun(payrollRunId: string) {
      const contract = await getEthersContract();
      const result = await contract.getPayrollRun(payrollRunId);
      return {
        orgId: result.orgId as string,
        settlementAssetId: result.settlementAssetId as string,
        fundingDeadline: Number(result.fundingDeadline),
        plannedHeadcount: Number(result.plannedHeadcount),
        allocationCount: Number(result.allocationCount),
        claimedCount: Number(result.claimedCount),
        createdAt: Number(result.createdAt),
        fundedAt: Number(result.fundedAt),
        activatedAt: Number(result.activatedAt),
        finalizedAt: Number(result.finalizedAt),
        status: Number(result.status),
        exists: result.exists as boolean
      };
    },

    async getOrganizationPayrollRunIds(orgId: string) {
      const contract = await getEthersContract();
      return (await contract.getOrganizationPayrollRunIds(orgId)) as string[];
    },

    async getPayrollRunForPayment(paymentId: string) {
      const contract = await getEthersContract();
      const result = (await contract.getPayrollRunForPayment(paymentId)) as string;
      return result === "0x0000000000000000000000000000000000000000000000000000000000000000" ? null : result;
    },

    async getPayrollSettlementRequest(paymentId: string) {
      const contract = await getEthersContract();
      const result = await contract.getPayrollSettlementRequest(paymentId);
      return {
        requestId: result.requestId as string,
        payoutAsset: result.payoutAsset as string,
        confidentialAsset: result.confidentialAsset as string,
        requestedAt: Number(result.requestedAt),
        exists: result.exists as boolean
      };
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
  const fallbackRpcProvider = new JsonRpcProvider(TARGET_CHAIN_RPC_URL);

  const getTransactionOverrides = async () => {
    if (TARGET_CHAIN_KEY !== "arb-sepolia") {
      return {};
    }

    const [feeData, latestBlock] = await Promise.all([
      ethersProvider.getFeeData().catch(() => null),
      fallbackRpcProvider.getBlock("latest").catch(() => null)
    ]);

    const floorGasPrice = 50_000_000n;
    const baseFee = latestBlock?.baseFeePerGas ?? 0n;
    const gasPrice = [feeData?.gasPrice, feeData?.maxFeePerGas, baseFee + 1_000_000n, floorGasPrice]
      .filter((value): value is bigint => typeof value === "bigint" && value > 0n)
      .reduce((max, value) => (value > max ? value : max), floorGasPrice);

    return { gasPrice };
  };

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
      return {
        treasuryRouteConfigured: result.treasuryRouteConfigured as boolean,
        supportsConfidentialSettlement: result.supportsConfidentialSettlement as boolean,
        treasuryRouteId: result.treasuryRouteId as string,
        settlementAsset: result.settlementAsset as string,
        confidentialSettlementAsset: result.confidentialSettlementAsset as string,
        availableTreasuryFunds: String(result.availableTreasuryFunds as bigint),
        reservedTreasuryFunds: String(result.reservedTreasuryFunds as bigint),
        totalPayrollRuns: Number(result.totalPayrollRuns),
        draftPayrollRuns: Number(result.draftPayrollRuns),
        fundedPayrollRuns: Number(result.fundedPayrollRuns),
        activePayrollRuns: Number(result.activePayrollRuns),
        finalizedPayrollRuns: Number(result.finalizedPayrollRuns),
        totalPayrollItems: Number(result.totalPayrollItems),
        activePayrollItems: Number(result.activePayrollItems),
        claimedPayrollItems: Number(result.claimedPayrollItems),
        vestingPayrollItems: Number(result.vestingPayrollItems),
        employeeRecipients: Number(result.employeeRecipients),
        lastIssuedAt: Number(result.lastIssuedAt),
        lastClaimedAt: Number(result.lastClaimedAt)
      };
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
        await getTransactionOverrides()
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
        await getTransactionOverrides()
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
        await getTransactionOverrides()
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
        await getTransactionOverrides()
      );
      return { hash: tx.hash as string, wait: () => tx.wait() };
    }
  };
}

export function formatHandle(handle: CiphertextHandle | bigint | null | undefined) {
  if (!handle) return "Unavailable";
  const raw = typeof handle === "string" ? handle : handle.toString(16);
  if (raw.length < 20) return raw;
  return `${raw.slice(0, 12)}...${raw.slice(-8)}`;
}
