import { keccak256, toUtf8Bytes } from "ethers";

const SUPPORTED_CHAIN_CONFIG = {
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
  },
  "base-sepolia": {
    chainId: 84532,
    name: "Base Sepolia",
    chainIdHex: "0x14a34",
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18
    },
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorerUrls: ["https://sepolia.basescan.org"]
  }
} as const;

export type SupportedChainKey = keyof typeof SUPPORTED_CHAIN_CONFIG;

export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS || "";

export const AUDITOR_DISCLOSURE_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CIPHERROLL_AUDITOR_DISCLOSURE_ADDRESS || "";

export const DIRECT_SETTLEMENT_ADAPTER_ADDRESS =
  process.env.NEXT_PUBLIC_CIPHERROLL_DIRECT_SETTLEMENT_ADAPTER || "";

export const WRAPPER_SETTLEMENT_ADAPTER_ADDRESS =
  process.env.NEXT_PUBLIC_CIPHERROLL_WRAPPER_SETTLEMENT_ADAPTER || "";

export const DEFAULT_ORG_ID =
  process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || "cipherroll-default-org";

const requestedTargetChain = process.env.NEXT_PUBLIC_CIPHERROLL_TARGET_CHAIN;

export const TARGET_CHAIN_KEY: SupportedChainKey =
  requestedTargetChain === "base-sepolia" ? "base-sepolia" : "arb-sepolia";

export const TARGET_CHAIN_NAME = SUPPORTED_CHAIN_CONFIG[TARGET_CHAIN_KEY].name;
export const TARGET_CHAIN_ID = SUPPORTED_CHAIN_CONFIG[TARGET_CHAIN_KEY].chainId;
export const TARGET_CHAIN_HEX = SUPPORTED_CHAIN_CONFIG[TARGET_CHAIN_KEY].chainIdHex;
export const TARGET_CHAIN_RPC_URL = SUPPORTED_CHAIN_CONFIG[TARGET_CHAIN_KEY].rpcUrls[0];
export const TARGET_CHAIN_PARAMS = {
  chainId: SUPPORTED_CHAIN_CONFIG[TARGET_CHAIN_KEY].chainIdHex,
  chainName: SUPPORTED_CHAIN_CONFIG[TARGET_CHAIN_KEY].name,
  nativeCurrency: SUPPORTED_CHAIN_CONFIG[TARGET_CHAIN_KEY].nativeCurrency,
  rpcUrls: SUPPORTED_CHAIN_CONFIG[TARGET_CHAIN_KEY].rpcUrls,
  blockExplorerUrls: SUPPORTED_CHAIN_CONFIG[TARGET_CHAIN_KEY].blockExplorerUrls
} as const;

export const SUPPORTED_CHAIN_IDS: number[] = Object.values(SUPPORTED_CHAIN_CONFIG).map(
  (chain) => chain.chainId
);

export const SUPPORTED_CHAIN_NAMES = Object.values(SUPPORTED_CHAIN_CONFIG)
  .map((chain) => chain.name)
  .join(" or ");

export function toBytes32Label(input: string): string {
  const value = input.trim();
  if (!value) return keccak256(toUtf8Bytes("wave1"));
  return keccak256(toUtf8Bytes(value));
}

export function makeDeterministicLabel(prefix: string, suffix?: string) {
  return toBytes32Label([prefix, suffix].filter(Boolean).join(":"));
}

export function safeAddress(value: string): string | null {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim()) ? value.trim() : null;
}

export function formatBytes32Preview(value: string): string {
  if (!value) return "Not set";
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}
