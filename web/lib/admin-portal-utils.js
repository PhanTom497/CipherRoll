"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDecimalAmountToWei = parseDecimalAmountToWei;
exports.extractCipherRollErrorMessage = extractCipherRollErrorMessage;
exports.shortHash = shortHash;
exports.formatTokenAmount = formatTokenAmount;
const ethers_1 = require("ethers");
const DECIMAL_AMOUNT_PATTERN = /^\d+(\.\d{1,18})?$/;
function parseDecimalAmountToWei(input) {
    const normalized = input.trim();
    if (!DECIMAL_AMOUNT_PATTERN.test(normalized))
        return null;
    try {
        const value = (0, ethers_1.parseUnits)(normalized, 18);
        return value > 0n ? value : null;
    }
    catch {
        return null;
    }
}
function extractCipherRollErrorMessage(error) {
    const message = typeof error === "string"
        ? error
        : error instanceof Error
            ? error.message
            : typeof error === "object" && error !== null
                ? JSON.stringify(error)
                : "Unknown error";
    const errorCode = typeof error === "object" && error !== null && "code" in error
        ? error.code
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
    if (/payroll run exists/i.test(message)) {
        return "This payroll run label already exists. Reuse the existing run or choose a different label.";
    }
    if (/funding deadline required/i.test(message)) {
        return "Choose a funding deadline that is still in the future.";
    }
    if (/headcount required/i.test(message)) {
        return "This payroll run needs at least one planned employee.";
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
    if (/payroll run has no allocations/i.test(message)) {
        return "Add the employee allocation to this payroll run before funding or activating it.";
    }
    if (/funding window closed/i.test(message)) {
        return "This payroll run's funding deadline has already passed. Create a new run with a later deadline.";
    }
    if (/invalid vesting/i.test(message)) {
        return "The vesting schedule is not valid. Choose an end time that comes after the start time.";
    }
    if (/payment missing/i.test(message)) {
        return "This payroll item could not be found anymore. Refresh the portal and try again.";
    }
    if (/payment exists/i.test(message)) {
        return "This payroll entry already exists. Please try sending it again as a new payment.";
    }
    if (/already claimed/i.test(message)) {
        return "This payroll item was already claimed.";
    }
    if (/settlement proof required/i.test(message)) {
        return "This payroll item now settles into a real token payout, so CipherRoll needs a verified claim proof from your wallet before submitting it.";
    }
    if (/settlement unavailable/i.test(message)) {
        return "This workspace does not have a live payroll settlement route configured yet.";
    }
    if (/settlement asset missing/i.test(message)) {
        return "The payroll treasury route is missing its payout asset configuration.";
    }
    if (/wrapper settlement requires request\/finalize/i.test(message)) {
        return "This payroll route uses the FHERC20 wrapper flow. First request the payout, then finalize the wrapper claim to release the underlying token.";
    }
    if (/wrapper settlement unsupported/i.test(message)) {
        return "This treasury route does not support the confidential wrapper payout flow.";
    }
    if (/settlement already pending/i.test(message)) {
        return "This payroll item already has a pending wrapper payout. Finalize that payout instead of starting a new one.";
    }
    if (/settlement request missing|settlement request mismatch/i.test(message)) {
        return "CipherRoll could not find the pending wrapper payout for this payroll item. Refresh payroll and try again.";
    }
    if (/settlement amount not wrapper-aligned/i.test(message)) {
        return "This payroll amount is not compatible with the current wrapper precision. Use a token amount with standard payroll decimals and try again.";
    }
    if (/treasury route requires funded asset/i.test(message)) {
        return "This workspace uses treasury-backed payroll funding. Deposit token inventory into the treasury and reserve it into the payroll run instead of using budget-only funding.";
    }
    if (/treasury route missing/i.test(message)) {
        return "This workspace does not have a payroll treasury configured yet.";
    }
    if (/treasury amount required/i.test(message)) {
        return "Enter a positive amount before reserving treasury funds for the payroll run.";
    }
    if (/treasury funds unavailable/i.test(message)) {
        return "The treasury does not have enough available token inventory for that funding request.";
    }
    if (/treasury reserve insufficient|payroll run reserve insufficient/i.test(message)) {
        return "The payroll treasury reserve is not large enough to settle that claim anymore. Refresh the workspace and review treasury funding.";
    }
    if (/invalid settlement proof/i.test(message)) {
        return "CipherRoll could not verify the payout amount from your wallet proof. Refresh payroll and try the claim again.";
    }
    if (/vesting active/i.test(message)) {
        return "This payroll item is still vesting and cannot be claimed yet.";
    }
    if (/not employee/i.test(message)) {
        return "This wallet is not allowed to claim that payroll item.";
    }
    if (/NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS/i.test(message)) {
        return "The frontend contract address is not configured.";
    }
    if (/CALL_EXCEPTION|require\(false\)|no data present/i.test(message)) {
        return "The running frontend is still pointed at an older CipherRoll deployment. Restart the dev server so it picks up the latest contract address, then refresh the page.";
    }
    if (/InvalidEncryptedInput|SecurityZoneOutOfBounds/i.test(message)) {
        return "CipherRoll could not prepare the private amount securely. Reconnect privacy mode and try again.";
    }
    if (/receipt was not observed in time/i.test(message)) {
        return "Your request may still be processing. Refresh the workspace in a few seconds to confirm the latest status.";
    }
    return message;
}
function shortHash(hash) {
    if (!hash)
        return null;
    return hash.length > 14 ? `${hash.slice(0, 8)}...${hash.slice(-6)}` : hash;
}
function formatTokenAmount(value, decimals = 18) {
    if (!value)
        return "0";
    try {
        const formatted = (0, ethers_1.formatUnits)(BigInt(value), decimals);
        const [whole, fraction = ""] = formatted.split(".");
        const trimmed = fraction.replace(/0+$/, "");
        if (!trimmed)
            return whole;
        return `${whole}.${trimmed.slice(0, 4)}`;
    }
    catch {
        return value;
    }
}
