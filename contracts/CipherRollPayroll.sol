// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, InEuint128, euint128, ebool} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {ITreasuryAdapter} from "./interfaces/ITreasuryAdapter.sol";

/// @title CipherRollPayroll
/// @notice Confidential payroll management using the CoFHE coprocessor stack.
///         All salary amounts are FHE-encrypted on-chain; only authorized
///         callers can decrypt via the CoFHE SDK client-side decryptForView() flow.
contract CipherRollPayroll {
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

    mapping(bytes32 => Organization) private _organizations;
    mapping(bytes32 => euint128) private _encryptedBudget;
    mapping(bytes32 => euint128) private _encryptedCommitted;
    mapping(bytes32 => euint128) private _encryptedAvailable;
    mapping(bytes32 => PayrollAllocationMeta) private _allocations;
    mapping(bytes32 => euint128) private _allocationAmounts;
    mapping(bytes32 => bool) private _allocationClaimed;
    mapping(bytes32 => mapping(address => bytes32[])) private _employeePaymentIds;

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

    modifier onlyOrgAdmin(bytes32 orgId) {
        require(_organizations[orgId].exists, "CipherRoll: unknown org");
        require(_organizations[orgId].admin == msg.sender, "CipherRoll: not admin");
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
        _organizations[orgId].updatedAt = uint64(block.timestamp);

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
        _organizations[orgId].updatedAt = uint64(block.timestamp);

        emit ConfidentialPayrollIssued(orgId, paymentId, employee, memoHash);
    }

    function claimPayroll(bytes32 orgId, bytes32 paymentId) external {
        require(_allocations[paymentId].exists, "CipherRoll: payment missing");
        require(_allocations[paymentId].employee == msg.sender, "CipherRoll: not employee");
        require(!_allocationClaimed[paymentId], "CipherRoll: already claimed");

        if (_allocations[paymentId].isVesting) {
            require(block.timestamp >= _allocations[paymentId].vestingEnd, "CipherRoll: vesting active");
        }

        _allocationClaimed[paymentId] = true;

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
            bool supportsConfidentialSettlement
        )
    {
        Organization memory org = _organizations[orgId];
        adapter = org.treasuryAdapter;
        routeId = org.treasuryRouteId;

        if (adapter == address(0)) {
            return (adapter, routeId, bytes32(0), "", false);
        }

        adapterId = ITreasuryAdapter(adapter).adapterId();
        adapterName = ITreasuryAdapter(adapter).adapterName();
        supportsConfidentialSettlement = ITreasuryAdapter(adapter)
            .supportsConfidentialSettlement();
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
}
