// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ITreasuryAdapter} from "../interfaces/ITreasuryAdapter.sol";

contract Wave1TreasuryAdapter is ITreasuryAdapter {
    bytes32 private constant ADAPTER_ID =
        0xe63d6b74acd7fc290ccc7023cf71c71605754109f267e16db6a1bd3a82ddd6b7;

    function adapterId() external pure returns (bytes32) {
        return ADAPTER_ID;
    }

    function adapterName() external pure returns (string memory) {
        return "CipherRoll Wave 1 Treasury Adapter";
    }

    function supportsConfidentialSettlement() external pure returns (bool) {
        return false;
    }

    function settlementAsset() external pure returns (address) {
        return address(0);
    }

    function confidentialSettlementAsset() external pure returns (address) {
        return address(0);
    }

    function availablePayrollFunds(bytes32) external pure returns (uint256) {
        return 0;
    }

    function reservedPayrollFunds(bytes32) external pure returns (uint256) {
        return 0;
    }

    function depositPayrollFunds(bytes32, uint256) external pure {
        revert("CipherRoll: settlement unsupported");
    }

    function reservePayrollFunding(bytes32, bytes32, uint256) external pure {
        revert("CipherRoll: settlement unsupported");
    }

    function settlePayroll(
        bytes32,
        bytes32,
        bytes32,
        address,
        uint256
    ) external pure {
        revert("CipherRoll: settlement unsupported");
    }

    function requestPayrollSettlement(
        bytes32,
        bytes32,
        bytes32,
        address,
        uint256
    ) external pure returns (bytes32, address, address) {
        revert("CipherRoll: settlement unsupported");
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
        revert("CipherRoll: settlement unsupported");
    }
}
