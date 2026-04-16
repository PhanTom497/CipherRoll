'use client'

import { createCofheConfig, createCofheClient } from "@cofhe/sdk/web";
import { Encryptable, FheTypes } from "@cofhe/sdk";
import { Ethers6Adapter } from "@cofhe/sdk/adapters";
import { chains } from "@cofhe/sdk/chains";
import {
  ZERO_CIPHERTEXT_HANDLE,
  type CiphertextHandle,
} from "./generated/cipherroll-abi";

import { BrowserProvider } from "ethers";

// Lazy initialization prevents Next.js SSR from touching the worker/iframe path
// before `window` and `document` are available in the browser.
let clientInstance: any = null;

export function getClient() {
  if (typeof window === "undefined") {
    return null;
  }
  if (!clientInstance) {
    const config = createCofheConfig({
      supportedChains: [chains.arbSepolia, chains.baseSepolia]
    });
    clientInstance = createCofheClient(config);
  }
  return clientInstance;
}

/**
 * Initialize @cofhe/sdk with the user's browser wallet.
 * Must be called once after the user connects their wallet.
 */
export async function initCofhe(provider: any): Promise<void> {
  const client = getClient();
  if (!client) {
    throw new Error("CoFHE client is unavailable in this browser session.");
  }

  const ethersProvider =
    provider instanceof BrowserProvider ? provider : new BrowserProvider(provider);
  const ethersSigner = await ethersProvider.getSigner();
  const { publicClient, walletClient } = await Ethers6Adapter(ethersProvider, ethersSigner);

  await client.connect(publicClient, walletClient);
}

/**
 * Encrypt a uint128 value using @cofhe/sdk builder pattern for on-chain submission.
 * Returns the encrypted input struct ready for contract calls.
 */
export async function encryptUint128(value: bigint) {
  const client = getClient();
  if (!client) throw new Error("Cofhe client not initialized on server");

  const [encrypted] = await client
    .encryptInputs([Encryptable.uint128(value)])
    .onStep((step: any) => { console.log(`Encrypt step: ${step}`); })
    .execute();
    
  return encrypted;
}

/**
 * Decrypt an encrypted euint128 handle from the contract for UI display.
 * Uses client.decryptForView() with an explicit self permit.
 * Returns the plaintext value formatted as a human-readable string.
 */
export async function decryptUint128ForView(
  ctHash: CiphertextHandle
): Promise<string | null> {
  if (!ctHash || ctHash === ZERO_CIPHERTEXT_HANDLE) return null;

  const client = getClient();
  if (!client) return null;

  try {
    const permit = await client.permits.getOrCreateSelfPermit();

    const decryptedValue = await client
      .decryptForView(ctHash, FheTypes.Uint128)
      .withPermit(permit)
      .execute();
      
    // Value will throw a CofheError or return successfully without Result wrapper
    const valueInWei = decryptedValue.toString();

    if (valueInWei.length <= 18) {
      return (Number(valueInWei) / 1e18).toString();
    }
    const integerPart = valueInWei.slice(0, -18) || "0";
    const fractionPart = valueInWei.slice(-18).replace(/0+$/, "");
    return fractionPart.length > 0 ? `${integerPart}.${fractionPart}` : integerPart;
  } catch (err) {
    console.error("@cofhe/sdk decryptForView failed:", err);
    return null;
  }
}

/**
 * Prepare a threshold-signed decrypt result for future transaction publishing
 * and audit receipt flows.
 */
export async function decryptUint128ForTx(ctHash: CiphertextHandle) {
  if (!ctHash || ctHash === ZERO_CIPHERTEXT_HANDLE) return null;

  const client = getClient();
  if (!client) return null;

  const permit = await client.permits.getOrCreateSelfPermit();

  return client
    .decryptForTx(ctHash)
    .withPermit(permit)
    .execute();
}
