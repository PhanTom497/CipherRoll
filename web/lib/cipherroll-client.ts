'use client'

import { CONTRACT_ADDRESS, TARGET_CHAIN_KEY, TARGET_CHAIN_RPC_URL } from "./cipherroll-config";
import {
  CIPHERROLL_ABI,
  type CipherRollEncryptedInput,
  type CiphertextHandle,
} from "./generated/cipherroll-abi";
import { Contract, BrowserProvider as EthersBrowserProvider, JsonRpcProvider } from "ethers";

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
      const tx = await contract.configureTreasury(orgId, adapter, routeId);
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

    async claimPayroll(orgId: string, paymentId: string) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.claimPayroll(orgId, paymentId);
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
    }
  };
}

export function formatHandle(handle: CiphertextHandle | bigint | null | undefined) {
  if (!handle) return "Unavailable";
  const raw = typeof handle === "string" ? handle : handle.toString(16);
  if (raw.length < 20) return raw;
  return `${raw.slice(0, 12)}...${raw.slice(-8)}`;
}
