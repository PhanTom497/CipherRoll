'use client'

import { createCofheConfig, createCofheClient } from "@cofhe/sdk/web";
import { Encryptable, FheTypes } from "@cofhe/sdk";
import type { DecryptForTxResult } from "@cofhe/sdk";
import {
  PermitUtils,
  ValidationUtils,
  setActivePermitHash,
  setPermit,
  type Permit
} from "@cofhe/sdk/permits";
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
const COFHE_CHUNK_RELOAD_KEY = "cipherroll-cofhe-chunk-reload";

export function getClient() {
  if (typeof window === "undefined") {
    return null;
  }
  if (!clientInstance) {
    const config = createCofheConfig({
      supportedChains: [chains.arbSepolia, chains.baseSepolia],
      // The default web key cache uses an iframe-backed storage bridge.
      // In this app that bridge has proven less reliable than refetching
      // the public FHE key material for the current browser session.
      fheKeyStorage: null
    });
    clientInstance = createCofheClient(config);
  }
  return clientInstance;
}

function resetClient() {
  clientInstance = null;
}

function isChunkLoadFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    /Loading chunk/i.test(message) ||
    /ChunkLoadError/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /tfhe_snippets/i.test(message)
  );
}

export async function getOrCreateSelfPermit() {
  const client = getClient();
  if (!client) {
    throw new Error("CoFHE client is unavailable in this browser session.");
  }

  const activePermit = client.permits.getActivePermit() as Permit | undefined;

  if (activePermit?.type === "self") {
    if (!ValidationUtils.isExpired(activePermit)) {
      return activePermit;
    }

    const chainId = activePermit._signedDomain?.chainId;
    client.permits.removePermit(activePermit.hash, chainId, activePermit.issuer);
  }

  const permit = await client.permits.getOrCreateSelfPermit();

  if (permit.type !== "self") {
    throw new Error("CipherRoll could not create a self permit for this wallet.");
  }

  if (ValidationUtils.isExpired(permit)) {
    const chainId = permit._signedDomain?.chainId;
    client.permits.removePermit(permit.hash, chainId, permit.issuer);
    return client.permits.createSelf({
      issuer: permit.issuer,
      name: "CipherRoll Privacy Permit"
    });
  }

  return permit;
}

function shouldRefreshExpiredPermit(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /Permit is expired/i.test(message);
}

async function withFreshSelfPermit<T>(
  action: (permit: Permit) => Promise<T>,
  permit?: Permit
): Promise<T> {
  const initialPermit = permit ?? (await getOrCreateSelfPermit());

  try {
    return await action(initialPermit);
  } catch (error) {
    if (!permit && shouldRefreshExpiredPermit(error)) {
      const client = getClient();
      if (!client) {
        throw error;
      }

      const chainId = initialPermit._signedDomain?.chainId;
      client.permits.removePermit(initialPermit.hash, chainId, initialPermit.issuer);
      const refreshedPermit = await getOrCreateSelfPermit();
      return action(refreshedPermit);
    }

    throw error;
  }
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
  try {
    const client = getClient();
    if (!client) {
      throw new Error("CoFHE client is unavailable in this browser session.");
    }

    const ethersProvider =
      provider instanceof BrowserProvider ? provider : new BrowserProvider(provider);
    const ethersSigner = await ethersProvider.getSigner();
    const { publicClient, walletClient } = await Ethers6Adapter(ethersProvider, ethersSigner);

    await client.connect(publicClient, walletClient);

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(COFHE_CHUNK_RELOAD_KEY);
    }
  } catch (error) {
    if (typeof window !== "undefined" && isChunkLoadFailure(error)) {
      const alreadyRetried = window.sessionStorage.getItem(COFHE_CHUNK_RELOAD_KEY) === "1";
      resetClient();

      if (!alreadyRetried) {
        window.sessionStorage.setItem(COFHE_CHUNK_RELOAD_KEY, "1");
        window.setTimeout(() => {
          window.location.reload();
        }, 150);
        throw new Error("CipherRoll needs a quick refresh to finish loading privacy mode. Refreshing now.");
      }

      throw new Error("Privacy mode did not finish loading in this tab. Please refresh the page once and try again.");
    }

    throw error;
  }
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
  permit?: Permit
): Promise<string | null> {
  if (!ctHash || ctHash === ZERO_CIPHERTEXT_HANDLE) return null;

  const client = getClient();
  if (!client) return null;

  try {
    const decryptedValue = await withFreshSelfPermit<bigint>(
      (activePermit) =>
        client
          .decryptForView(ctHash, FheTypes.Uint128)
          .withPermit(activePermit)
          .execute(),
      permit
    );
      
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
): Promise<DecryptForTxResult | null> {
  if (!ctHash || ctHash === ZERO_CIPHERTEXT_HANDLE) return null;

  const client = getClient();
  if (!client) return null;

  return withFreshSelfPermit<DecryptForTxResult>(
    (activePermit) =>
      client
        .decryptForTx(ctHash)
        .withPermit(activePermit)
        .execute(),
    permit
  );
}

export async function decryptUint64ForTxWithoutPermit(
  ctHash: CiphertextHandle
): Promise<DecryptForTxResult | null> {
  if (!ctHash || ctHash === ZERO_CIPHERTEXT_HANDLE) return null;

  const client = getClient();
  if (!client) return null;

  return client
    .decryptForTx(ctHash)
    .withoutPermit()
    .execute();
}
