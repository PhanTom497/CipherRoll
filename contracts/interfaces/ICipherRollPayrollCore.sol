// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {euint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

interface ICipherRollPayrollCore {
    enum PayrollRunStatus {
        Draft,
        Funded,
        Active,
        Finalized
    }

    struct Organization {
        address admin;
        address treasuryAdapter;
        bytes32 metadataHash;
        bytes32 treasuryRouteId;
        uint64 reservedAdminSlots;
        uint64 reservedQuorum;
        uint64 createdAt;
        uint64 updatedAt;
        bool exists;
    }

    struct OrganizationInsights {
        uint64 totalPayrollItems;
        uint64 activePayrollItems;
        uint64 claimedPayrollItems;
        uint64 vestingPayrollItems;
        uint64 employeeRecipients;
        uint64 lastIssuedAt;
        uint64 lastClaimedAt;
    }

    struct PayrollRun {
        bytes32 orgId;
        bytes32 settlementAssetId;
        uint64 fundingDeadline;
        uint32 plannedHeadcount;
        uint32 allocationCount;
        uint32 claimedCount;
        uint64 createdAt;
        uint64 fundedAt;
        uint64 activatedAt;
        uint64 finalizedAt;
        PayrollRunStatus status;
        bool exists;
    }

    function getOrganization(
        bytes32 orgId
    ) external view returns (Organization memory);

    function getTreasuryAdapterDetails(
        bytes32 orgId
    )
        external
        view
        returns (
            address adapter,
            bytes32 routeId,
            bytes32 adapterId,
            string memory adapterName,
            bool supportsConfidentialSettlement,
            address settlementAsset,
            address confidentialSettlementAsset,
            uint256 availablePayrollFunds,
            uint256 reservedPayrollFunds
        );

    function getAuditorEncryptedSummaryHandles(
        bytes32 orgId
    )
        external
        view
        returns (euint128 budget, euint128 committed, euint128 available);

    function getPayrollRun(
        bytes32 payrollRunId
    ) external view returns (PayrollRun memory);

    function getOrganizationPayrollRunIds(
        bytes32 orgId
    ) external view returns (bytes32[] memory);

    function getAuditorOrganizationInsights(
        bytes32 orgId
    ) external view returns (OrganizationInsights memory);
}
