import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { backendConfig } from "./config";
import { provider } from "./contracts";

function extractTransactionHashes(filePath: string): string[] {
  if (!existsSync(filePath)) return [];
  const data = JSON.parse(readFileSync(filePath, "utf8")) as {
    transactions?: Record<string, string>;
  };
  return Object.values(data.transactions || {}).filter((value) => /^0x[a-fA-F0-9]{64}$/.test(value));
}

export async function deriveIndexerStartBlock() {
  if (backendConfig.explicitStartBlock != null) {
    return backendConfig.explicitStartBlock;
  }

  const candidateFiles = [
    resolve(__dirname, "../../outputs/arb-sepolia-live-smoke.json"),
    resolve(__dirname, "../../outputs/arb-sepolia-wrapper-live-smoke.json")
  ];

  const hashes = candidateFiles.flatMap(extractTransactionHashes);
  let smallestBlock: bigint | null = null;

  for (const hash of hashes) {
    const receipt = await provider.getTransactionReceipt(hash).catch(() => null);
    if (!receipt) continue;
    const blockNumber = BigInt(receipt.blockNumber);
    smallestBlock =
      smallestBlock == null || blockNumber < smallestBlock ? blockNumber : smallestBlock;
  }

  if (smallestBlock != null) {
    return smallestBlock > 2500n ? smallestBlock - 2500n : 0n;
  }

  const latest = BigInt(await provider.getBlockNumber());
  return latest > 5000n ? latest - 5000n : 0n;
}
