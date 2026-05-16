import { keccak256, toUtf8Bytes } from "ethers";

export const SUPPORTED_CHAIN_CONFIG = {
  "arb-sepolia": {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    chainIdHex: "0x66eee",
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18
    },
    rpcUrls: ["https://arbitrum-sepolia-rpc.publicnode.com"],
    blockExplorerUrls: ["https://sepolia.arbiscan.io"]
  }
} as const;

export type SupportedChainKey = keyof typeof SUPPORTED_CHAIN_CONFIG;

export type CipherRollRuntimeConfig = {
  contractAddress: string;
  auditorDisclosureAddress: string;
  directSettlementAdapterAddress: string;
  wrapperSettlementAdapterAddress: string;
  backendBaseUrl: string;
  defaultOrgId: string;
  targetChainKey: SupportedChainKey;
  targetChainName: string;
  targetChainId: number;
  targetChainHex: string;
  targetChainRpcUrl: string;
  targetChainParams: {
    chainId: string;
    chainName: string;
    nativeCurrency: {
      name: string;
      symbol: string;
      decimals: number;
    };
    rpcUrls: readonly string[];
    blockExplorerUrls: readonly string[];
  };
  supportedChainIds: number[];
  supportedChainNames: string;
};

const DEFAULT_RUNTIME_BY_CHAIN = {
  "arb-sepolia": {
    contractAddress: "0xAeCaDDa189f35EfB69C2dCc37688030A9Af58DC3",
    auditorDisclosureAddress: "0x328Fe7B46ddf38888978C3f6CDC49233810ccE49",
    directSettlementAdapterAddress: "0x4d0EbdE132402145D464089Fd7bE7362dec6f428",
    wrapperSettlementAdapterAddress: "0x892DEaAaf13fb4a5a57288bB6089565c3cdB95e0",
    backendBaseUrl: "http://127.0.0.1:4000",
    defaultOrgId: "cipherroll-default-org"
  }
} as const;

function isSupportedChainKey(value: string | undefined): value is SupportedChainKey {
  return typeof value === "string" && value in SUPPORTED_CHAIN_CONFIG;
}

export function getCipherRollRuntimeConfig(
  env: Record<string, string | undefined>,
  targetChainKey: SupportedChainKey = "arb-sepolia"
): CipherRollRuntimeConfig {
  const resolvedTargetChainKey = isSupportedChainKey(env.NEXT_PUBLIC_CIPHERROLL_TARGET_CHAIN)
    ? env.NEXT_PUBLIC_CIPHERROLL_TARGET_CHAIN
    : targetChainKey;
  const chain = SUPPORTED_CHAIN_CONFIG[resolvedTargetChainKey];
  const defaults = DEFAULT_RUNTIME_BY_CHAIN[resolvedTargetChainKey];

  return {
    contractAddress: env.NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS || defaults.contractAddress,
    auditorDisclosureAddress:
      env.NEXT_PUBLIC_CIPHERROLL_AUDITOR_DISCLOSURE_ADDRESS || defaults.auditorDisclosureAddress,
    directSettlementAdapterAddress:
      env.NEXT_PUBLIC_CIPHERROLL_DIRECT_SETTLEMENT_ADAPTER || defaults.directSettlementAdapterAddress,
    wrapperSettlementAdapterAddress:
      env.NEXT_PUBLIC_CIPHERROLL_WRAPPER_SETTLEMENT_ADAPTER || defaults.wrapperSettlementAdapterAddress,
    backendBaseUrl:
      env.NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL ||
      env.CIPHERROLL_BACKEND_BASE_URL ||
      defaults.backendBaseUrl,
    defaultOrgId: env.NEXT_PUBLIC_DEFAULT_ORG_ID || defaults.defaultOrgId,
    targetChainKey: resolvedTargetChainKey,
    targetChainName: chain.name,
    targetChainId: chain.chainId,
    targetChainHex: chain.chainIdHex,
    targetChainRpcUrl: chain.rpcUrls[0],
    targetChainParams: {
      chainId: chain.chainIdHex,
      chainName: chain.name,
      nativeCurrency: chain.nativeCurrency,
      rpcUrls: chain.rpcUrls,
      blockExplorerUrls: chain.blockExplorerUrls
    },
    supportedChainIds: Object.values(SUPPORTED_CHAIN_CONFIG).map(
      (supportedChain) => supportedChain.chainId
    ),
    supportedChainNames: chain.name
  };
}

export function toBytes32Label(input: string): string {
  const value = input.trim();
  if (!value) return keccak256(toUtf8Bytes("wave1"));
  return keccak256(toUtf8Bytes(value));
}

export function makeDeterministicLabel(prefix: string, suffix?: string) {
  return toBytes32Label([prefix, suffix].filter(Boolean).join(":"));
}

function makeEntropyToken(): string {
  const cryptoObject = globalThis.crypto;

  if (cryptoObject && typeof cryptoObject.randomUUID === "function") {
    return cryptoObject.randomUUID().replace(/-/g, "");
  }

  if (cryptoObject && typeof cryptoObject.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoObject.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function makeHighEntropyLabel(prefix: string, hint?: string) {
  const normalizedHint = hint
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return [prefix, normalizedHint, makeEntropyToken()].filter(Boolean).join(":");
}

export function makeHighEntropyBytes32Label(prefix: string, hint?: string) {
  return toBytes32Label(makeHighEntropyLabel(prefix, hint));
}

export function safeAddress(value: string): string | null {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim()) ? value.trim() : null;
}

export function formatBytes32Preview(value: string): string {
  if (!value) return "Not set";
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}
