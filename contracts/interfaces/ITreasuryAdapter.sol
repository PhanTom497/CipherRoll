// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ITreasuryAdapter {
    function adapterId() external pure returns (bytes32);

    function adapterName() external pure returns (string memory);

    function supportsConfidentialSettlement() external pure returns (bool);

    function settlementAsset() external view returns (address);

    function confidentialSettlementAsset() external view returns (address);

    function availablePayrollFunds(bytes32 orgId) external view returns (uint256);

    function reservedPayrollFunds(bytes32 orgId) external view returns (uint256);

    function depositPayrollFunds(bytes32 orgId, uint256 amount) external;

    function reservePayrollFunding(
        bytes32 orgId,
        bytes32 payrollRunId,
        uint256 amount
    ) external;

    function settlePayroll(
        bytes32 orgId,
        bytes32 payrollRunId,
        bytes32 paymentId,
        address employee,
        uint256 cleartextAmount
    ) external;

    function requestPayrollSettlement(
        bytes32 orgId,
        bytes32 payrollRunId,
        bytes32 paymentId,
        address employee,
        uint256 cleartextAmount
    ) external returns (bytes32 requestId, address payoutAsset, address confidentialAsset);

    function finalizePayrollSettlement(
        bytes32 orgId,
        bytes32 payrollRunId,
        bytes32 paymentId,
        address employee,
        bytes32 requestId,
        uint64 decryptedAmount,
        bytes calldata decryptionProof
    ) external returns (address payoutAsset, uint256 payoutAmount);
}
