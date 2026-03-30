import { keccak256, toUtf8Bytes } from "ethers";

export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS || "";

export const DEFAULT_ORG_ID =
  process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || "wave1-demo-org";

export const FHENIX_ENVIRONMENT =
  process.env.NEXT_PUBLIC_FHENIX_ENVIRONMENT || "TESTNET";

export const TARGET_CHAIN_NAME = "Ethereum Sepolia";
export const TARGET_CHAIN_ID = 11155111;

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
