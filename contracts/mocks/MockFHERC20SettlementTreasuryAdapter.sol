// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

import {FHE} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {IFHERC20ERC20Wrapper} from "fhenix-confidential-contracts/contracts/interfaces/IFHERC20ERC20Wrapper.sol";
import {ITreasuryAdapter} from "../interfaces/ITreasuryAdapter.sol";

contract MockFHERC20SettlementTreasuryAdapter is ITreasuryAdapter {
    using SafeERC20 for IERC20;

    bytes32 private constant ADAPTER_ID =
        0xc884667db17b0f78232d4d96f350d55e168febfb5743652097d7073a91ca7199;

    struct PendingSettlement {
        bytes32 requestId;
        bytes32 orgId;
        bytes32 payrollRunId;
        address employee;
        uint256 requestedUnderlyingAmount;
        bool exists;
    }

    IERC20 public immutable payrollToken;
    IFHERC20ERC20Wrapper public immutable confidentialPayrollToken;
    address public immutable payrollContract;

    mapping(bytes32 => uint256) private _availablePayrollFunds;
    mapping(bytes32 => uint256) private _reservedPayrollFunds;
    mapping(bytes32 => uint256) private _reservedPayrollRunFunds;
    mapping(bytes32 => PendingSettlement) private _pendingSettlements;

    error PayrollOnly();

    constructor(
        address payrollContract_,
        IERC20 payrollToken_,
        IFHERC20ERC20Wrapper confidentialPayrollToken_
    ) {
        payrollContract = payrollContract_;
        payrollToken = payrollToken_;
        confidentialPayrollToken = confidentialPayrollToken_;
    }

    function adapterId() external pure returns (bytes32) {
        return ADAPTER_ID;
    }

    function adapterName() external pure returns (string memory) {
        return "CipherRoll Mock FHERC20 Treasury";
    }

    function supportsConfidentialSettlement() external pure returns (bool) {
        return true;
    }

    function settlementAsset() external view returns (address) {
        return address(payrollToken);
    }

    function confidentialSettlementAsset() external view returns (address) {
        return address(confidentialPayrollToken);
    }

    function availablePayrollFunds(bytes32 orgId) external view returns (uint256) {
        return _availablePayrollFunds[orgId];
    }

    function reservedPayrollFunds(bytes32 orgId) external view returns (uint256) {
        return _reservedPayrollFunds[orgId];
    }

    function depositPayrollFunds(bytes32 orgId, uint256 amount) external {
        payrollToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 rate = confidentialPayrollToken.rate();
        uint256 acceptedAmount = amount - (amount % rate);
        uint256 refund = amount - acceptedAmount;

        if (refund > 0) {
            payrollToken.safeTransfer(msg.sender, refund);
        }

        require(acceptedAmount > 0, "CipherRoll: treasury amount required");

        payrollToken.forceApprove(address(confidentialPayrollToken), acceptedAmount);
        confidentialPayrollToken.shield(address(this), acceptedAmount);
        _availablePayrollFunds[orgId] += acceptedAmount;
    }

    function reservePayrollFunding(
        bytes32 orgId,
        bytes32 payrollRunId,
        uint256 amount
    ) external {
        if (msg.sender != payrollContract) revert PayrollOnly();
        require(_availablePayrollFunds[orgId] >= amount, "CipherRoll: treasury funds unavailable");

        _availablePayrollFunds[orgId] -= amount;
        _reservedPayrollFunds[orgId] += amount;
        _reservedPayrollRunFunds[payrollRunId] += amount;
    }

    function settlePayroll(
        bytes32,
        bytes32,
        bytes32,
        address,
        uint256
    ) external pure {
        revert("CipherRoll: wrapper settlement requires request/finalize");
    }

    function requestPayrollSettlement(
        bytes32 orgId,
        bytes32 payrollRunId,
        bytes32 paymentId,
        address employee,
        uint256 cleartextAmount
    ) external returns (bytes32 requestId, address payoutAsset, address confidentialAsset) {
        if (msg.sender != payrollContract) revert PayrollOnly();
        require(_reservedPayrollFunds[orgId] >= cleartextAmount, "CipherRoll: treasury reserve insufficient");
        require(_reservedPayrollRunFunds[payrollRunId] >= cleartextAmount, "CipherRoll: payroll run reserve insufficient");
        require(!_pendingSettlements[paymentId].exists, "CipherRoll: settlement already pending");

        uint256 rate = confidentialPayrollToken.rate();
        require(cleartextAmount % rate == 0, "CipherRoll: settlement amount not wrapper-aligned");

        uint64 wrappedAmount = SafeCast.toUint64(cleartextAmount / rate);
        requestId = FHE.unwrap(confidentialPayrollToken.unshield(address(this), employee, wrappedAmount));

        _pendingSettlements[paymentId] = PendingSettlement({
            requestId: requestId,
            orgId: orgId,
            payrollRunId: payrollRunId,
            employee: employee,
            requestedUnderlyingAmount: cleartextAmount,
            exists: true
        });

        payoutAsset = address(payrollToken);
        confidentialAsset = address(confidentialPayrollToken);
    }

    function finalizePayrollSettlement(
        bytes32 orgId,
        bytes32 payrollRunId,
        bytes32 paymentId,
        address employee,
        bytes32 requestId,
        uint64 decryptedAmount,
        bytes calldata decryptionProof
    ) external returns (address payoutAsset, uint256 payoutAmount) {
        if (msg.sender != payrollContract) revert PayrollOnly();

        PendingSettlement memory pending = _pendingSettlements[paymentId];
        require(pending.exists, "CipherRoll: settlement request missing");
        require(pending.orgId == orgId, "CipherRoll: settlement org mismatch");
        require(pending.payrollRunId == payrollRunId, "CipherRoll: settlement run mismatch");
        require(pending.employee == employee, "CipherRoll: settlement employee mismatch");
        require(pending.requestId == requestId, "CipherRoll: settlement request mismatch");

        confidentialPayrollToken.claimUnshielded(requestId, decryptedAmount, decryptionProof);

        payoutAmount = uint256(decryptedAmount) * confidentialPayrollToken.rate();
        require(_reservedPayrollFunds[orgId] >= payoutAmount, "CipherRoll: treasury reserve insufficient");
        require(_reservedPayrollRunFunds[payrollRunId] >= payoutAmount, "CipherRoll: payroll run reserve insufficient");

        _reservedPayrollFunds[orgId] -= payoutAmount;
        _reservedPayrollRunFunds[payrollRunId] -= payoutAmount;
        delete _pendingSettlements[paymentId];

        payoutAsset = address(payrollToken);
    }
}
