'use client'

import { CONTRACT_ADDRESS } from "./cipherroll-config";
import { Contract, BrowserProvider as EthersBrowserProvider } from "ethers";

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

// --- CoFHE ABI ---
// InEuint128 is an EncryptedInput struct from cofhe-contracts.
// On the wire it's a tuple of (uint256 ctHash, uint8 securityZone, uint8 utype, bytes signature).
// cofhejs.encrypt() returns this object struct directly.
const CIPHERROLL_ABI = [
  "function createOrganization(bytes32,bytes32,uint64,uint64)",
  "function configureTreasury(bytes32,address,bytes32)",
  "function depositBudget(bytes32,tuple(uint256 ctHash, uint8 securityZone, uint8 utype, bytes signature))",
  "function issueConfidentialPayroll(bytes32,address,tuple(uint256 ctHash, uint8 securityZone, uint8 utype, bytes signature),bytes32,bytes32)",
  "function issueVestingAllocation(bytes32,address,tuple(uint256 ctHash, uint8 securityZone, uint8 utype, bytes signature),bytes32,bytes32,uint64,uint64)",
  "function claimPayroll(bytes32,bytes32)",
  "function getOrganization(bytes32) view returns (tuple(address admin, address treasuryAdapter, bytes32 metadataHash, bytes32 treasuryRouteId, uint64 reservedAdminSlots, uint64 reservedQuorum, uint64 createdAt, uint64 updatedAt, bool exists))",
  "function getAdminBudgetHandles(bytes32) view returns (bytes32, bytes32, bytes32)",
  "function getEmployeeAllocations(bytes32, address) view returns (bytes32[], bytes32[], uint64[], bytes32[])"
];

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
      const tx = await contract.createOrganization(orgId, metadataHash, reservedAdminSlots, reservedQuorum);
      return { wait: () => tx.wait() };
    },

    async configureTreasury(orgId: string, adapter: string, routeId: string) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.configureTreasury(orgId, adapter, routeId);
      return { wait: () => tx.wait() };
    },

    async depositBudget(orgId: string, encryptedAmount: any) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      // cofhejs.encrypt() returns the full EncryptedInput struct
      const tx = await contract.depositBudget(orgId, encryptedAmount);
      return { wait: () => tx.wait() };
    },

    async issueConfidentialPayroll(
      orgId: string,
      employee: string,
      encryptedAmount: any,
      paymentId: string,
      memoHash: string
    ) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.issueConfidentialPayroll(orgId, employee, encryptedAmount, paymentId, memoHash);
      return { wait: () => tx.wait() };
    },

    async issueVestingAllocation(
      orgId: string,
      employee: string,
      encryptedAmount: any,
      paymentId: string,
      memoHash: string,
      startTimestamp: number,
      endTimestamp: number
    ) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.issueVestingAllocation(orgId, employee, encryptedAmount, paymentId, memoHash, startTimestamp, endTimestamp);
      return { wait: () => tx.wait() };
    },

    async claimPayroll(orgId: string, paymentId: string) {
      if (!(runner instanceof JsonRpcSigner)) throw new Error("Signer required.");
      const contract = await getEthersContract();
      const tx = await contract.claimPayroll(orgId, paymentId);
      return { wait: () => tx.wait() };
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
     * Returns raw euint128 ciphertext hashes (bytes32).
     * Use cofhejs.unseal() on the client to decrypt.
     */
    async getAdminBudgetHandles(orgId: string) {
      const contract = await getEthersContract();
      const result = await contract.getAdminBudgetHandles(orgId);
      return {
        budget: result[0] as string,
        committed: result[1] as string,
        available: result[2] as string
      };
    },

    /**
     * Returns raw euint128 ciphertext hashes (bytes32[]) for each allocation.
     * Use cofhejs.unseal() on the client to decrypt each amount.
     */
    async getEmployeeAllocations(orgId: string, employee: string) {
      const contract = await getEthersContract();
      const result = await contract.getEmployeeAllocations(orgId, employee);
      return {
        paymentIds: result[0] as string[],
        memoHashes: result[1] as string[],
        createdAts: (result[2] as bigint[]).map(Number),
        amounts: result[3] as string[]
      };
    }
  };
}

export function formatHandle(handle: string | bigint | null | undefined) {
  if (!handle) return "Unavailable";
  const raw = typeof handle === "string" ? handle : handle.toString(16);
  if (raw.length < 20) return raw;
  return `${raw.slice(0, 12)}...${raw.slice(-8)}`;
}
