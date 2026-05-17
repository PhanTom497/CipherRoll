import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { getCipherRollRuntimeConfig } from "../../packages/cipherroll-sdk/dist";

loadDotenv({ path: resolve(__dirname, "../../.env") });

const runtime = getCipherRollRuntimeConfig(process.env as Record<string, string | undefined>);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid integer value for ${name}: ${raw}`);
  }
  return value;
}

function parsePort() {
  const explicit = process.env.CIPHERROLL_BACKEND_PORT || process.env.PORT;
  if (!explicit) return 4000;
  const value = Number.parseInt(explicit, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid port value: ${explicit}`);
  }
  return value;
}

function parseBoolean(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (!raw) return fallback;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  throw new Error(`Invalid boolean value for ${name}: ${raw}`);
}

export const backendConfig = {
  host: process.env.CIPHERROLL_BACKEND_HOST || process.env.HOST || "0.0.0.0",
  port: parsePort(),
  chainId: BigInt(parseInteger("CIPHERROLL_BACKEND_CHAIN_ID", 421614)),
  rpcUrl: requireEnv("ARBITRUM_SEPOLIA_RPC_URL"),
  payrollAddress: runtime.contractAddress || requireEnv("NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS"),
  auditorDisclosureAddress:
    runtime.auditorDisclosureAddress ||
    requireEnv("NEXT_PUBLIC_CIPHERROLL_AUDITOR_DISCLOSURE_ADDRESS"),
  databaseUrl: requireEnv("CIPHERROLL_DATABASE_URL"),
  databaseSsl: parseBoolean("CIPHERROLL_DATABASE_SSL", true),
  pollIntervalMs: parseInteger("CIPHERROLL_INDEXER_POLL_INTERVAL_MS", 30_000),
  chunkSize: parseInteger("CIPHERROLL_INDEXER_CHUNK_SIZE", 50_000),
  adminToken: process.env.CIPHERROLL_BACKEND_ADMIN_TOKEN || "",
  explicitStartBlock: process.env.CIPHERROLL_INDEXER_START_BLOCK
    ? BigInt(process.env.CIPHERROLL_INDEXER_START_BLOCK)
    : null
};
