import { config as loadDotenv } from "dotenv";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
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

export const backendConfig = {
  host: process.env.CIPHERROLL_BACKEND_HOST || process.env.HOST || "0.0.0.0",
  port: parsePort(),
  chainId: BigInt(parseInteger("CIPHERROLL_BACKEND_CHAIN_ID", 421614)),
  rpcUrl: requireEnv("ARBITRUM_SEPOLIA_RPC_URL"),
  payrollAddress: runtime.contractAddress || requireEnv("NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS"),
  auditorDisclosureAddress:
    runtime.auditorDisclosureAddress ||
    requireEnv("NEXT_PUBLIC_CIPHERROLL_AUDITOR_DISCLOSURE_ADDRESS"),
  dbPath: resolve(
    __dirname,
    "../../",
    process.env.CIPHERROLL_BACKEND_DB_PATH || "backend/data/cipherroll-index.sqlite"
  ),
  pollIntervalMs: parseInteger("CIPHERROLL_INDEXER_POLL_INTERVAL_MS", 30_000),
  chunkSize: parseInteger("CIPHERROLL_INDEXER_CHUNK_SIZE", 50_000),
  adminToken: process.env.CIPHERROLL_BACKEND_ADMIN_TOKEN || "",
  explicitStartBlock: process.env.CIPHERROLL_INDEXER_START_BLOCK
    ? BigInt(process.env.CIPHERROLL_INDEXER_START_BLOCK)
    : null
};

export function ensureBackendDirectories() {
  const directory = dirname(backendConfig.dbPath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
}
