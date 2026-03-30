'use client'

import { CONTRACT_ADDRESS } from "./cipherroll-config";
import { cofhejs, Encryptable, FheTypes } from "cofhejs/web";

import { BrowserProvider } from "ethers";

/**
 * Initialize cofhejs with the user's browser wallet.
 * Must be called once after the user connects their wallet.
 */
export async function initCofhe(provider: any): Promise<void> {
  try {
    const ethersProvider = new BrowserProvider(provider);
    const ethersSigner = await ethersProvider.getSigner();

    await cofhejs.initializeWithEthers({
      ethersProvider,
      ethersSigner,
      environment: "TESTNET"
    });
  } catch (err) {
    console.warn("cofhejs initialization warning:", err);
  }
}

/**
 * Encrypt a uint128 value using cofhejs for on-chain submission.
 * Returns the encrypted input struct ready for contract calls.
 */
export async function encryptUint128(value: bigint) {
  const result = await cofhejs.encrypt(
    [Encryptable.uint128(value)],
    (step: any) => { console.log(`Encrypt step: ${step}`); }
  );
  if (!result.success) throw result.error;
  const [encrypted] = result.data;
  return encrypted;
}

/**
 * Unseal an encrypted euint128 handle from the contract.
 * Uses cofhejs.unseal() which decrypts client-side, maintaining privacy.
 * Returns the plaintext value formatted as a human-readable string.
 */
export async function unsealUint128(
  ctHash: string
): Promise<string | null> {
  if (!ctHash || ctHash === "0x" + "0".repeat(64)) return null;

  try {
    const result = await cofhejs.unseal(BigInt(ctHash), FheTypes.Uint128);
    if (!result.success || result.data == null) return null;

    const valueInWei = result.data.toString();

    if (valueInWei.length <= 18) {
      return (Number(valueInWei) / 1e18).toString();
    }
    const integerPart = valueInWei.slice(0, -18) || "0";
    const fractionPart = valueInWei.slice(-18).replace(/0+$/, "");
    return fractionPart.length > 0 ? `${integerPart}.${fractionPart}` : integerPart;
  } catch (err) {
    console.error("unseal failed:", err);
    return null;
  }
}
