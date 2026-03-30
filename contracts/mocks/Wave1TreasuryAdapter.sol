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
}
