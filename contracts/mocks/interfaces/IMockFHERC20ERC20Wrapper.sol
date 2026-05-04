// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {euint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

interface IMockFHERC20ERC20Wrapper {
    function shield(address to, uint256 amount) external returns (euint64);

    function unshield(address from, address to, uint64 amount) external returns (euint64);

    function claimUnshielded(
        bytes32 unshieldRequestId,
        uint64 unshieldAmountCleartext,
        bytes calldata decryptionProof
    ) external;

    function rate() external view returns (uint256);

    function underlying() external view returns (address);
}
