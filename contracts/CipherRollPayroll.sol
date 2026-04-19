// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, InEuint128, euint128, ebool} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {ITreasuryAdapter} from "./interfaces/ITreasuryAdapter.sol";

/// @title CipherRollPayroll
/// @notice Confidential payroll management using the CoFHE coprocessor stack.
///         All salary amounts are FHE-encrypted on-chain; only authorized
///         callers can decrypt via the CoFHE SDK client-side decryptForView() flow.
contract CipherRollPayroll {
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

    struct PayrollAllocationMeta {
        address employee;
        bytes32 paymentId;
        bytes32 memoHash;
        uint64 createdAt;
        bool isVesting;
        uint64 vestingStart;
        uint64 vestingEnd;
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

    struct PayrollSettlementRequest {
        bytes32 requestId;
        address payoutAsset;
        address confidentialAsset;
        uint64 requestedAt;
        bool exists;
    }

    mapping(bytes32 => Organization) private _organizations;
    mapping(bytes32 => euint128) private _encryptedBudget;
    mapping(bytes32 => euint128) private _encryptedCommitted;
    mapping(bytes32 => euint128) private _encryptedAvailable;
    mapping(bytes32 => PayrollAllocationMeta) private _allocations;
    mapping(bytes32 => euint128) private _allocationAmounts;
    mapping(bytes32 => bool) private _allocationClaimed;
    mapping(bytes32 => mapping(address => bytes32[])) private _employeePaymentIds;
    mapping(bytes32 => OrganizationInsights) private _organizationInsights;
    mapping(bytes32 => mapping(address => bool)) private _organizationEmployeeSeen;
    mapping(bytes32 => PayrollRun) private _payrollRuns;
    mapping(bytes32 => bytes32[]) private _organizationPayrollRunIds;
    mapping(bytes32 => bytes32) private _paymentPayrollRun;
    mapping(bytes32 => PayrollSettlementRequest) private _settlementRequests;

    event OrganizationCreated(
        bytes32 indexed orgId,
        address indexed admin,
        bytes32 metadataHash,
        uint64 reservedAdminSlots,
        uint64 reservedQuorum
    );

    event TreasuryConfigured(
        bytes32 indexed orgId,
        address indexed admin,
        address treasuryAdapter,
        bytes32 treasuryRouteId
    );

    event BudgetDeposited(
        bytes32 indexed orgId,
        address indexed admin,
        uint128 amount
    );

    event ConfidentialPayrollIssued(
        bytes32 indexed orgId,
        bytes32 indexed paymentId,
        address indexed employee,
        bytes32 memoHash
    );

    event PayrollClaimed(
        bytes32 indexed orgId,
        bytes32 indexed paymentId,
        address indexed employee
    );

    event PayrollSettled(
        bytes32 indexed orgId,
        bytes32 indexed paymentId,
        address indexed employee,
        address asset,
        uint256 amount
    );

    event PayrollSettlementRequested(
        bytes32 indexed orgId,
        bytes32 indexed paymentId,
        address indexed employee,
        address payoutAsset,
        address confidentialAsset,
        bytes32 requestId
    );

    event PayrollRunCreated(
        bytes32 indexed orgId,
        bytes32 indexed payrollRunId,
        bytes32 settlementAssetId,
        uint64 fundingDeadline,
        uint32 plannedHeadcount
    );

    event PayrollRunFunded(
        bytes32 indexed orgId,
        bytes32 indexed payrollRunId,
        address indexed admin
    );

    event PayrollRunTreasuryFunded(
        bytes32 indexed orgId,
        bytes32 indexed payrollRunId,
        address indexed admin,
        address asset,
        uint256 amount
    );

    event PayrollRunActivated(
        bytes32 indexed orgId,
        bytes32 indexed payrollRunId,
        address indexed admin
    );

    event PayrollRunFinalized(
        bytes32 indexed orgId,
        bytes32 indexed payrollRunId
    );

    modifier onlyOrgAdmin(bytes32 orgId) {
        require(_organizations[orgId].exists, "CipherRoll: unknown org");
        require(_organizations[orgId].admin == msg.sender, "CipherRoll: not admin");
        _;
    }

    modifier onlyExistingPayrollRun(bytes32 payrollRunId) {
        require(_payrollRuns[payrollRunId].exists, "CipherRoll: payroll run missing");
        _;
    }

    function createOrganization(
        bytes32 orgId,
        bytes32 metadataHash,
        uint64 reservedAdminSlots,
        uint64 reservedQuorum
    ) external {
        require(!_organizations[orgId].exists, "CipherRoll: org exists");
        require(reservedAdminSlots > 0, "CipherRoll: admin slots required");
        require(reservedQuorum > 0, "CipherRoll: quorum required");
        require(
            reservedQuorum <= reservedAdminSlots,
            "CipherRoll: invalid quorum"
        );

        _organizations[orgId] = Organization({
            admin: msg.sender,
            treasuryAdapter: address(0),
            metadataHash: metadataHash,
            treasuryRouteId: bytes32(0),
            reservedAdminSlots: reservedAdminSlots,
            reservedQuorum: reservedQuorum,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp),
            exists: true
        });

        euint128 zero = FHE.asEuint128(0);
        FHE.allowThis(zero);
        FHE.allow(zero, msg.sender);

        _encryptedBudget[orgId] = zero;
        _encryptedCommitted[orgId] = zero;
        _encryptedAvailable[orgId] = zero;

        emit OrganizationCreated(
            orgId,
            msg.sender,
            metadataHash,
            reservedAdminSlots,
            reservedQuorum
        );
    }

    function configureTreasury(
        bytes32 orgId,
        address treasuryAdapter,
        bytes32 treasuryRouteId
    ) external onlyOrgAdmin(orgId) {
        require(treasuryAdapter != address(0), "CipherRoll: adapter required");

        _organizations[orgId].treasuryAdapter = treasuryAdapter;
        _organizations[orgId].treasuryRouteId = treasuryRouteId;
        _organizations[orgId].updatedAt = uint64(block.timestamp);

        emit TreasuryConfigured(
            orgId,
            msg.sender,
            treasuryAdapter,
            treasuryRouteId
        );
    }

    function createPayrollRun(
        bytes32 orgId,
        bytes32 payrollRunId,
        bytes32 settlementAssetId,
        uint64 fundingDeadline,
        uint32 plannedHeadcount
    ) external onlyOrgAdmin(orgId) {
        require(!_payrollRuns[payrollRunId].exists, "CipherRoll: payroll run exists");
        require(fundingDeadline > uint64(block.timestamp), "CipherRoll: funding deadline required");
        require(plannedHeadcount > 0, "CipherRoll: headcount required");

        _payrollRuns[payrollRunId] = PayrollRun({
            orgId: orgId,
            settlementAssetId: settlementAssetId,
            fundingDeadline: fundingDeadline,
            plannedHeadcount: plannedHeadcount,
            allocationCount: 0,
            claimedCount: 0,
            createdAt: uint64(block.timestamp),
            fundedAt: 0,
            activatedAt: 0,
            finalizedAt: 0,
            status: PayrollRunStatus.Draft,
            exists: true
        });
        _organizationPayrollRunIds[orgId].push(payrollRunId);
        _organizations[orgId].updatedAt = uint64(block.timestamp);

        emit PayrollRunCreated(
            orgId,
            payrollRunId,
            settlementAssetId,
            fundingDeadline,
            plannedHeadcount
        );
    }

    function fundPayrollRun(
        bytes32 orgId,
        bytes32 payrollRunId,
        InEuint128 calldata encryptedAmount
    ) external onlyOrgAdmin(orgId) onlyExistingPayrollRun(payrollRunId) {
        require(_organizations[orgId].treasuryAdapter == address(0), "CipherRoll: treasury route requires funded asset");
        PayrollRun storage payrollRun = _payrollRuns[payrollRunId];
        require(payrollRun.orgId == orgId, "CipherRoll: payroll run org mismatch");
        require(payrollRun.status != PayrollRunStatus.Active, "CipherRoll: payroll run already active");
        require(payrollRun.status != PayrollRunStatus.Finalized, "CipherRoll: payroll run finalized");
        require(payrollRun.allocationCount > 0, "CipherRoll: payroll run has no allocations");
        require(block.timestamp <= payrollRun.fundingDeadline, "CipherRoll: funding window closed");

        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);

        euint128 availableBudget = _encryptedAvailable[orgId];
        ebool hasCapacity = FHE.gte(availableBudget, amount);
        euint128 zeroAmount = FHE.asEuint128(0);
        FHE.allowThis(zeroAmount);

        euint128 fundedAmount = FHE.select(hasCapacity, amount, zeroAmount);
        FHE.allowThis(fundedAmount);
        FHE.allow(fundedAmount, msg.sender);

        euint128 newCommitted = FHE.add(_encryptedCommitted[orgId], fundedAmount);
        FHE.allowThis(newCommitted);
        FHE.allow(newCommitted, msg.sender);

        euint128 newAvailable = FHE.sub(availableBudget, fundedAmount);
        FHE.allowThis(newAvailable);
        FHE.allow(newAvailable, msg.sender);

        _encryptedCommitted[orgId] = newCommitted;
        _encryptedAvailable[orgId] = newAvailable;
        payrollRun.status = PayrollRunStatus.Funded;
        payrollRun.fundedAt = uint64(block.timestamp);
        _organizations[orgId].updatedAt = uint64(block.timestamp);

        emit PayrollRunFunded(orgId, payrollRunId, msg.sender);
    }

    function fundPayrollRunFromTreasury(
        bytes32 orgId,
        bytes32 payrollRunId,
        uint128 cleartextAmount
    ) external onlyOrgAdmin(orgId) onlyExistingPayrollRun(payrollRunId) {
        PayrollRun storage payrollRun = _payrollRuns[payrollRunId];
        require(payrollRun.orgId == orgId, "CipherRoll: payroll run org mismatch");
        require(payrollRun.status != PayrollRunStatus.Active, "CipherRoll: payroll run already active");
        require(payrollRun.status != PayrollRunStatus.Finalized, "CipherRoll: payroll run finalized");
        require(payrollRun.allocationCount > 0, "CipherRoll: payroll run has no allocations");
        require(block.timestamp <= payrollRun.fundingDeadline, "CipherRoll: funding window closed");
        require(cleartextAmount > 0, "CipherRoll: treasury amount required");

        address adapter = _organizations[orgId].treasuryAdapter;
        require(adapter != address(0), "CipherRoll: treasury route missing");

        ITreasuryAdapter(adapter).reservePayrollFunding(orgId, payrollRunId, cleartextAmount);

        euint128 amount = FHE.asEuint128(cleartextAmount);
        FHE.allowThis(amount);

        euint128 availableBudget = _encryptedAvailable[orgId];
        ebool hasCapacity = FHE.gte(availableBudget, amount);
        euint128 zeroAmount = FHE.asEuint128(0);
        FHE.allowThis(zeroAmount);

        euint128 fundedAmount = FHE.select(hasCapacity, amount, zeroAmount);
        FHE.allowThis(fundedAmount);
        FHE.allow(fundedAmount, msg.sender);

        euint128 newCommitted = FHE.add(_encryptedCommitted[orgId], fundedAmount);
        FHE.allowThis(newCommitted);
        FHE.allow(newCommitted, msg.sender);

        euint128 newAvailable = FHE.sub(availableBudget, fundedAmount);
        FHE.allowThis(newAvailable);
        FHE.allow(newAvailable, msg.sender);

        _encryptedCommitted[orgId] = newCommitted;
        _encryptedAvailable[orgId] = newAvailable;
        payrollRun.status = PayrollRunStatus.Funded;
        payrollRun.fundedAt = uint64(block.timestamp);
        _organizations[orgId].updatedAt = uint64(block.timestamp);

        emit PayrollRunFunded(orgId, payrollRunId, msg.sender);
        emit PayrollRunTreasuryFunded(
            orgId,
            payrollRunId,
            msg.sender,
            ITreasuryAdapter(adapter).settlementAsset(),
            cleartextAmount
        );
    }

    function activatePayrollRun(
        bytes32 orgId,
        bytes32 payrollRunId
    ) external onlyOrgAdmin(orgId) onlyExistingPayrollRun(payrollRunId) {
        PayrollRun storage payrollRun = _payrollRuns[payrollRunId];
        require(payrollRun.orgId == orgId, "CipherRoll: payroll run org mismatch");
        require(payrollRun.status == PayrollRunStatus.Funded, "CipherRoll: payroll run not funded");
        require(payrollRun.allocationCount > 0, "CipherRoll: payroll run has no allocations");
        require(block.timestamp <= payrollRun.fundingDeadline, "CipherRoll: funding window closed");

        payrollRun.status = PayrollRunStatus.Active;
        payrollRun.activatedAt = uint64(block.timestamp);
        _organizations[orgId].updatedAt = uint64(block.timestamp);

        emit PayrollRunActivated(orgId, payrollRunId, msg.sender);
    }

    function depositBudget(
        bytes32 orgId,
        InEuint128 calldata encryptedAmount
    ) external onlyOrgAdmin(orgId) {
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);

        euint128 newBudget = FHE.add(_encryptedBudget[orgId], amount);
        FHE.allowThis(newBudget);
        FHE.allow(newBudget, msg.sender);

        euint128 newAvailable = FHE.add(
            _encryptedAvailable[orgId],
            amount
        );
        FHE.allowThis(newAvailable);
        FHE.allow(newAvailable, msg.sender);

        _encryptedBudget[orgId] = newBudget;
        _encryptedAvailable[orgId] = newAvailable;
        _organizations[orgId].updatedAt = uint64(block.timestamp);

        emit BudgetDeposited(orgId, msg.sender, 0); // Event obscured for privacy
    }

    function issueConfidentialPayroll(
        bytes32 orgId,
        address employee,
        InEuint128 calldata encryptedAmount,
        bytes32 paymentId,
        bytes32 memoHash
    ) external onlyOrgAdmin(orgId) {
        require(employee != address(0), "CipherRoll: employee required");
        require(!_allocations[paymentId].exists, "CipherRoll: payment exists");

        euint128 requestedAmount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(requestedAmount);

        euint128 availableBudget = _encryptedAvailable[orgId];
        ebool hasCapacity = FHE.gte(availableBudget, requestedAmount);

        euint128 zeroAmount = FHE.asEuint128(0);
        FHE.allowThis(zeroAmount);

        euint128 grantedAmount = FHE.select(
            hasCapacity,
            requestedAmount,
            zeroAmount
        );
        FHE.allowThis(grantedAmount);
        FHE.allow(grantedAmount, employee);

        euint128 newCommitted = FHE.add(
            _encryptedCommitted[orgId],
            grantedAmount
        );
        FHE.allowThis(newCommitted);
        FHE.allow(newCommitted, msg.sender);

        euint128 newAvailable = FHE.sub(
            availableBudget,
            grantedAmount
        );
        FHE.allowThis(newAvailable);
        FHE.allow(newAvailable, msg.sender);

        _encryptedCommitted[orgId] = newCommitted;
        _encryptedAvailable[orgId] = newAvailable;

        _allocations[paymentId] = PayrollAllocationMeta({
            employee: employee,
            paymentId: paymentId,
            memoHash: memoHash,
            createdAt: uint64(block.timestamp),
            isVesting: false,
            vestingStart: 0,
            vestingEnd: 0,
            exists: true
        });
        _allocationAmounts[paymentId] = grantedAmount;
        _employeePaymentIds[orgId][employee].push(paymentId);
        _recordIssuedPayroll(orgId, employee, false);
        _organizations[orgId].updatedAt = uint64(block.timestamp);

        emit ConfidentialPayrollIssued(orgId, paymentId, employee, memoHash);
    }

    function issueConfidentialPayrollToRun(
        bytes32 orgId,
        bytes32 payrollRunId,
        address employee,
        InEuint128 calldata encryptedAmount,
        bytes32 paymentId,
        bytes32 memoHash
    ) external onlyOrgAdmin(orgId) onlyExistingPayrollRun(payrollRunId) {
        _requireAllocatablePayrollRun(orgId, payrollRunId);
        require(employee != address(0), "CipherRoll: employee required");
        require(!_allocations[paymentId].exists, "CipherRoll: payment exists");

        euint128 grantedAmount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(grantedAmount);
        FHE.allow(grantedAmount, employee);

        _storeAllocation(orgId, payrollRunId, employee, paymentId, memoHash, grantedAmount, false, 0, 0);
        emit ConfidentialPayrollIssued(orgId, paymentId, employee, memoHash);
    }

    function issueVestingAllocation(
        bytes32 orgId,
        address employee,
        InEuint128 calldata encryptedAmount,
        bytes32 paymentId,
        bytes32 memoHash,
        uint64 startTimestamp,
        uint64 endTimestamp
    ) external onlyOrgAdmin(orgId) {
        require(employee != address(0), "CipherRoll: employee required");
        require(!_allocations[paymentId].exists, "CipherRoll: payment exists");
        require(endTimestamp > startTimestamp, "CipherRoll: invalid vesting");

        euint128 requestedAmount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(requestedAmount);

        euint128 availableBudget = _encryptedAvailable[orgId];
        ebool hasCapacity = FHE.gte(availableBudget, requestedAmount);

        euint128 zeroAmount = FHE.asEuint128(0);
        FHE.allowThis(zeroAmount);

        euint128 grantedAmount = FHE.select(
            hasCapacity,
            requestedAmount,
            zeroAmount
        );
        FHE.allowThis(grantedAmount);
        FHE.allow(grantedAmount, employee);

        euint128 newCommitted = FHE.add(_encryptedCommitted[orgId], grantedAmount);
        FHE.allowThis(newCommitted);
        FHE.allow(newCommitted, msg.sender);

        euint128 newAvailable = FHE.sub(availableBudget, grantedAmount);
        FHE.allowThis(newAvailable);
        FHE.allow(newAvailable, msg.sender);

        _encryptedCommitted[orgId] = newCommitted;
        _encryptedAvailable[orgId] = newAvailable;

        _allocations[paymentId] = PayrollAllocationMeta({
            employee: employee,
            paymentId: paymentId,
            memoHash: memoHash,
            createdAt: uint64(block.timestamp),
            isVesting: true,
            vestingStart: startTimestamp,
            vestingEnd: endTimestamp,
            exists: true
        });
        _allocationAmounts[paymentId] = grantedAmount;
        _employeePaymentIds[orgId][employee].push(paymentId);
        _recordIssuedPayroll(orgId, employee, true);
        _organizations[orgId].updatedAt = uint64(block.timestamp);

        emit ConfidentialPayrollIssued(orgId, paymentId, employee, memoHash);
    }

    function issueVestingAllocationToRun(
        bytes32 orgId,
        bytes32 payrollRunId,
        address employee,
        InEuint128 calldata encryptedAmount,
        bytes32 paymentId,
        bytes32 memoHash,
        uint64 startTimestamp,
        uint64 endTimestamp
    ) external onlyOrgAdmin(orgId) onlyExistingPayrollRun(payrollRunId) {
        _requireAllocatablePayrollRun(orgId, payrollRunId);
        require(employee != address(0), "CipherRoll: employee required");
        require(!_allocations[paymentId].exists, "CipherRoll: payment exists");
        require(endTimestamp > startTimestamp, "CipherRoll: invalid vesting");

        euint128 grantedAmount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(grantedAmount);
        FHE.allow(grantedAmount, employee);

        _storeAllocation(
            orgId,
            payrollRunId,
            employee,
            paymentId,
            memoHash,
            grantedAmount,
            true,
            startTimestamp,
            endTimestamp
        );
        emit ConfidentialPayrollIssued(orgId, paymentId, employee, memoHash);
    }

    function claimPayroll(bytes32 orgId, bytes32 paymentId) external {
        address adapter = _organizations[orgId].treasuryAdapter;
        require(adapter == address(0), "CipherRoll: settlement proof required");

        _requireClaimablePayment(paymentId);
        _finalizeClaim(orgId, paymentId, bytes32(0));
    }

    function claimPayrollWithSettlement(
        bytes32 orgId,
        bytes32 paymentId,
        uint128 cleartextAmount,
        bytes calldata signature
    ) external {
        _requireClaimablePayment(paymentId);

        address adapter = _organizations[orgId].treasuryAdapter;
        require(adapter != address(0), "CipherRoll: settlement unavailable");
        require(
            !ITreasuryAdapter(adapter).supportsConfidentialSettlement(),
            "CipherRoll: wrapper settlement requires request/finalize"
        );

        address asset = ITreasuryAdapter(adapter).settlementAsset();
        require(asset != address(0), "CipherRoll: settlement asset missing");
        require(
            FHE.verifyDecryptResult(_allocationAmounts[paymentId], cleartextAmount, signature),
            "CipherRoll: invalid settlement proof"
        );

        bytes32 payrollRunId = _paymentPayrollRun[paymentId];

        _finalizeClaim(orgId, paymentId, payrollRunId);
        ITreasuryAdapter(adapter).settlePayroll(orgId, payrollRunId, paymentId, msg.sender, cleartextAmount);

        emit PayrollSettled(orgId, paymentId, msg.sender, asset, cleartextAmount);
    }

    function requestPayrollSettlement(
        bytes32 orgId,
        bytes32 paymentId,
        uint128 cleartextAmount,
        bytes calldata signature
    ) external {
        _requireClaimablePayment(paymentId);

        address adapter = _organizations[orgId].treasuryAdapter;
        require(adapter != address(0), "CipherRoll: settlement unavailable");
        require(
            ITreasuryAdapter(adapter).supportsConfidentialSettlement(),
            "CipherRoll: wrapper settlement unsupported"
        );
        require(!_settlementRequests[paymentId].exists, "CipherRoll: settlement already pending");
        require(
            FHE.verifyDecryptResult(_allocationAmounts[paymentId], cleartextAmount, signature),
            "CipherRoll: invalid settlement proof"
        );

        bytes32 payrollRunId = _paymentPayrollRun[paymentId];
        (bytes32 requestId, address payoutAsset, address confidentialAsset) = ITreasuryAdapter(adapter)
            .requestPayrollSettlement(orgId, payrollRunId, paymentId, msg.sender, cleartextAmount);

        _settlementRequests[paymentId] = PayrollSettlementRequest({
            requestId: requestId,
            payoutAsset: payoutAsset,
            confidentialAsset: confidentialAsset,
            requestedAt: uint64(block.timestamp),
            exists: true
        });

        emit PayrollSettlementRequested(
            orgId,
            paymentId,
            msg.sender,
            payoutAsset,
            confidentialAsset,
            requestId
        );
    }

    function finalizePayrollSettlement(
        bytes32 orgId,
        bytes32 paymentId,
        uint64 decryptedAmount,
        bytes calldata decryptionProof
    ) external {
        require(_allocations[paymentId].exists, "CipherRoll: payment missing");
        require(_allocations[paymentId].employee == msg.sender, "CipherRoll: not employee");
        require(!_allocationClaimed[paymentId], "CipherRoll: already claimed");

        PayrollSettlementRequest memory request = _settlementRequests[paymentId];
        require(request.exists, "CipherRoll: settlement request missing");

        address adapter = _organizations[orgId].treasuryAdapter;
        require(adapter != address(0), "CipherRoll: settlement unavailable");
        require(
            ITreasuryAdapter(adapter).supportsConfidentialSettlement(),
            "CipherRoll: wrapper settlement unsupported"
        );

        bytes32 payrollRunId = _paymentPayrollRun[paymentId];
        (address payoutAsset, uint256 payoutAmount) = ITreasuryAdapter(adapter).finalizePayrollSettlement(
            orgId,
            payrollRunId,
            paymentId,
            msg.sender,
            request.requestId,
            decryptedAmount,
            decryptionProof
        );

        delete _settlementRequests[paymentId];
        _finalizeClaim(orgId, paymentId, payrollRunId);

        emit PayrollSettled(orgId, paymentId, msg.sender, payoutAsset, payoutAmount);
    }

    function _requireClaimablePayment(bytes32 paymentId) internal view {
        require(_allocations[paymentId].exists, "CipherRoll: payment missing");
        require(_allocations[paymentId].employee == msg.sender, "CipherRoll: not employee");
        require(!_allocationClaimed[paymentId], "CipherRoll: already claimed");

        bytes32 payrollRunId = _paymentPayrollRun[paymentId];
        if (payrollRunId != bytes32(0)) {
            PayrollRun storage payrollRun = _payrollRuns[payrollRunId];
            require(payrollRun.status == PayrollRunStatus.Active, "CipherRoll: payroll run not active");
        }

        if (_allocations[paymentId].isVesting) {
            require(block.timestamp >= _allocations[paymentId].vestingEnd, "CipherRoll: vesting active");
        }
    }

    function _finalizeClaim(bytes32 orgId, bytes32 paymentId, bytes32 payrollRunIdHint) internal {
        _allocationClaimed[paymentId] = true;
        _organizationInsights[orgId].claimedPayrollItems += 1;
        _organizationInsights[orgId].activePayrollItems -= 1;
        _organizationInsights[orgId].lastClaimedAt = uint64(block.timestamp);

        bytes32 payrollRunId = payrollRunIdHint;
        if (payrollRunId == bytes32(0)) {
            payrollRunId = _paymentPayrollRun[paymentId];
        }

        if (payrollRunId != bytes32(0)) {
            PayrollRun storage payrollRun = _payrollRuns[payrollRunId];
            payrollRun.claimedCount += 1;

            if (payrollRun.claimedCount == payrollRun.allocationCount) {
                payrollRun.status = PayrollRunStatus.Finalized;
                payrollRun.finalizedAt = uint64(block.timestamp);
                emit PayrollRunFinalized(orgId, payrollRunId);
            }
        }

        emit PayrollClaimed(orgId, paymentId, msg.sender);
    }

    // ── View functions ──────────────────────────────────────────────────

    function getOrganization(
        bytes32 orgId
    ) external view returns (Organization memory) {
        return _organizations[orgId];
    }

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
        )
    {
        Organization memory org = _organizations[orgId];
        adapter = org.treasuryAdapter;
        routeId = org.treasuryRouteId;

        if (adapter == address(0)) {
            return (adapter, routeId, bytes32(0), "", false, address(0), address(0), 0, 0);
        }

        adapterId = ITreasuryAdapter(adapter).adapterId();
        adapterName = ITreasuryAdapter(adapter).adapterName();
        supportsConfidentialSettlement = ITreasuryAdapter(adapter)
            .supportsConfidentialSettlement();
        settlementAsset = ITreasuryAdapter(adapter).settlementAsset();
        confidentialSettlementAsset = ITreasuryAdapter(adapter).confidentialSettlementAsset();
        availablePayrollFunds = ITreasuryAdapter(adapter).availablePayrollFunds(orgId);
        reservedPayrollFunds = ITreasuryAdapter(adapter).reservedPayrollFunds(orgId);
    }

    /// @notice Returns encrypted budget handles for the admin.
    ///         The caller must use the CoFHE SDK client-side decryptForView() flow.
    function getAdminBudgetHandles(
        bytes32 orgId
    )
        external
        view
        returns (euint128 budget, euint128 committed, euint128 available)
    {
        require(_organizations[orgId].admin == msg.sender, "CipherRoll: not admin");

        return (
            _encryptedBudget[orgId],
            _encryptedCommitted[orgId],
            _encryptedAvailable[orgId]
        );
    }

    /// @notice Returns encrypted organization-level budget handles for auditor review.
    ///         These handles are intentionally aggregate-only and are meant to be
    ///         decrypted through a shared permit from the workspace admin.
    function getAuditorEncryptedSummaryHandles(
        bytes32 orgId
    )
        external
        view
        returns (euint128 budget, euint128 committed, euint128 available)
    {
        require(_organizations[orgId].exists, "CipherRoll: unknown org");

        return (
            _encryptedBudget[orgId],
            _encryptedCommitted[orgId],
            _encryptedAvailable[orgId]
        );
    }

    /// @notice Returns encrypted allocation handles for an employee.
    ///         The caller must use the CoFHE SDK client-side decryptForView() flow.
    function getEmployeeAllocations(
        bytes32 orgId,
        address employee
    )
        external
        view
        returns (
            bytes32[] memory paymentIds,
            bytes32[] memory memoHashes,
            uint64[] memory createdAts,
            euint128[] memory amounts
        )
    {
        require(msg.sender == employee, "CipherRoll: employee only");

        bytes32[] memory ids = _employeePaymentIds[orgId][employee];
        bytes32[] memory memos = new bytes32[](ids.length);
        uint64[] memory timestamps = new uint64[](ids.length);
        euint128[] memory amountHandles = new euint128[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            PayrollAllocationMeta memory meta = _allocations[ids[i]];
            memos[i] = meta.memoHash;
            timestamps[i] = meta.createdAt;
            amountHandles[i] = _allocationAmounts[ids[i]];
        }

        return (ids, memos, timestamps, amountHandles);
    }

    function getPayrollAllocationMeta(
        bytes32 paymentId
    ) external view returns (PayrollAllocationMeta memory) {
        return _allocations[paymentId];
    }

    function getPayrollRun(
        bytes32 payrollRunId
    ) external view onlyExistingPayrollRun(payrollRunId) returns (PayrollRun memory) {
        return _payrollRuns[payrollRunId];
    }

    function getOrganizationPayrollRunIds(
        bytes32 orgId
    ) external view returns (bytes32[] memory) {
        return _organizationPayrollRunIds[orgId];
    }

    function getPayrollRunForPayment(
        bytes32 paymentId
    ) external view returns (bytes32) {
        return _paymentPayrollRun[paymentId];
    }

    function isPayrollClaimed(bytes32 paymentId) external view returns (bool) {
        return _allocationClaimed[paymentId];
    }

    function getPayrollSettlementRequest(
        bytes32 paymentId
    ) external view returns (PayrollSettlementRequest memory) {
        return _settlementRequests[paymentId];
    }

    function getOrganizationInsights(
        bytes32 orgId
    ) external view onlyOrgAdmin(orgId) returns (OrganizationInsights memory) {
        return _organizationInsights[orgId];
    }
    
    function getAuditorOrganizationInsights(
        bytes32 orgId
    ) external view returns (OrganizationInsights memory) {
        require(_organizations[orgId].exists, "CipherRoll: unknown org");
        return _organizationInsights[orgId];
    }

    function _recordIssuedPayroll(
        bytes32 orgId,
        address employee,
        bool isVesting
    ) internal {
        OrganizationInsights storage insights = _organizationInsights[orgId];
        insights.totalPayrollItems += 1;
        insights.activePayrollItems += 1;
        insights.lastIssuedAt = uint64(block.timestamp);

        if (isVesting) {
            insights.vestingPayrollItems += 1;
        }

        if (!_organizationEmployeeSeen[orgId][employee]) {
            _organizationEmployeeSeen[orgId][employee] = true;
            insights.employeeRecipients += 1;
        }
    }

    function _requireAllocatablePayrollRun(
        bytes32 orgId,
        bytes32 payrollRunId
    ) internal view {
        PayrollRun memory payrollRun = _payrollRuns[payrollRunId];
        require(payrollRun.orgId == orgId, "CipherRoll: payroll run org mismatch");
        require(payrollRun.status != PayrollRunStatus.Active, "CipherRoll: payroll run already active");
        require(payrollRun.status != PayrollRunStatus.Finalized, "CipherRoll: payroll run finalized");
        require(payrollRun.allocationCount < payrollRun.plannedHeadcount, "CipherRoll: payroll run full");
    }

    function _storeAllocation(
        bytes32 orgId,
        bytes32 payrollRunId,
        address employee,
        bytes32 paymentId,
        bytes32 memoHash,
        euint128 amount,
        bool isVesting,
        uint64 vestingStart,
        uint64 vestingEnd
    ) internal {
        _allocations[paymentId] = PayrollAllocationMeta({
            employee: employee,
            paymentId: paymentId,
            memoHash: memoHash,
            createdAt: uint64(block.timestamp),
            isVesting: isVesting,
            vestingStart: vestingStart,
            vestingEnd: vestingEnd,
            exists: true
        });
        _allocationAmounts[paymentId] = amount;
        _employeePaymentIds[orgId][employee].push(paymentId);
        _paymentPayrollRun[paymentId] = payrollRunId;
        _payrollRuns[payrollRunId].allocationCount += 1;
        _recordIssuedPayroll(orgId, employee, isVesting);
        _organizations[orgId].updatedAt = uint64(block.timestamp);
    }

}
