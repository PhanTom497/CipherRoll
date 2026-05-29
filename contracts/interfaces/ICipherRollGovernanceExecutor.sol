// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface ICipherRollGovernanceExecutor {
    function isOrganizationAdmin(
        bytes32 orgId,
        address account
    ) external view returns (bool);

    function isGovernanceActive(
        bytes32 orgId
    ) external view returns (bool);

    function consumeApprovedProposalExecution(
        bytes32 executionKey,
        uint8 actionType,
        bytes32 payloadHash,
        address caller
    ) external returns (bytes32 orgId);
}
