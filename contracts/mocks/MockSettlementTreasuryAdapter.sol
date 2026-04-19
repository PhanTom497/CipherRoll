// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ITreasuryAdapter} from "../interfaces/ITreasuryAdapter.sol";

contract MockSettlementTreasuryAdapter is ITreasuryAdapter {
    using SafeERC20 for IERC20;

    bytes32 private constant ADAPTER_ID =
        0xc8279f3152c1c6fcf04dc2664d1161e5d2b89c6b3a2ea33b27f548aa57f53a8e;

    IERC20 public immutable payrollToken;
    address public immutable payrollContract;
    mapping(bytes32 => uint256) private _availablePayrollFunds;
    mapping(bytes32 => uint256) private _reservedPayrollFunds;
    mapping(bytes32 => uint256) private _reservedPayrollRunFunds;

    error PayrollOnly();

    constructor(address payrollContract_, IERC20 payrollToken_) {
        payrollContract = payrollContract_;
        payrollToken = payrollToken_;
    }

    function adapterId() external pure returns (bytes32) {
        return ADAPTER_ID;
    }

    function adapterName() external pure returns (string memory) {
        return "CipherRoll Mock Settlement Treasury";
    }

    function supportsConfidentialSettlement() external pure returns (bool) {
        return false;
    }

    function settlementAsset() external view returns (address) {
        return address(payrollToken);
    }

    function confidentialSettlementAsset() external pure returns (address) {
        return address(0);
    }

    function availablePayrollFunds(bytes32 orgId) external view returns (uint256) {
        return _availablePayrollFunds[orgId];
    }

    function reservedPayrollFunds(bytes32 orgId) external view returns (uint256) {
        return _reservedPayrollFunds[orgId];
    }

    function depositPayrollFunds(bytes32 orgId, uint256 amount) external {
        payrollToken.safeTransferFrom(msg.sender, address(this), amount);
        _availablePayrollFunds[orgId] += amount;
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
        bytes32 orgId,
        bytes32 payrollRunId,
        bytes32,
        address employee,
        uint256 cleartextAmount
    ) external {
        if (msg.sender != payrollContract) revert PayrollOnly();
        require(_reservedPayrollFunds[orgId] >= cleartextAmount, "CipherRoll: treasury reserve insufficient");
        require(_reservedPayrollRunFunds[payrollRunId] >= cleartextAmount, "CipherRoll: payroll run reserve insufficient");

        _reservedPayrollFunds[orgId] -= cleartextAmount;
        _reservedPayrollRunFunds[payrollRunId] -= cleartextAmount;

        if (cleartextAmount > 0) {
            payrollToken.safeTransfer(employee, cleartextAmount);
        }
    }

    function requestPayrollSettlement(
        bytes32,
        bytes32,
        bytes32,
        address,
        uint256
    ) external pure returns (bytes32, address, address) {
        revert("CipherRoll: wrapper settlement unsupported");
    }

    function finalizePayrollSettlement(
        bytes32,
        bytes32,
        bytes32,
        address,
        bytes32,
        uint64,
        bytes calldata
    ) external pure returns (address, uint256) {
        revert("CipherRoll: wrapper settlement unsupported");
    }
}
