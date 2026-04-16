import { parseUnits } from "ethers";

const DECIMAL_AMOUNT_PATTERN = /^\d+(\.\d{1,18})?$/;

export function parseDecimalAmountToWei(input: string): bigint | null {
  const normalized = input.trim();
  if (!DECIMAL_AMOUNT_PATTERN.test(normalized)) return null;

  try {
    const value = parseUnits(normalized, 18);
    return value > 0n ? value : null;
  } catch {
    return null;
  }
}

export function extractCipherRollErrorMessage(error: unknown): string {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : "Unknown error";

  const errorCode =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : null;

  if (/user rejected|rejected the request|denied transaction/i.test(message)) {
    return "The wallet approval was canceled, so nothing was submitted.";
  }

  if (errorCode === 4902 || /unrecognized chain id/i.test(message)) {
    return "Your wallet does not know this test network yet. Approve the Add Network prompt, then try again.";
  }

  if (/max fee per gas less than block base fee|could not coalesce error|underpriced/i.test(message)) {
    return "The network price changed while the wallet was preparing your request. Please try again now.";
  }

  if (/unknown org/i.test(message)) {
    return "This workspace has not been created yet.";
  }

  if (/org exists/i.test(message)) {
    return "A workspace with this ID already exists. Use a different name or reopen the existing workspace.";
  }

  if (/not admin/i.test(message)) {
    return "This wallet is not allowed to manage this workspace.";
  }

  if (/admin slots required/i.test(message)) {
    return "This workspace setup is incomplete. Please try creating it again.";
  }

  if (/invalid quorum/i.test(message)) {
    return "The approval settings for this workspace are not valid.";
  }

  if (/quorum required/i.test(message)) {
    return "This workspace needs at least one approver.";
  }

  if (/employee required/i.test(message)) {
    return "Enter a valid employee wallet before sending payroll.";
  }

  if (/payment exists/i.test(message)) {
    return "This payroll entry already exists. Please try sending it again as a new payment.";
  }

  if (/NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS/i.test(message)) {
    return "The frontend contract address is not configured.";
  }

  if (/InvalidEncryptedInput|SecurityZoneOutOfBounds/i.test(message)) {
    return "CipherRoll could not prepare the private amount securely. Reconnect privacy mode and try again.";
  }

  if (/receipt was not observed in time/i.test(message)) {
    return "Your request may still be processing. Refresh the workspace in a few seconds to confirm the latest status.";
  }

  return message;
}

export function shortHash(hash?: string | null): string | null {
  if (!hash) return null;
  return hash.length > 14 ? `${hash.slice(0, 8)}...${hash.slice(-6)}` : hash;
}
