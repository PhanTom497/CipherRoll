// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {FHE, euint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {IMockFHERC20ERC20Wrapper} from "./interfaces/IMockFHERC20ERC20Wrapper.sol";

contract MockConfidentialPayrollToken is IMockFHERC20ERC20Wrapper {
    using SafeERC20 for IERC20;

    struct PendingUnshield {
        address recipient;
        uint64 amount;
        bool exists;
    }

    IERC20 private immutable _underlying;
    // Keep 9 decimal places of underlying precision while still fitting
    // production-style payroll amounts into the wrapper's uint64 cleartext lane.
    uint256 public constant override rate = 10 ** 9;

    mapping(address => uint64) private _wrappedBalances;
    mapping(bytes32 => PendingUnshield) private _pendingUnshields;

    constructor(IERC20 underlyingToken) {
        _underlying = underlyingToken;
    }

    function shield(address to, uint256 amount) external returns (euint64) {
        require(to != address(0), "CipherRoll: wrapper recipient required");
        require(amount >= rate, "CipherRoll: wrapper amount too small");

        uint64 wrappedAmount = uint64(amount / rate);
        require(uint256(wrappedAmount) * rate == amount, "CipherRoll: wrapper amount misaligned");

        _underlying.safeTransferFrom(msg.sender, address(this), amount);
        _wrappedBalances[to] += wrappedAmount;

        euint64 encryptedAmount = FHE.asEuint64(wrappedAmount);
        FHE.allowThis(encryptedAmount);
        FHE.allow(encryptedAmount, to);

        return encryptedAmount;
    }

    function unshield(address from, address to, uint64 amount) external returns (euint64) {
        require(msg.sender == from, "CipherRoll: wrapper sender mismatch");
        require(to != address(0), "CipherRoll: wrapper payout required");
        require(_wrappedBalances[from] >= amount, "CipherRoll: wrapper balance insufficient");

        _wrappedBalances[from] -= amount;

        euint64 encryptedRequest = FHE.asEuint64(amount);
        FHE.allowThis(encryptedRequest);
        FHE.allow(encryptedRequest, to);
        FHE.allowPublic(encryptedRequest);

        _pendingUnshields[euint64.unwrap(encryptedRequest)] = PendingUnshield({
            recipient: to,
            amount: amount,
            exists: true
        });

        return encryptedRequest;
    }

    function claimUnshielded(
        bytes32 unshieldRequestId,
        uint64 unshieldAmountCleartext,
        bytes calldata decryptionProof
    ) external {
        PendingUnshield memory pending = _pendingUnshields[unshieldRequestId];
        require(pending.exists, "CipherRoll: wrapper request missing");
        require(
            FHE.verifyDecryptResultSafe(uint256(unshieldRequestId), unshieldAmountCleartext, decryptionProof),
            "CipherRoll: invalid wrapper settlement proof"
        );
        require(pending.amount == unshieldAmountCleartext, "CipherRoll: wrapper amount mismatch");

        delete _pendingUnshields[unshieldRequestId];
        _underlying.safeTransfer(pending.recipient, uint256(unshieldAmountCleartext) * rate);
    }

    function underlying() external view returns (address) {
        return address(_underlying);
    }
}
