// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ITreasuryAdapter {
    function adapterId() external pure returns (bytes32);

    function adapterName() external pure returns (string memory);

    function supportsConfidentialSettlement() external pure returns (bool);
}
