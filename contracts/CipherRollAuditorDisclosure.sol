// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, euint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {ICipherRollPayrollCore} from "./interfaces/ICipherRollPayrollCore.sol";

/// @title CipherRollAuditorDisclosure
/// @notice Aggregate-only auditor disclosure surface for shared-permit review
///         and provable audit receipts.
contract CipherRollAuditorDisclosure {
    enum AuditorAggregateMetric {
        Budget,
        Committed,
        Available
    }

    struct AuditorOrganizationSummary {
        bool treasuryRouteConfigured;
        bool supportsConfidentialSettlement;
        bytes32 treasuryRouteId;
        address settlementAsset;
        address confidentialSettlementAsset;
        uint256 availableTreasuryFunds;
        uint256 reservedTreasuryFunds;
        uint64 totalPayrollRuns;
        uint64 draftPayrollRuns;
        uint64 fundedPayrollRuns;
        uint64 activePayrollRuns;
        uint64 finalizedPayrollRuns;
        uint64 totalPayrollItems;
        uint64 activePayrollItems;
        uint64 claimedPayrollItems;
        uint64 vestingPayrollItems;
        uint64 employeeRecipients;
        uint64 lastIssuedAt;
        uint64 lastClaimedAt;
    }

    ICipherRollPayrollCore public immutable payrollCore;

    event AuditorAggregateDisclosureRecorded(
        bytes32 indexed orgId,
        uint8 indexed metric,
        address indexed auditor,
        uint128 cleartextValue,
        bool published
    );

    event AuditorAggregateDisclosureBatchRecorded(
        bytes32 indexed orgId,
        address indexed auditor,
        bytes32 indexed batchHash,
        bool published
    );

    constructor(address payrollCoreAddress) {
        require(payrollCoreAddress != address(0), "CR: core required");
        payrollCore = ICipherRollPayrollCore(payrollCoreAddress);
    }

    function getAuditorEncryptedSummaryHandles(
        bytes32 orgId
    )
        external
        view
        returns (euint128 budget, euint128 committed, euint128 available)
    {
        return payrollCore.getAuditorEncryptedSummaryHandles(orgId);
    }

    function getAuditorOrganizationSummary(
        bytes32 orgId
    ) external view returns (AuditorOrganizationSummary memory) {
        ICipherRollPayrollCore.Organization memory org = payrollCore.getOrganization(orgId);
        require(org.exists, "CipherRoll: unknown org");

        ICipherRollPayrollCore.OrganizationInsights memory insights = payrollCore
            .getAuditorOrganizationInsights(orgId);

        bytes32[] memory runIds = payrollCore.getOrganizationPayrollRunIds(orgId);
        uint64 totalRuns = uint64(runIds.length);
        uint64 draftRuns;
        uint64 fundedRuns;
        uint64 activeRuns;
        uint64 finalizedRuns;

        for (uint256 i = 0; i < runIds.length; i++) {
            ICipherRollPayrollCore.PayrollRun memory payrollRun = payrollCore.getPayrollRun(runIds[i]);

            if (payrollRun.status == ICipherRollPayrollCore.PayrollRunStatus.Draft) {
                draftRuns += 1;
            } else if (payrollRun.status == ICipherRollPayrollCore.PayrollRunStatus.Funded) {
                fundedRuns += 1;
            } else if (payrollRun.status == ICipherRollPayrollCore.PayrollRunStatus.Active) {
                activeRuns += 1;
            } else if (payrollRun.status == ICipherRollPayrollCore.PayrollRunStatus.Finalized) {
                finalizedRuns += 1;
            }
        }

        (
            address adapter,
            bytes32 routeId,
            ,
            ,
            bool supportsConfidentialSettlement,
            address settlementAsset,
            address confidentialSettlementAsset,
            uint256 availableTreasuryFunds,
            uint256 reservedTreasuryFunds
        ) = payrollCore.getTreasuryAdapterDetails(orgId);

        return AuditorOrganizationSummary({
            treasuryRouteConfigured: adapter != address(0),
            supportsConfidentialSettlement: supportsConfidentialSettlement,
            treasuryRouteId: routeId,
            settlementAsset: settlementAsset,
            confidentialSettlementAsset: confidentialSettlementAsset,
            availableTreasuryFunds: availableTreasuryFunds,
            reservedTreasuryFunds: reservedTreasuryFunds,
            totalPayrollRuns: totalRuns,
            draftPayrollRuns: draftRuns,
            fundedPayrollRuns: fundedRuns,
            activePayrollRuns: activeRuns,
            finalizedPayrollRuns: finalizedRuns,
            totalPayrollItems: insights.totalPayrollItems,
            activePayrollItems: insights.activePayrollItems,
            claimedPayrollItems: insights.claimedPayrollItems,
            vestingPayrollItems: insights.vestingPayrollItems,
            employeeRecipients: insights.employeeRecipients,
            lastIssuedAt: insights.lastIssuedAt,
            lastClaimedAt: insights.lastClaimedAt
        });
    }

    function getAuditorAggregateHandle(
        bytes32 orgId,
        AuditorAggregateMetric metric
    ) external view returns (bytes32) {
        return euint128.unwrap(_auditorAggregateValue(orgId, metric));
    }

    function verifyAuditorAggregateDisclosure(
        bytes32 orgId,
        AuditorAggregateMetric metric,
        uint128 cleartextValue,
        bytes calldata signature
    ) external {
        euint128 metricHandle = _auditorAggregateValue(orgId, metric);
        require(
            FHE.verifyDecryptResult(metricHandle, cleartextValue, signature),
            "CR: invalid auditor proof"
        );

        emit AuditorAggregateDisclosureRecorded(
            orgId,
            uint8(metric),
            msg.sender,
            cleartextValue,
            false
        );
    }

    function publishAuditorAggregateDisclosure(
        bytes32 orgId,
        AuditorAggregateMetric metric,
        uint128 cleartextValue,
        bytes calldata signature
    ) external {
        euint128 metricHandle = _auditorAggregateValue(orgId, metric);
        FHE.publishDecryptResult(metricHandle, cleartextValue, signature);

        emit AuditorAggregateDisclosureRecorded(
            orgId,
            uint8(metric),
            msg.sender,
            cleartextValue,
            true
        );
    }

    function verifyAuditorAggregateDisclosureBatch(
        bytes32 orgId,
        AuditorAggregateMetric[] calldata metrics,
        uint128[] calldata cleartextValues,
        bytes[] calldata signatures
    ) external {
        require(metrics.length > 0, "CR: batch empty");
        require(metrics.length == cleartextValues.length, "CR: batch length");
        require(metrics.length == signatures.length, "CR: batch sig length");

        bytes32[] memory ctHashes = new bytes32[](metrics.length);

        for (uint256 i = 0; i < metrics.length; i++) {
            euint128 metricHandle = _auditorAggregateValue(orgId, metrics[i]);
            ctHashes[i] = euint128.unwrap(metricHandle);
            require(
                FHE.verifyDecryptResult(metricHandle, cleartextValues[i], signatures[i]),
                "CR: invalid batch proof"
            );
        }

        bytes32 batchHash = keccak256(abi.encode(metrics, cleartextValues, ctHashes));
        emit AuditorAggregateDisclosureBatchRecorded(
            orgId,
            msg.sender,
            batchHash,
            false
        );
    }

    function publishAuditorAggregateDisclosureBatch(
        bytes32 orgId,
        AuditorAggregateMetric[] calldata metrics,
        uint128[] calldata cleartextValues,
        bytes[] calldata signatures
    ) external {
        require(metrics.length > 0, "CR: batch empty");
        require(metrics.length == cleartextValues.length, "CR: batch length");
        require(metrics.length == signatures.length, "CR: batch sig length");

        bytes32[] memory ctHashes = new bytes32[](metrics.length);

        for (uint256 i = 0; i < metrics.length; i++) {
            euint128 metricHandle = _auditorAggregateValue(orgId, metrics[i]);
            ctHashes[i] = euint128.unwrap(metricHandle);
            FHE.publishDecryptResult(metricHandle, cleartextValues[i], signatures[i]);
        }

        bytes32 batchHash = keccak256(abi.encode(metrics, cleartextValues, ctHashes));
        emit AuditorAggregateDisclosureBatchRecorded(
            orgId,
            msg.sender,
            batchHash,
            true
        );
    }

    function _auditorAggregateValue(
        bytes32 orgId,
        AuditorAggregateMetric metric
    ) internal view returns (euint128) {
        (euint128 budget, euint128 committed, euint128 available) = payrollCore
            .getAuditorEncryptedSummaryHandles(orgId);

        if (metric == AuditorAggregateMetric.Budget) {
            return budget;
        }

        if (metric == AuditorAggregateMetric.Committed) {
            return committed;
        }

        if (metric == AuditorAggregateMetric.Available) {
            return available;
        }

        revert("CR: unknown metric");
    }
}
