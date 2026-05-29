// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {InEuint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {ICipherRollGovernanceExecutor} from "./interfaces/ICipherRollGovernanceExecutor.sol";

interface ICipherRollPayrollGovernanceTarget {
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

    function getOrganization(bytes32 orgId) external view returns (Organization memory);
    function configureTreasury(bytes32 orgId, address treasuryAdapter, bytes32 treasuryRouteId) external;
    function createPayrollRun(
        bytes32 orgId,
        bytes32 payrollRunId,
        bytes32 settlementAssetId,
        uint64 fundingDeadline,
        uint32 plannedHeadcount
    ) external;
    function fundPayrollRun(bytes32 orgId, bytes32 payrollRunId, InEuint128 calldata encryptedAmount) external;
    function fundPayrollRunFromTreasury(bytes32 orgId, bytes32 payrollRunId, uint128 cleartextAmount) external;
    function activatePayrollRun(bytes32 orgId, bytes32 payrollRunId) external;
    function issueConfidentialPayroll(
        bytes32 orgId,
        address employee,
        InEuint128 calldata encryptedAmount,
        bytes32 paymentId,
        bytes32 memoHash
    ) external;
    function issueConfidentialPayrollToRun(
        bytes32 orgId,
        bytes32 payrollRunId,
        address employee,
        InEuint128 calldata encryptedAmount,
        bytes32 paymentId,
        bytes32 memoHash
    ) external;
    function issueVestingAllocation(
        bytes32 orgId,
        address employee,
        InEuint128 calldata encryptedAmount,
        bytes32 paymentId,
        bytes32 memoHash,
        uint64 startTimestamp,
        uint64 endTimestamp
    ) external;
    function issueVestingAllocationToRun(
        bytes32 orgId,
        bytes32 payrollRunId,
        address employee,
        InEuint128 calldata encryptedAmount,
        bytes32 paymentId,
        bytes32 memoHash,
        uint64 startTimestamp,
        uint64 endTimestamp
    ) external;
}

contract CipherRollGovernance is ICipherRollGovernanceExecutor {
    enum GovernanceActionType {
        ConfigureTreasury,
        CreatePayrollRun,
        FundPayrollRun,
        FundPayrollRunFromTreasury,
        ActivatePayrollRun,
        IssueConfidentialPayroll,
        IssueConfidentialPayrollToRun,
        IssueVestingAllocation,
        IssueVestingAllocationToRun,
        AddAdmin,
        RemoveAdmin,
        UpdateQuorum
    }

    struct OrganizationGovernance {
        address primaryAdmin;
        uint64 maxAdmins;
        uint64 quorum;
        uint64 adminCount;
        uint64 nonce;
        bool initialized;
    }

    struct GovernanceProposal {
        bytes32 orgId;
        GovernanceActionType actionType;
        bytes payload;
        address proposer;
        uint64 createdAt;
        uint64 expiresAt;
        uint64 approvalCount;
        bool executed;
        bool cancelled;
        bool exists;
    }

    ICipherRollPayrollGovernanceTarget public immutable payroll;

    mapping(bytes32 => OrganizationGovernance) private _organizationGovernance;
    mapping(bytes32 => mapping(address => bool)) private _organizationAdmins;
    mapping(bytes32 => address[]) private _organizationAdminList;
    mapping(bytes32 => GovernanceProposal) private _governanceProposals;
    mapping(bytes32 => mapping(address => bool)) private _governanceProposalApprovals;
    mapping(bytes32 => bytes32[]) private _organizationGovernanceProposalIds;
    mapping(bytes32 => bytes32) private _walletExecutionProposalIds;

    event OrganizationGovernanceInitialized(
        bytes32 indexed orgId,
        address indexed primaryAdmin,
        uint64 maxAdmins,
        uint64 quorum
    );

    event OrganizationAdminBootstrapped(
        bytes32 indexed orgId,
        address indexed admin,
        address indexed addedBy,
        uint64 adminCount
    );

    event OrganizationAdminAdded(
        bytes32 indexed orgId,
        address indexed admin,
        address indexed executedBy,
        uint64 adminCount
    );

    event OrganizationAdminRemoved(
        bytes32 indexed orgId,
        address indexed admin,
        address indexed executedBy,
        uint64 adminCount
    );

    event OrganizationQuorumUpdated(
        bytes32 indexed orgId,
        uint64 previousQuorum,
        uint64 nextQuorum,
        address indexed executedBy
    );

    event GovernanceProposalCreated(
        bytes32 indexed orgId,
        bytes32 indexed proposalId,
        GovernanceActionType actionType,
        address proposer,
        bytes32 payloadHash,
        uint64 expiresAt
    );

    event GovernanceProposalApproved(
        bytes32 indexed orgId,
        bytes32 indexed proposalId,
        address indexed admin,
        uint64 approvalCount
    );

    event GovernanceProposalRevoked(
        bytes32 indexed orgId,
        bytes32 indexed proposalId,
        address indexed admin,
        uint64 approvalCount
    );

    event GovernanceProposalCancelled(
        bytes32 indexed orgId,
        bytes32 indexed proposalId,
        address indexed admin
    );

    event GovernanceProposalExecuted(
        bytes32 indexed orgId,
        bytes32 indexed proposalId,
        GovernanceActionType actionType,
        address indexed executor
    );

    modifier onlyOrganizationAdmin(bytes32 orgId) {
        require(_organizationGovernance[orgId].initialized, "CipherRollGovernance: org not initialized");
        require(_organizationAdmins[orgId][msg.sender], "CipherRollGovernance: not admin");
        _;
    }

    modifier onlyPayroll() {
        require(msg.sender == address(payroll), "CipherRollGovernance: payroll only");
        _;
    }

    constructor(address payrollAddress) {
        require(payrollAddress != address(0), "CipherRollGovernance: payroll required");
        payroll = ICipherRollPayrollGovernanceTarget(payrollAddress);
    }

    function bootstrapOrganization(bytes32 orgId) external {
        require(!_organizationGovernance[orgId].initialized, "CipherRollGovernance: already initialized");

        ICipherRollPayrollGovernanceTarget.Organization memory org = payroll.getOrganization(orgId);
        require(org.exists, "CipherRollGovernance: org missing");
        require(msg.sender == org.admin, "CipherRollGovernance: primary admin only");

        _organizationGovernance[orgId] = OrganizationGovernance({
            primaryAdmin: org.admin,
            maxAdmins: org.reservedAdminSlots,
            quorum: org.reservedQuorum,
            adminCount: 1,
            nonce: 0,
            initialized: true
        });

        _organizationAdmins[orgId][org.admin] = true;
        _organizationAdminList[orgId].push(org.admin);

        emit OrganizationGovernanceInitialized(
            orgId,
            org.admin,
            org.reservedAdminSlots,
            org.reservedQuorum
        );
    }

    function bootstrapOrganizationAdmin(
        bytes32 orgId,
        address adminToAdd
    ) external onlyOrganizationAdmin(orgId) {
        OrganizationGovernance memory org = _organizationGovernance[orgId];
        require(msg.sender == org.primaryAdmin, "CipherRollGovernance: primary admin only");
        require(!isGovernanceActive(orgId), "CipherRollGovernance: governance active");
        require(
            org.adminCount < org.quorum,
            "CipherRollGovernance: quorum already bootstrapped"
        );

        _addOrganizationAdmin(orgId, adminToAdd);

        emit OrganizationAdminBootstrapped(
            orgId,
            adminToAdd,
            msg.sender,
            _organizationGovernance[orgId].adminCount
        );
    }

    function proposeGovernanceAction(
        bytes32 orgId,
        GovernanceActionType actionType,
        bytes calldata payload,
        uint64 expiresAt
    ) external onlyOrganizationAdmin(orgId) returns (bytes32 proposalId) {
        require(isGovernanceActive(orgId), "CipherRollGovernance: governance inactive");
        require(payload.length > 0, "CipherRollGovernance: payload required");
        require(expiresAt > uint64(block.timestamp), "CipherRollGovernance: invalid expiration");

        proposalId = keccak256(
            abi.encode(
                orgId,
                actionType,
                keccak256(payload),
                msg.sender,
                _organizationGovernance[orgId].nonce
            )
        );
        _organizationGovernance[orgId].nonce += 1;

        GovernanceProposal storage proposal = _governanceProposals[proposalId];
        proposal.orgId = orgId;
        proposal.actionType = actionType;
        proposal.payload = payload;
        proposal.proposer = msg.sender;
        proposal.createdAt = uint64(block.timestamp);
        proposal.expiresAt = expiresAt;
        proposal.approvalCount = 1;
        proposal.executed = false;
        proposal.cancelled = false;
        proposal.exists = true;

        _governanceProposalApprovals[proposalId][msg.sender] = true;
        _organizationGovernanceProposalIds[orgId].push(proposalId);

        if (_requiresWalletExecutor(actionType)) {
            bytes32 executionKey = _walletExecutionKey(
                orgId,
                msg.sender,
                actionType,
                keccak256(payload)
            );
            _walletExecutionProposalIds[executionKey] = proposalId;
        }

        emit GovernanceProposalCreated(
            orgId,
            proposalId,
            actionType,
            msg.sender,
            keccak256(payload),
            expiresAt
        );
        emit GovernanceProposalApproved(orgId, proposalId, msg.sender, 1);
    }

    function approveGovernanceProposal(bytes32 proposalId) external {
        GovernanceProposal storage proposal = _governanceProposals[proposalId];
        require(proposal.exists, "CipherRollGovernance: proposal missing");
        require(_organizationAdmins[proposal.orgId][msg.sender], "CipherRollGovernance: not admin");
        require(!proposal.executed, "CipherRollGovernance: proposal executed");
        require(!proposal.cancelled, "CipherRollGovernance: proposal cancelled");
        require(proposal.expiresAt >= uint64(block.timestamp), "CipherRollGovernance: proposal expired");
        require(!_governanceProposalApprovals[proposalId][msg.sender], "CipherRollGovernance: already approved");

        _governanceProposalApprovals[proposalId][msg.sender] = true;
        proposal.approvalCount += 1;

        emit GovernanceProposalApproved(
            proposal.orgId,
            proposalId,
            msg.sender,
            proposal.approvalCount
        );
    }

    function revokeGovernanceApproval(bytes32 proposalId) external {
        GovernanceProposal storage proposal = _governanceProposals[proposalId];
        require(proposal.exists, "CipherRollGovernance: proposal missing");
        require(_organizationAdmins[proposal.orgId][msg.sender], "CipherRollGovernance: not admin");
        require(!proposal.executed, "CipherRollGovernance: proposal executed");
        require(!proposal.cancelled, "CipherRollGovernance: proposal cancelled");
        require(_governanceProposalApprovals[proposalId][msg.sender], "CipherRollGovernance: approval missing");
        require(proposal.approvalCount > 0, "CipherRollGovernance: no approvals");

        _governanceProposalApprovals[proposalId][msg.sender] = false;
        proposal.approvalCount -= 1;

        emit GovernanceProposalRevoked(
            proposal.orgId,
            proposalId,
            msg.sender,
            proposal.approvalCount
        );
    }

    function cancelGovernanceProposal(bytes32 proposalId) external {
        GovernanceProposal storage proposal = _governanceProposals[proposalId];
        require(proposal.exists, "CipherRollGovernance: proposal missing");
        require(!proposal.executed, "CipherRollGovernance: proposal executed");
        require(!proposal.cancelled, "CipherRollGovernance: proposal cancelled");
        require(
            msg.sender == proposal.proposer ||
                msg.sender == _organizationGovernance[proposal.orgId].primaryAdmin,
            "CipherRollGovernance: cannot cancel"
        );

        proposal.cancelled = true;
        emit GovernanceProposalCancelled(proposal.orgId, proposalId, msg.sender);
    }

    function executeGovernanceProposal(bytes32 proposalId) external onlyOrganizationAdmin(_governanceProposals[proposalId].orgId) {
        GovernanceProposal storage proposal = _governanceProposals[proposalId];
        require(proposal.exists, "CipherRollGovernance: proposal missing");
        require(!proposal.executed, "CipherRollGovernance: proposal executed");
        require(!proposal.cancelled, "CipherRollGovernance: proposal cancelled");
        require(proposal.expiresAt >= uint64(block.timestamp), "CipherRollGovernance: proposal expired");
        require(
            proposal.approvalCount >= _organizationGovernance[proposal.orgId].quorum,
            "CipherRollGovernance: quorum not met"
        );

        require(
            !_requiresWalletExecutor(proposal.actionType),
            "CipherRollGovernance: execute from approved admin wallet"
        );

        proposal.executed = true;

        if (proposal.actionType == GovernanceActionType.ConfigureTreasury) {
            (address treasuryAdapter, bytes32 treasuryRouteId) = abi.decode(
                proposal.payload,
                (address, bytes32)
            );
            payroll.configureTreasury(proposal.orgId, treasuryAdapter, treasuryRouteId);
        } else if (proposal.actionType == GovernanceActionType.CreatePayrollRun) {
            (
                bytes32 payrollRunId,
                bytes32 settlementAssetId,
                uint64 fundingDeadline,
                uint32 plannedHeadcount
            ) = abi.decode(proposal.payload, (bytes32, bytes32, uint64, uint32));
            payroll.createPayrollRun(
                proposal.orgId,
                payrollRunId,
                settlementAssetId,
                fundingDeadline,
                plannedHeadcount
            );
        } else if (proposal.actionType == GovernanceActionType.FundPayrollRun) {
            (bytes32 payrollRunId, InEuint128 memory encryptedAmount) = abi.decode(
                proposal.payload,
                (bytes32, InEuint128)
            );
            payroll.fundPayrollRun(proposal.orgId, payrollRunId, encryptedAmount);
        } else if (proposal.actionType == GovernanceActionType.FundPayrollRunFromTreasury) {
            (bytes32 payrollRunId, uint128 cleartextAmount) = abi.decode(
                proposal.payload,
                (bytes32, uint128)
            );
            payroll.fundPayrollRunFromTreasury(proposal.orgId, payrollRunId, cleartextAmount);
        } else if (proposal.actionType == GovernanceActionType.ActivatePayrollRun) {
            (bytes32 payrollRunId) = abi.decode(proposal.payload, (bytes32));
            payroll.activatePayrollRun(proposal.orgId, payrollRunId);
        } else if (proposal.actionType == GovernanceActionType.IssueConfidentialPayroll) {
            (
                address employee,
                InEuint128 memory encryptedAmount,
                bytes32 paymentId,
                bytes32 memoHash
            ) = abi.decode(proposal.payload, (address, InEuint128, bytes32, bytes32));
            payroll.issueConfidentialPayroll(
                proposal.orgId,
                employee,
                encryptedAmount,
                paymentId,
                memoHash
            );
        } else if (proposal.actionType == GovernanceActionType.IssueConfidentialPayrollToRun) {
            (
                bytes32 payrollRunId,
                address employee,
                InEuint128 memory encryptedAmount,
                bytes32 paymentId,
                bytes32 memoHash
            ) = abi.decode(proposal.payload, (bytes32, address, InEuint128, bytes32, bytes32));
            payroll.issueConfidentialPayrollToRun(
                proposal.orgId,
                payrollRunId,
                employee,
                encryptedAmount,
                paymentId,
                memoHash
            );
        } else if (proposal.actionType == GovernanceActionType.IssueVestingAllocation) {
            (
                address employee,
                InEuint128 memory encryptedAmount,
                bytes32 paymentId,
                bytes32 memoHash,
                uint64 startTimestamp,
                uint64 endTimestamp
            ) = abi.decode(proposal.payload, (address, InEuint128, bytes32, bytes32, uint64, uint64));
            payroll.issueVestingAllocation(
                proposal.orgId,
                employee,
                encryptedAmount,
                paymentId,
                memoHash,
                startTimestamp,
                endTimestamp
            );
        } else if (proposal.actionType == GovernanceActionType.IssueVestingAllocationToRun) {
            (
                bytes32 payrollRunId,
                address employee,
                InEuint128 memory encryptedAmount,
                bytes32 paymentId,
                bytes32 memoHash,
                uint64 startTimestamp,
                uint64 endTimestamp
            ) = abi.decode(
                proposal.payload,
                (bytes32, address, InEuint128, bytes32, bytes32, uint64, uint64)
            );
            payroll.issueVestingAllocationToRun(
                proposal.orgId,
                payrollRunId,
                employee,
                encryptedAmount,
                paymentId,
                memoHash,
                startTimestamp,
                endTimestamp
            );
        } else if (proposal.actionType == GovernanceActionType.AddAdmin) {
            (address adminToAdd) = abi.decode(proposal.payload, (address));
            _addOrganizationAdmin(proposal.orgId, adminToAdd);
            emit OrganizationAdminAdded(
                proposal.orgId,
                adminToAdd,
                msg.sender,
                _organizationGovernance[proposal.orgId].adminCount
            );
        } else if (proposal.actionType == GovernanceActionType.RemoveAdmin) {
            (address adminToRemove) = abi.decode(proposal.payload, (address));
            _removeOrganizationAdmin(proposal.orgId, adminToRemove);
            emit OrganizationAdminRemoved(
                proposal.orgId,
                adminToRemove,
                msg.sender,
                _organizationGovernance[proposal.orgId].adminCount
            );
        } else if (proposal.actionType == GovernanceActionType.UpdateQuorum) {
            (uint64 nextQuorum) = abi.decode(proposal.payload, (uint64));
            uint64 previousQuorum = _organizationGovernance[proposal.orgId].quorum;
            _updateOrganizationQuorum(proposal.orgId, nextQuorum);
            emit OrganizationQuorumUpdated(proposal.orgId, previousQuorum, nextQuorum, msg.sender);
        } else {
            revert("CipherRollGovernance: unsupported governance action");
        }

        emit GovernanceProposalExecuted(
            proposal.orgId,
            proposalId,
            proposal.actionType,
            msg.sender
        );
    }

    function consumeApprovedProposalExecution(
        bytes32 executionKey,
        uint8 actionType,
        bytes32 payloadHash,
        address caller
    ) external onlyPayroll returns (bytes32 orgId) {
        bytes32 proposalId = _walletExecutionProposalIds[executionKey];
        GovernanceProposal storage proposal = _governanceProposals[proposalId];
        require(proposal.exists, "CipherRollGovernance: proposal missing");
        require(!proposal.executed, "CipherRollGovernance: proposal executed");
        require(!proposal.cancelled, "CipherRollGovernance: proposal cancelled");
        require(proposal.expiresAt >= uint64(block.timestamp), "CipherRollGovernance: proposal expired");
        require(
            proposal.approvalCount >= _organizationGovernance[proposal.orgId].quorum,
            "CipherRollGovernance: quorum not met"
        );
        require(_requiresWalletExecutor(proposal.actionType), "CipherRollGovernance: direct execute action");
        require(uint8(proposal.actionType) == actionType, "CipherRollGovernance: action mismatch");
        require(proposal.proposer == caller, "CipherRollGovernance: proposer must execute");
        require(keccak256(proposal.payload) == payloadHash, "CipherRollGovernance: payload mismatch");

        proposal.executed = true;
        orgId = proposal.orgId;

        emit GovernanceProposalExecuted(
            proposal.orgId,
            proposalId,
            proposal.actionType,
            caller
        );
    }

    function getOrganizationGovernance(
        bytes32 orgId
    ) external view returns (OrganizationGovernance memory) {
        return _organizationGovernance[orgId];
    }

    function getOrganizationAdmins(
        bytes32 orgId
    ) external view returns (address[] memory) {
        return _organizationAdminList[orgId];
    }

    function getOrganizationGovernanceProposalIds(
        bytes32 orgId
    ) external view returns (bytes32[] memory) {
        return _organizationGovernanceProposalIds[orgId];
    }

    function getGovernanceProposal(
        bytes32 proposalId
    ) external view returns (GovernanceProposal memory) {
        return _governanceProposals[proposalId];
    }

    function hasApprovedGovernanceProposal(
        bytes32 proposalId,
        address account
    ) external view returns (bool) {
        return _governanceProposalApprovals[proposalId][account];
    }

    function isOrganizationAdmin(
        bytes32 orgId,
        address account
    ) public view override returns (bool) {
        return _organizationAdmins[orgId][account];
    }

    function isGovernanceActive(
        bytes32 orgId
    ) public view override returns (bool) {
        OrganizationGovernance memory org = _organizationGovernance[orgId];
        return org.initialized && org.quorum > 1 && org.adminCount >= org.quorum;
    }

    function _requiresWalletExecutor(GovernanceActionType actionType) internal pure returns (bool) {
        return
            actionType == GovernanceActionType.FundPayrollRun ||
            actionType == GovernanceActionType.IssueConfidentialPayroll ||
            actionType == GovernanceActionType.IssueConfidentialPayrollToRun ||
            actionType == GovernanceActionType.IssueVestingAllocation ||
            actionType == GovernanceActionType.IssueVestingAllocationToRun;
    }

    function _walletExecutionKey(
        bytes32 orgId,
        address proposer,
        GovernanceActionType actionType,
        bytes32 payloadHash
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(orgId, proposer, actionType, payloadHash));
    }

    function _addOrganizationAdmin(bytes32 orgId, address adminToAdd) internal {
        require(adminToAdd != address(0), "CipherRollGovernance: admin required");
        require(!_organizationAdmins[orgId][adminToAdd], "CipherRollGovernance: admin exists");
        require(
            _organizationGovernance[orgId].adminCount < _organizationGovernance[orgId].maxAdmins,
            "CipherRollGovernance: admin slots full"
        );

        _organizationAdmins[orgId][adminToAdd] = true;
        _organizationAdminList[orgId].push(adminToAdd);
        _organizationGovernance[orgId].adminCount += 1;
    }

    function _removeOrganizationAdmin(bytes32 orgId, address adminToRemove) internal {
        require(_organizationAdmins[orgId][adminToRemove], "CipherRollGovernance: admin missing");
        require(
            adminToRemove != _organizationGovernance[orgId].primaryAdmin,
            "CipherRollGovernance: primary admin fixed"
        );
        require(_organizationGovernance[orgId].adminCount > 1, "CipherRollGovernance: last admin");
        require(
            _organizationGovernance[orgId].adminCount - 1 >= _organizationGovernance[orgId].quorum,
            "CipherRollGovernance: quorum would break"
        );

        _organizationAdmins[orgId][adminToRemove] = false;

        address[] storage admins = _organizationAdminList[orgId];
        for (uint256 i = 0; i < admins.length; i++) {
            if (admins[i] == adminToRemove) {
                admins[i] = admins[admins.length - 1];
                admins.pop();
                break;
            }
        }

        _organizationGovernance[orgId].adminCount -= 1;
    }

    function _updateOrganizationQuorum(bytes32 orgId, uint64 nextQuorum) internal {
        require(nextQuorum > 0, "CipherRollGovernance: quorum required");
        require(
            nextQuorum <= _organizationGovernance[orgId].maxAdmins,
            "CipherRollGovernance: invalid quorum"
        );
        require(
            nextQuorum <= _organizationGovernance[orgId].adminCount,
            "CipherRollGovernance: not enough admins"
        );

        _organizationGovernance[orgId].quorum = nextQuorum;
    }
}
