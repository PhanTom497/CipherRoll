'use client'

import { createCofheConfig, createCofheClient } from "@cofhe/sdk/web";
import { Encryptable, FheTypes } from "@cofhe/sdk";
import { PermitUtils, setActivePermitHash, setPermit, type Permit } from "@cofhe/sdk/permits";
import { Ethers6Adapter } from "@cofhe/sdk/adapters";
import { chains } from "@cofhe/sdk/chains";
import {
  ZERO_CIPHERTEXT_HANDLE,
  type CiphertextHandle,
} from "./generated/cipherroll-abi";
import type { AuditorRecipientPermitView, AuditorSharingPermitView } from "./cipherroll-types";

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

export async function getOrCreateSelfPermit() {
  const client = getClient();
  if (!client) {
    throw new Error("CoFHE client is unavailable in this browser session.");
  }

  return client.permits.getOrCreateSelfPermit();
}

function toAuditorSharingPermitView(permit: Permit): AuditorSharingPermitView | null {
  if (permit.type !== "sharing") {
    return null;
  }

  return {
    hash: permit.hash,
    name: permit.name,
    issuer: permit.issuer,
    recipient: permit.recipient,
    expiration: permit.expiration,
    validatorId: permit.validatorId,
    validatorContract: permit.validatorContract,
    exportPayload: PermitUtils.export(permit)
  };
}

function toAuditorRecipientPermitView(permit: Permit): AuditorRecipientPermitView | null {
  if (permit.type !== "recipient") {
    return null;
  }

  return {
    hash: permit.hash,
    name: permit.name,
    issuer: permit.issuer,
    recipient: permit.recipient,
    expiration: permit.expiration,
    validatorId: permit.validatorId,
    validatorContract: permit.validatorContract
  };
}

export async function createAuditorSharingPermit(options: {
  issuer: string;
  recipient: string;
  name?: string;
  expiration?: number;
  validatorId?: number;
  validatorContract?: string;
}) {
  const client = getClient();
  if (!client) {
    throw new Error("CoFHE client is unavailable in this browser session.");
  }

  const permit = await client.permits.createSharing(options);
  const permitView = toAuditorSharingPermitView(permit);

  if (!permitView) {
    throw new Error("CipherRoll could not serialize the new auditor sharing permit.");
  }

  return {
    permit,
    exportPayload: permitView.exportPayload,
    permitView
  };
}

export function getAuditorSharingPermits(chainId?: number, account?: string): AuditorSharingPermitView[] {
  const client = getClient();
  if (!client) {
    return [];
  }

  return (Object.values(client.permits.getPermits(chainId, account)) as Permit[])
    .map((permit) => toAuditorSharingPermitView(permit))
    .filter((permit): permit is AuditorSharingPermitView => permit !== null)
    .sort((left, right) => right.expiration - left.expiration);
}

export function removeAuditorSharingPermit(hash: string, chainId?: number, account?: string) {
  const client = getClient();
  if (!client) {
    return;
  }

  client.permits.removePermit(hash, chainId, account);
}

export async function importAuditorSharingPermit(
  payload: string,
  chainId?: number,
  account?: string
) {
  const client = getClient();
  if (!client) {
    throw new Error("CoFHE client is unavailable in this browser session.");
  }

  const permit = await client.permits.importShared(payload);

  if (chainId != null && account) {
    setPermit(chainId, account, permit);
    setActivePermitHash(chainId, account, permit.hash);
  } else {
    client.permits.selectActivePermit(permit.hash);
  }

  return permit;
}

export function getAuditorRecipientPermits(chainId?: number, account?: string): AuditorRecipientPermitView[] {
  const client = getClient();
  if (!client) {
    return [];
  }

  return (Object.values(client.permits.getPermits(chainId, account)) as Permit[])
    .map((permit) => toAuditorRecipientPermitView(permit))
    .filter((permit): permit is AuditorRecipientPermitView => permit !== null)
    .sort((left, right) => right.expiration - left.expiration);
}

export function getActiveAuditorRecipientPermit(chainId?: number, account?: string): Permit | null {
  const client = getClient();
  if (!client) {
    return null;
  }

  const permit = client.permits.getActivePermit(chainId, account) as Permit | undefined;
  if (permit?.type === "recipient") {
    return permit;
  }

  const recipientPermit = (Object.values(client.permits.getPermits(chainId, account)) as Permit[])
    .find((candidate) => candidate.type === "recipient");

  if (recipientPermit) {
    client.permits.selectActivePermit(recipientPermit.hash, chainId, account);
    return recipientPermit;
  }

  return null;
}

export function selectAuditorRecipientPermit(hash: string, chainId?: number, account?: string) {
  const client = getClient();
  if (!client) {
    return;
  }

  client.permits.selectActivePermit(hash, chainId, account);
}

export function removeAuditorRecipientPermit(hash: string, chainId?: number, account?: string) {
  const client = getClient();
  if (!client) {
    return;
  }

  client.permits.removePermit(hash, chainId, account);
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
  ctHash: CiphertextHandle,
  permit?: unknown
): Promise<string | null> {
  if (!ctHash || ctHash === ZERO_CIPHERTEXT_HANDLE) return null;

  const client = getClient();
  if (!client) return null;

  try {
    const activePermit = permit ?? (await client.permits.getOrCreateSelfPermit());

    const decryptedValue = await client
      .decryptForView(ctHash, FheTypes.Uint128)
      .withPermit(activePermit)
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
export async function decryptUint128ForTx(
  ctHash: CiphertextHandle,
  permit?: Permit
) {
  if (!ctHash || ctHash === ZERO_CIPHERTEXT_HANDLE) return null;

  const client = getClient();
  if (!client) return null;

  const activePermit = permit ?? (await client.permits.getOrCreateSelfPermit());

  return client
    .decryptForTx(ctHash)
    .withPermit(activePermit)
    .execute();
}

export async function decryptUint64ForTxWithoutPermit(ctHash: CiphertextHandle) {
  if (!ctHash || ctHash === ZERO_CIPHERTEXT_HANDLE) return null;

  const client = getClient();
  if (!client) return null;

  return client
    .decryptForTx(ctHash)
    .withoutPermit()
    .execute();
}
