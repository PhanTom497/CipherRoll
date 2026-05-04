"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_network_helpers_1 = require("@nomicfoundation/hardhat-network-helpers");
const sdk_1 = require("@cofhe/sdk");
const permits_1 = require("@cofhe/sdk/permits");
const chai_1 = require("chai");
const hardhat_1 = __importStar(require("hardhat"));
describe("CipherRollPayroll", function () {
    let payroll;
    let auditorDisclosure;
    let admin;
    let employee;
    let outsider;
    let settlementToken;
    let settlementAdapter;
    let confidentialSettlementToken;
    let confidentialSettlementAdapter;
    let adminClient;
    let employeeClient;
    let outsiderClient;
    async function encryptUint128(client, value) {
        const [encrypted] = await client
            .encryptInputs([sdk_1.Encryptable.uint128(value)])
            .execute();
        return encrypted;
    }
    async function decryptUint128(client, handle) {
        return client.decryptForView(handle, sdk_1.FheTypes.Uint128).execute();
    }
    async function decryptUint128WithExplicitPermit(client, handle) {
        const permit = await client.permits.getOrCreateSelfPermit();
        return client.decryptForView(handle, sdk_1.FheTypes.Uint128).withPermit(permit).execute();
    }
    async function expectDecryptFailure(work) {
        let failed = false;
        try {
            await work();
        }
        catch {
            failed = true;
        }
        (0, chai_1.expect)(failed).to.equal(true);
    }
    beforeEach(async function () {
        [admin, employee, outsider] = await hardhat_1.ethers.getSigners();
        adminClient = await hardhat_1.default.cofhe.createClientWithBatteries(admin);
        employeeClient = await hardhat_1.default.cofhe.createClientWithBatteries(employee);
        outsiderClient = await hardhat_1.default.cofhe.createClientWithBatteries(outsider);
        const payrollFactory = await hardhat_1.ethers.getContractFactory("CipherRollPayroll");
        payroll = await payrollFactory.deploy();
        await payroll.waitForDeployment();
        const auditorDisclosureFactory = await hardhat_1.ethers.getContractFactory("CipherRollAuditorDisclosure");
        auditorDisclosure = await auditorDisclosureFactory.deploy(await payroll.getAddress());
        await auditorDisclosure.waitForDeployment();
        const settlementTokenFactory = await hardhat_1.ethers.getContractFactory("MockSettlementToken");
        settlementToken = await settlementTokenFactory.deploy();
        await settlementToken.waitForDeployment();
        const settlementAdapterFactory = await hardhat_1.ethers.getContractFactory("MockSettlementTreasuryAdapter");
        settlementAdapter = await settlementAdapterFactory.deploy(await payroll.getAddress(), await settlementToken.getAddress());
        await settlementAdapter.waitForDeployment();
        const confidentialSettlementTokenFactory = await hardhat_1.ethers.getContractFactory("MockConfidentialPayrollToken");
        confidentialSettlementToken = await confidentialSettlementTokenFactory.deploy(await settlementToken.getAddress());
        await confidentialSettlementToken.waitForDeployment();
        const confidentialSettlementAdapterFactory = await hardhat_1.ethers.getContractFactory("MockFHERC20SettlementTreasuryAdapter");
        confidentialSettlementAdapter = await confidentialSettlementAdapterFactory.deploy(await payroll.getAddress(), await settlementToken.getAddress(), await confidentialSettlementToken.getAddress());
        await confidentialSettlementAdapter.waitForDeployment();
    });
    it("encrypts budget math across multiple deposits and keeps summaries decryptable for the admin", async function () {
        const orgId = hardhat_1.ethers.id("org:budget");
        const metadataHash = hardhat_1.ethers.id("meta:budget");
        const firstDeposit = 25n;
        const secondDeposit = 10n;
        const payrollAmount = 7n;
        await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
        await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, firstDeposit));
        await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, secondDeposit));
        await payroll.connect(admin).issueConfidentialPayroll(orgId, employee.address, await encryptUint128(adminClient, payrollAmount), hardhat_1.ethers.id("payment:budget-math"), hardhat_1.ethers.id("memo:budget-math"));
        const [budgetHandle, committedHandle, availableHandle] = await payroll.connect(admin).getAdminBudgetHandles(orgId);
        await (0, chai_1.expect)(payroll.connect(employee).getAdminBudgetHandles(orgId)).to.be.revertedWith("CipherRoll: not admin");
        (0, chai_1.expect)(await decryptUint128WithExplicitPermit(adminClient, budgetHandle)).to.equal(firstDeposit + secondDeposit);
        (0, chai_1.expect)(await decryptUint128WithExplicitPermit(adminClient, committedHandle)).to.equal(payrollAmount);
        (0, chai_1.expect)(await decryptUint128WithExplicitPermit(adminClient, availableHandle)).to.equal(firstDeposit + secondDeposit - payrollAmount);
    });
    it("issues confidential payroll and lets only the employee decrypt their allocation", async function () {
        const orgId = hardhat_1.ethers.id("org:payroll");
        const metadataHash = hardhat_1.ethers.id("meta:payroll");
        const paymentId = hardhat_1.ethers.id("payment:1");
        const memoHash = hardhat_1.ethers.id('memo:payroll');
        const depositAmount = 25n;
        const payrollAmount = 7n;
        await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
        await payroll
            .connect(admin)
            .depositBudget(orgId, await encryptUint128(adminClient, depositAmount));
        await payroll.connect(admin).issueConfidentialPayroll(orgId, employee.address, await encryptUint128(adminClient, payrollAmount), paymentId, memoHash);
        const [budgetHandle, committedHandle, availableHandle] = await payroll.connect(admin).getAdminBudgetHandles(orgId);
        (0, chai_1.expect)(await decryptUint128(adminClient, budgetHandle)).to.equal(depositAmount);
        (0, chai_1.expect)(await decryptUint128(adminClient, committedHandle)).to.equal(payrollAmount);
        (0, chai_1.expect)(await decryptUint128(adminClient, availableHandle)).to.equal(depositAmount - payrollAmount);
        const employeeAllocations = await payroll
            .connect(employee)
            .getEmployeeAllocations(orgId, employee.address);
        (0, chai_1.expect)(employeeAllocations[0]).to.deep.equal([paymentId]);
        (0, chai_1.expect)(employeeAllocations[1]).to.deep.equal([memoHash]);
        (0, chai_1.expect)(employeeAllocations[3]).to.have.length(1);
        (0, chai_1.expect)(await decryptUint128WithExplicitPermit(employeeClient, employeeAllocations[3][0])).to.equal(payrollAmount);
        await (0, chai_1.expect)(payroll.connect(outsider).getEmployeeAllocations(orgId, employee.address)).to.be.revertedWith("CipherRoll: employee only");
        await expectDecryptFailure(async () => {
            await decryptUint128WithExplicitPermit(outsiderClient, employeeAllocations[3][0]);
        });
    });
    it("zeroes an allocation that exceeds the available encrypted budget", async function () {
        const orgId = hardhat_1.ethers.id("org:capacity");
        const metadataHash = hardhat_1.ethers.id("meta:capacity");
        const paymentId = hardhat_1.ethers.id("payment:capacity");
        const memoHash = hardhat_1.ethers.id("memo:capacity");
        await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
        await payroll
            .connect(admin)
            .depositBudget(orgId, await encryptUint128(adminClient, 5n));
        await payroll.connect(admin).issueConfidentialPayroll(orgId, employee.address, await encryptUint128(adminClient, 8n), paymentId, memoHash);
        const [budgetHandle, committedHandle, availableHandle] = await payroll.connect(admin).getAdminBudgetHandles(orgId);
        const employeeAllocations = await payroll
            .connect(employee)
            .getEmployeeAllocations(orgId, employee.address);
        (0, chai_1.expect)(await decryptUint128(adminClient, budgetHandle)).to.equal(5n);
        (0, chai_1.expect)(await decryptUint128(adminClient, committedHandle)).to.equal(0n);
        (0, chai_1.expect)(await decryptUint128(adminClient, availableHandle)).to.equal(5n);
        (0, chai_1.expect)(await decryptUint128(employeeClient, employeeAllocations[3][0])).to.equal(0n);
    });
    it("requires a permit-backed decrypt flow for summary reads", async function () {
        const orgId = hardhat_1.ethers.id("org:permit");
        const metadataHash = hardhat_1.ethers.id("meta:permit");
        await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
        await payroll
            .connect(admin)
            .depositBudget(orgId, await encryptUint128(adminClient, 14n));
        const [budgetHandle] = await payroll.connect(admin).getAdminBudgetHandles(orgId);
        const explicitPermit = await adminClient.permits.getOrCreateSelfPermit();
        await adminClient.permits.removeActivePermit();
        await expectDecryptFailure(async () => {
            await decryptUint128(adminClient, budgetHandle);
        });
        (0, chai_1.expect)(await adminClient.decryptForView(budgetHandle, sdk_1.FheTypes.Uint128).withPermit(explicitPermit).execute()).to.equal(14n);
    });
    it("enforces vesting before claim and prevents double claim", async function () {
        const orgId = hardhat_1.ethers.id("org:vesting");
        const metadataHash = hardhat_1.ethers.id("meta:vesting");
        const paymentId = hardhat_1.ethers.id("payment:vesting");
        const memoHash = hardhat_1.ethers.id("memo:vesting");
        const latestBlock = await hardhat_network_helpers_1.time.latest();
        const vestingStart = latestBlock + 10;
        const vestingEnd = vestingStart + 100;
        await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
        await payroll
            .connect(admin)
            .depositBudget(orgId, await encryptUint128(adminClient, 12n));
        await payroll.connect(admin).issueVestingAllocation(orgId, employee.address, await encryptUint128(adminClient, 4n), paymentId, memoHash, vestingStart, vestingEnd);
        await (0, chai_1.expect)(payroll.connect(employee).claimPayroll(orgId, paymentId)).to.be.revertedWith("CipherRoll: vesting active");
        await hardhat_network_helpers_1.time.increaseTo(vestingEnd);
        await (0, chai_1.expect)(payroll.connect(employee).claimPayroll(orgId, paymentId))
            .to.emit(payroll, "PayrollClaimed")
            .withArgs(orgId, paymentId, employee.address);
        (0, chai_1.expect)(await payroll.isPayrollClaimed(paymentId)).to.equal(true);
        await (0, chai_1.expect)(payroll.connect(employee).claimPayroll(orgId, paymentId)).to.be.revertedWith("CipherRoll: already claimed");
    });
    it("stores public vesting metadata while keeping the amount encrypted", async function () {
        const orgId = hardhat_1.ethers.id("org:vesting-meta");
        const metadataHash = hardhat_1.ethers.id("meta:vesting-meta");
        const paymentId = hardhat_1.ethers.id("payment:vesting-meta");
        const memoHash = hardhat_1.ethers.id("memo:vesting-meta");
        const latestBlock = await hardhat_network_helpers_1.time.latest();
        const vestingStart = latestBlock + 15;
        const vestingEnd = vestingStart + 50;
        await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
        await payroll
            .connect(admin)
            .depositBudget(orgId, await encryptUint128(adminClient, 20n));
        await payroll.connect(admin).issueVestingAllocation(orgId, employee.address, await encryptUint128(adminClient, 6n), paymentId, memoHash, vestingStart, vestingEnd);
        const meta = await payroll.connect(employee).getPayrollAllocationMeta(paymentId);
        const employeeAllocations = await payroll
            .connect(employee)
            .getEmployeeAllocations(orgId, employee.address);
        (0, chai_1.expect)(meta.employee).to.equal(employee.address);
        (0, chai_1.expect)(meta.paymentId).to.equal(paymentId);
        (0, chai_1.expect)(meta.memoHash).to.equal(memoHash);
        (0, chai_1.expect)(meta.isVesting).to.equal(true);
        (0, chai_1.expect)(Number(meta.vestingStart)).to.equal(vestingStart);
        (0, chai_1.expect)(Number(meta.vestingEnd)).to.equal(vestingEnd);
        (0, chai_1.expect)(await decryptUint128WithExplicitPermit(employeeClient, employeeAllocations[3][0])).to.equal(6n);
    });
    it("tracks aggregate organization insights without exposing employee salary rows", async function () {
        const orgId = hardhat_1.ethers.id("org:insights");
        const metadataHash = hardhat_1.ethers.id("meta:insights");
        const firstPaymentId = hardhat_1.ethers.id("payment:insights:1");
        const secondPaymentId = hardhat_1.ethers.id("payment:insights:2");
        const latestBlock = await hardhat_network_helpers_1.time.latest();
        await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
        await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, 25n));
        await payroll.connect(admin).issueConfidentialPayroll(orgId, employee.address, await encryptUint128(adminClient, 5n), firstPaymentId, hardhat_1.ethers.id("memo:insights:1"));
        await payroll.connect(admin).issueVestingAllocation(orgId, outsider.address, await encryptUint128(adminClient, 4n), secondPaymentId, hardhat_1.ethers.id("memo:insights:2"), latestBlock + 10, latestBlock + 30);
        await payroll.connect(employee).claimPayroll(orgId, firstPaymentId);
        const insights = await payroll.connect(admin).getOrganizationInsights(orgId);
        (0, chai_1.expect)(Number(insights.totalPayrollItems)).to.equal(2);
        (0, chai_1.expect)(Number(insights.activePayrollItems)).to.equal(1);
        (0, chai_1.expect)(Number(insights.claimedPayrollItems)).to.equal(1);
        (0, chai_1.expect)(Number(insights.vestingPayrollItems)).to.equal(1);
        (0, chai_1.expect)(Number(insights.employeeRecipients)).to.equal(2);
        (0, chai_1.expect)(Number(insights.lastIssuedAt)).to.be.greaterThan(0);
        (0, chai_1.expect)(Number(insights.lastClaimedAt)).to.be.greaterThan(0);
        await (0, chai_1.expect)(payroll.connect(employee).getOrganizationInsights(orgId)).to.be.revertedWith("CipherRoll: not admin");
    });
    it("exposes auditor-safe aggregate summaries and shared-permit decryptable handles", async function () {
        const orgId = hardhat_1.ethers.id("org:auditor-summary");
        const metadataHash = hardhat_1.ethers.id("meta:auditor-summary");
        const draftRunId = hardhat_1.ethers.id("run:auditor:draft");
        const fundedRunId = hardhat_1.ethers.id("run:auditor:funded");
        const finalizedRunId = hardhat_1.ethers.id("run:auditor:finalized");
        const fundedPaymentId = hardhat_1.ethers.id("payment:auditor:funded");
        const finalizedPaymentId = hardhat_1.ethers.id("payment:auditor:finalized");
        const latestBlock = await hardhat_network_helpers_1.time.latest();
        await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
        await payroll.connect(admin).configureTreasury(orgId, await settlementAdapter.getAddress(), hardhat_1.ethers.id("route:auditor-summary"));
        await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, 20n));
        await payroll.connect(admin).createPayrollRun(orgId, draftRunId, hardhat_1.ethers.id("asset:auditor:draft"), latestBlock + 1000, 1);
        await payroll.connect(admin).createPayrollRun(orgId, fundedRunId, hardhat_1.ethers.id("asset:auditor:funded"), latestBlock + 1100, 1);
        await payroll.connect(admin).createPayrollRun(orgId, finalizedRunId, hardhat_1.ethers.id("asset:auditor:finalized"), latestBlock + 1200, 1);
        await payroll.connect(admin).issueConfidentialPayrollToRun(orgId, fundedRunId, outsider.address, await encryptUint128(adminClient, 5n), fundedPaymentId, hardhat_1.ethers.id("memo:auditor:funded"));
        await payroll.connect(admin).issueConfidentialPayrollToRun(orgId, finalizedRunId, employee.address, await encryptUint128(adminClient, 4n), finalizedPaymentId, hardhat_1.ethers.id("memo:auditor:finalized"));
        await settlementToken.connect(admin).approve(await settlementAdapter.getAddress(), 9n);
        await settlementAdapter.connect(admin).depositPayrollFunds(orgId, 9n);
        await payroll.connect(admin).fundPayrollRunFromTreasury(orgId, fundedRunId, 5n);
        await payroll.connect(admin).fundPayrollRunFromTreasury(orgId, finalizedRunId, 4n);
        await payroll.connect(admin).activatePayrollRun(orgId, finalizedRunId);
        const employeeAllocations = await payroll
            .connect(employee)
            .getEmployeeAllocations(orgId, employee.address);
        const settlementProof = await employeeClient
            .decryptForTx(employeeAllocations[3][0])
            .withPermit(await employeeClient.permits.getOrCreateSelfPermit())
            .execute();
        await payroll.connect(employee).claimPayrollWithSettlement(orgId, finalizedPaymentId, settlementProof.decryptedValue, settlementProof.signature);
        const auditorSummary = await auditorDisclosure.connect(outsider).getAuditorOrganizationSummary(orgId);
        (0, chai_1.expect)(auditorSummary.treasuryRouteConfigured).to.equal(true);
        (0, chai_1.expect)(auditorSummary.supportsConfidentialSettlement).to.equal(false);
        (0, chai_1.expect)(auditorSummary.settlementAsset).to.equal(await settlementToken.getAddress());
        (0, chai_1.expect)(auditorSummary.confidentialSettlementAsset).to.equal(hardhat_1.ethers.ZeroAddress);
        (0, chai_1.expect)(auditorSummary.availableTreasuryFunds).to.equal(0n);
        (0, chai_1.expect)(auditorSummary.reservedTreasuryFunds).to.equal(5n);
        (0, chai_1.expect)(Number(auditorSummary.totalPayrollRuns)).to.equal(3);
        (0, chai_1.expect)(Number(auditorSummary.draftPayrollRuns)).to.equal(1);
        (0, chai_1.expect)(Number(auditorSummary.fundedPayrollRuns)).to.equal(1);
        (0, chai_1.expect)(Number(auditorSummary.activePayrollRuns)).to.equal(0);
        (0, chai_1.expect)(Number(auditorSummary.finalizedPayrollRuns)).to.equal(1);
        (0, chai_1.expect)(Number(auditorSummary.totalPayrollItems)).to.equal(2);
        (0, chai_1.expect)(Number(auditorSummary.activePayrollItems)).to.equal(1);
        (0, chai_1.expect)(Number(auditorSummary.claimedPayrollItems)).to.equal(1);
        (0, chai_1.expect)(Number(auditorSummary.vestingPayrollItems)).to.equal(0);
        (0, chai_1.expect)(Number(auditorSummary.employeeRecipients)).to.equal(2);
        (0, chai_1.expect)(Number(auditorSummary.lastIssuedAt)).to.be.greaterThan(0);
        (0, chai_1.expect)(Number(auditorSummary.lastClaimedAt)).to.be.greaterThan(0);
        const [budgetHandle, committedHandle, availableHandle] = await auditorDisclosure.connect(outsider).getAuditorEncryptedSummaryHandles(orgId);
        await expectDecryptFailure(async () => {
            await decryptUint128WithExplicitPermit(outsiderClient, budgetHandle);
        });
        const sharingPermit = await adminClient.permits.createSharing({
            name: "Auditor aggregate summary",
            issuer: admin.address,
            recipient: outsider.address
        });
        const recipientPermit = await outsiderClient.permits.importShared(permits_1.PermitUtils.export(sharingPermit));
        (0, chai_1.expect)(await outsiderClient.decryptForView(budgetHandle, sdk_1.FheTypes.Uint128).withPermit(recipientPermit).execute()).to.equal(20n);
        (0, chai_1.expect)(await outsiderClient.decryptForView(committedHandle, sdk_1.FheTypes.Uint128).withPermit(recipientPermit).execute()).to.equal(9n);
        (0, chai_1.expect)(await outsiderClient.decryptForView(availableHandle, sdk_1.FheTypes.Uint128).withPermit(recipientPermit).execute()).to.equal(11n);
        await (0, chai_1.expect)(payroll.connect(outsider).getAdminBudgetHandles(orgId)).to.be.revertedWith("CipherRoll: not admin");
        await (0, chai_1.expect)(payroll.connect(outsider).getOrganizationInsights(orgId)).to.be.revertedWith("CipherRoll: not admin");
    });
    it("promotes shared auditor aggregates from viewable to provable with verify and publish receipts", async function () {
        const orgId = hardhat_1.ethers.id("org:auditor-evidence");
        const metadataHash = hardhat_1.ethers.id("meta:auditor-evidence");
        await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
        await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, 30n));
        await payroll.connect(admin).issueConfidentialPayroll(orgId, employee.address, await encryptUint128(adminClient, 12n), hardhat_1.ethers.id("payment:auditor-evidence"), hardhat_1.ethers.id("memo:auditor-evidence"));
        const sharingPermit = await adminClient.permits.createSharing({
            name: "Auditor provable evidence",
            issuer: admin.address,
            recipient: outsider.address
        });
        const recipientPermit = await outsiderClient.permits.importShared(permits_1.PermitUtils.export(sharingPermit));
        const budgetHandle = await auditorDisclosure.getAuditorAggregateHandle(orgId, 0);
        const availableHandle = await auditorDisclosure.getAuditorAggregateHandle(orgId, 2);
        const budgetProof = await outsiderClient
            .decryptForTx(budgetHandle)
            .withPermit(recipientPermit)
            .execute();
        await (0, chai_1.expect)(auditorDisclosure.connect(outsider).verifyAuditorAggregateDisclosure(orgId, 0, budgetProof.decryptedValue, budgetProof.signature))
            .to.emit(auditorDisclosure, "AuditorAggregateDisclosureRecorded")
            .withArgs(orgId, 0, outsider.address, 30n, false);
        await (0, chai_1.expect)(auditorDisclosure.connect(outsider).verifyAuditorAggregateDisclosure(orgId, 0, budgetProof.decryptedValue + 1n, budgetProof.signature)).to.be.reverted;
        const availableProof = await outsiderClient
            .decryptForTx(availableHandle)
            .withPermit(recipientPermit)
            .execute();
        await (0, chai_1.expect)(auditorDisclosure.connect(outsider).publishAuditorAggregateDisclosure(orgId, 2, availableProof.decryptedValue, availableProof.signature))
            .to.emit(auditorDisclosure, "AuditorAggregateDisclosureRecorded")
            .withArgs(orgId, 2, outsider.address, 18n, true);
    });
    it("supports batched auditor evidence receipts without exposing employee-level state", async function () {
        const orgId = hardhat_1.ethers.id("org:auditor-batch");
        const metadataHash = hardhat_1.ethers.id("meta:auditor-batch");
        await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
        await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, 40n));
        await payroll.connect(admin).issueConfidentialPayroll(orgId, employee.address, await encryptUint128(adminClient, 14n), hardhat_1.ethers.id("payment:auditor-batch"), hardhat_1.ethers.id("memo:auditor-batch"));
        const sharingPermit = await adminClient.permits.createSharing({
            name: "Auditor batch evidence",
            issuer: admin.address,
            recipient: outsider.address
        });
        const recipientPermit = await outsiderClient.permits.importShared(permits_1.PermitUtils.export(sharingPermit));
        const metrics = [0, 1, 2];
        const handles = await Promise.all(metrics.map((metric) => auditorDisclosure.getAuditorAggregateHandle(orgId, metric)));
        const decryptResults = await Promise.all(handles.map((handle) => outsiderClient.decryptForTx(handle).withPermit(recipientPermit).execute()));
        await (0, chai_1.expect)(auditorDisclosure.connect(outsider).verifyAuditorAggregateDisclosureBatch(orgId, [...metrics], decryptResults.map((result) => result.decryptedValue), decryptResults.map((result) => result.signature)))
            .to.emit(auditorDisclosure, "AuditorAggregateDisclosureBatchRecorded")
            .withArgs(orgId, outsider.address, hardhat_1.ethers.keccak256(hardhat_1.ethers.AbiCoder.defaultAbiCoder().encode(["uint8[]", "uint128[]", "bytes32[]"], [[...metrics], [40n, 14n, 26n], handles])), false);
        await (0, chai_1.expect)(auditorDisclosure.connect(outsider).publishAuditorAggregateDisclosureBatch(orgId, [...metrics], decryptResults.map((result) => result.decryptedValue), decryptResults.map((result) => result.signature)))
            .to.emit(auditorDisclosure, "AuditorAggregateDisclosureBatchRecorded")
            .withArgs(orgId, outsider.address, hardhat_1.ethers.keccak256(hardhat_1.ethers.AbiCoder.defaultAbiCoder().encode(["uint8[]", "uint128[]", "bytes32[]"], [[...metrics], [40n, 14n, 26n], handles])), true);
        await (0, chai_1.expect)(auditorDisclosure.connect(outsider).verifyAuditorAggregateDisclosureBatch(orgId, [0, 1], [decryptResults[0].decryptedValue], [decryptResults[0].signature, decryptResults[1].signature])).to.be.revertedWith("CR: batch length");
    });
    it("models explicit payroll runs with funding, activation, and finalization gates", async function () {
        const orgId = hardhat_1.ethers.id("org:run-lifecycle");
        const metadataHash = hardhat_1.ethers.id("meta:run-lifecycle");
        const payrollRunId = hardhat_1.ethers.id("run:lifecycle");
        const paymentId = hardhat_1.ethers.id("payment:lifecycle");
        const memoHash = hardhat_1.ethers.id("memo:lifecycle");
        const latestBlock = await hardhat_network_helpers_1.time.latest();
        await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
        await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, 20n));
        await payroll.connect(admin).createPayrollRun(orgId, payrollRunId, hardhat_1.ethers.id("asset:test-payroll"), latestBlock + 1000, 1);
        await payroll.connect(admin).issueConfidentialPayrollToRun(orgId, payrollRunId, employee.address, await encryptUint128(adminClient, 6n), paymentId, memoHash);
        await (0, chai_1.expect)(payroll.connect(employee).claimPayroll(orgId, paymentId)).to.be.revertedWith("CipherRoll: payroll run not active");
        await (0, chai_1.expect)(payroll.connect(admin).activatePayrollRun(orgId, payrollRunId)).to.be.revertedWith("CipherRoll: payroll run not funded");
        await payroll.connect(admin).fundPayrollRun(orgId, payrollRunId, await encryptUint128(adminClient, 6n));
        let payrollRun = await payroll.connect(admin).getPayrollRun(payrollRunId);
        (0, chai_1.expect)(Number(payrollRun.status)).to.equal(1);
        (0, chai_1.expect)(Number(payrollRun.allocationCount)).to.equal(1);
        (0, chai_1.expect)(Number(payrollRun.claimedCount)).to.equal(0);
        await payroll.connect(admin).activatePayrollRun(orgId, payrollRunId);
        payrollRun = await payroll.connect(admin).getPayrollRun(payrollRunId);
        (0, chai_1.expect)(Number(payrollRun.status)).to.equal(2);
        (0, chai_1.expect)(await payroll.getPayrollRunForPayment(paymentId)).to.equal(payrollRunId);
        await payroll.connect(employee).claimPayroll(orgId, paymentId);
        payrollRun = await payroll.connect(admin).getPayrollRun(payrollRunId);
        (0, chai_1.expect)(Number(payrollRun.status)).to.equal(3);
        (0, chai_1.expect)(Number(payrollRun.claimedCount)).to.equal(1);
        (0, chai_1.expect)(Number(payrollRun.finalizedAt)).to.be.greaterThan(0);
    });
    it("settles a claimed payroll allocation into a real token balance when treasury settlement is configured", async function () {
        const orgId = hardhat_1.ethers.id("org:settlement");
        const metadataHash = hardhat_1.ethers.id("meta:settlement");
        const payrollRunId = hardhat_1.ethers.id("run:settlement");
        const paymentId = hardhat_1.ethers.id("payment:settlement");
        const memoHash = hardhat_1.ethers.id("memo:settlement");
        const latestBlock = await hardhat_network_helpers_1.time.latest();
        const settlementAmount = 8n * 10n ** 18n;
        await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
        await payroll.connect(admin).configureTreasury(orgId, await settlementAdapter.getAddress(), hardhat_1.ethers.id("route:settlement"));
        await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, settlementAmount));
        await payroll.connect(admin).createPayrollRun(orgId, payrollRunId, hardhat_1.ethers.id("asset:cpusd"), latestBlock + 1000, 1);
        await payroll.connect(admin).issueConfidentialPayrollToRun(orgId, payrollRunId, employee.address, await encryptUint128(adminClient, settlementAmount), paymentId, memoHash);
        await settlementToken.connect(admin).approve(await settlementAdapter.getAddress(), settlementAmount);
        await settlementAdapter.connect(admin).depositPayrollFunds(orgId, settlementAmount);
        await payroll.connect(admin).fundPayrollRunFromTreasury(orgId, payrollRunId, settlementAmount);
        await payroll.connect(admin).activatePayrollRun(orgId, payrollRunId);
        const employeeAllocations = await payroll
            .connect(employee)
            .getEmployeeAllocations(orgId, employee.address);
        const decryptResult = await employeeClient
            .decryptForTx(employeeAllocations[3][0])
            .withPermit(await employeeClient.permits.getOrCreateSelfPermit())
            .execute();
        const startingBalance = await settlementToken.balanceOf(employee.address);
        await (0, chai_1.expect)(payroll.connect(employee).claimPayrollWithSettlement(orgId, paymentId, decryptResult.decryptedValue, decryptResult.signature))
            .to.emit(payroll, "PayrollSettled")
            .withArgs(orgId, paymentId, employee.address, await settlementToken.getAddress(), settlementAmount);
        (0, chai_1.expect)(await payroll.isPayrollClaimed(paymentId)).to.equal(true);
        (0, chai_1.expect)(await settlementToken.balanceOf(employee.address)).to.equal(startingBalance + settlementAmount);
        (0, chai_1.expect)(await settlementAdapter.availablePayrollFunds(orgId)).to.equal(0n);
        (0, chai_1.expect)(await settlementAdapter.reservedPayrollFunds(orgId)).to.equal(0n);
    });
    it("uses the official FHERC20 wrapper path for request and finalize payroll settlement", async function () {
        const orgId = hardhat_1.ethers.id("org:fherc20-settlement");
        const metadataHash = hardhat_1.ethers.id("meta:fherc20-settlement");
        const payrollRunId = hardhat_1.ethers.id("run:fherc20-settlement");
        const paymentId = hardhat_1.ethers.id("payment:fherc20-settlement");
        const memoHash = hardhat_1.ethers.id("memo:fherc20-settlement");
        const latestBlock = await hardhat_network_helpers_1.time.latest();
        const settlementAmount = 9n * 10n ** 18n;
        await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
        await payroll.connect(admin).configureTreasury(orgId, await confidentialSettlementAdapter.getAddress(), hardhat_1.ethers.id("route:fherc20-settlement"));
        await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, settlementAmount));
        await payroll.connect(admin).createPayrollRun(orgId, payrollRunId, hardhat_1.ethers.id("asset:ccpusd"), latestBlock + 1000, 1);
        await payroll.connect(admin).issueConfidentialPayrollToRun(orgId, payrollRunId, employee.address, await encryptUint128(adminClient, settlementAmount), paymentId, memoHash);
        await settlementToken.connect(admin).approve(await confidentialSettlementAdapter.getAddress(), settlementAmount);
        await confidentialSettlementAdapter.connect(admin).depositPayrollFunds(orgId, settlementAmount);
        await payroll.connect(admin).fundPayrollRunFromTreasury(orgId, payrollRunId, settlementAmount);
        await payroll.connect(admin).activatePayrollRun(orgId, payrollRunId);
        const employeeAllocations = await payroll
            .connect(employee)
            .getEmployeeAllocations(orgId, employee.address);
        const allocationDecryptResult = await employeeClient
            .decryptForTx(employeeAllocations[3][0])
            .withPermit(await employeeClient.permits.getOrCreateSelfPermit())
            .execute();
        await (0, chai_1.expect)(payroll.connect(employee).requestPayrollSettlement(orgId, paymentId, allocationDecryptResult.decryptedValue, allocationDecryptResult.signature))
            .to.emit(payroll, "PayrollSettlementRequested");
        const settlementRequest = await payroll.connect(employee).getPayrollSettlementRequest(paymentId);
        (0, chai_1.expect)(settlementRequest.exists).to.equal(true);
        (0, chai_1.expect)(settlementRequest.payoutAsset).to.equal(await settlementToken.getAddress());
        (0, chai_1.expect)(settlementRequest.confidentialAsset).to.equal(await confidentialSettlementToken.getAddress());
        const requestDecryptResult = await employeeClient
            .decryptForTx(settlementRequest.requestId)
            .withoutPermit()
            .execute();
        const startingBalance = await settlementToken.balanceOf(employee.address);
        await (0, chai_1.expect)(payroll.connect(employee).finalizePayrollSettlement(orgId, paymentId, requestDecryptResult.decryptedValue, requestDecryptResult.signature))
            .to.emit(payroll, "PayrollSettled")
            .withArgs(orgId, paymentId, employee.address, await settlementToken.getAddress(), settlementAmount);
        (0, chai_1.expect)(await payroll.isPayrollClaimed(paymentId)).to.equal(true);
        (0, chai_1.expect)(await settlementToken.balanceOf(employee.address)).to.equal(startingBalance + settlementAmount);
        (0, chai_1.expect)((await payroll.connect(employee).getPayrollSettlementRequest(paymentId)).exists).to.equal(false);
        (0, chai_1.expect)(await confidentialSettlementAdapter.availablePayrollFunds(orgId)).to.equal(0n);
        (0, chai_1.expect)(await confidentialSettlementAdapter.reservedPayrollFunds(orgId)).to.equal(0n);
    });
    it("rejects wrapper finalize payloads with the wrong plaintext for the unshield request", async function () {
        const orgId = hardhat_1.ethers.id("org:fherc20-wrong-plaintext");
        const metadataHash = hardhat_1.ethers.id("meta:fherc20-wrong-plaintext");
        const payrollRunId = hardhat_1.ethers.id("run:fherc20-wrong-plaintext");
        const paymentId = hardhat_1.ethers.id("payment:fherc20-wrong-plaintext");
        const memoHash = hardhat_1.ethers.id("memo:fherc20-wrong-plaintext");
        const latestBlock = await hardhat_network_helpers_1.time.latest();
        const settlementAmount = 9n * 10n ** 18n;
        await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
        await payroll.connect(admin).configureTreasury(orgId, await confidentialSettlementAdapter.getAddress(), hardhat_1.ethers.id("route:fherc20-wrong-plaintext"));
        await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, settlementAmount));
        await payroll.connect(admin).createPayrollRun(orgId, payrollRunId, hardhat_1.ethers.id("asset:ccpusd-wrong-plaintext"), latestBlock + 1000, 1);
        await payroll.connect(admin).issueConfidentialPayrollToRun(orgId, payrollRunId, employee.address, await encryptUint128(adminClient, settlementAmount), paymentId, memoHash);
        await settlementToken.connect(admin).approve(await confidentialSettlementAdapter.getAddress(), settlementAmount);
        await confidentialSettlementAdapter.connect(admin).depositPayrollFunds(orgId, settlementAmount);
        await payroll.connect(admin).fundPayrollRunFromTreasury(orgId, payrollRunId, settlementAmount);
        await payroll.connect(admin).activatePayrollRun(orgId, payrollRunId);
        const employeeAllocations = await payroll
            .connect(employee)
            .getEmployeeAllocations(orgId, employee.address);
        const allocationDecryptResult = await employeeClient
            .decryptForTx(employeeAllocations[3][0])
            .withPermit(await employeeClient.permits.getOrCreateSelfPermit())
            .execute();
        await payroll.connect(employee).requestPayrollSettlement(orgId, paymentId, allocationDecryptResult.decryptedValue, allocationDecryptResult.signature);
        const settlementRequest = await payroll.connect(employee).getPayrollSettlementRequest(paymentId);
        const requestDecryptResult = await employeeClient
            .decryptForTx(settlementRequest.requestId)
            .withoutPermit()
            .execute();
        await (0, chai_1.expect)(payroll.connect(employee).finalizePayrollSettlement(orgId, paymentId, requestDecryptResult.decryptedValue + 1n, requestDecryptResult.signature)).to.be.revertedWith("CipherRoll: invalid wrapper settlement proof");
        (0, chai_1.expect)(await payroll.isPayrollClaimed(paymentId)).to.equal(false);
        (0, chai_1.expect)((await payroll.connect(employee).getPayrollSettlementRequest(paymentId)).exists).to.equal(true);
    });
    it("rejects wrapper finalize payloads whose decrypt proof belongs to a different unshield request", async function () {
        const orgId = hardhat_1.ethers.id("org:fherc20-mismatched-request");
        const metadataHash = hardhat_1.ethers.id("meta:fherc20-mismatched-request");
        const payrollRunId = hardhat_1.ethers.id("run:fherc20-mismatched-request");
        const firstPaymentId = hardhat_1.ethers.id("payment:fherc20-mismatched-request:1");
        const secondPaymentId = hardhat_1.ethers.id("payment:fherc20-mismatched-request:2");
        const latestBlock = await hardhat_network_helpers_1.time.latest();
        const firstSettlementAmount = 4n * 10n ** 18n;
        const secondSettlementAmount = 5n * 10n ** 18n;
        const totalFunding = firstSettlementAmount + secondSettlementAmount;
        await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
        await payroll.connect(admin).configureTreasury(orgId, await confidentialSettlementAdapter.getAddress(), hardhat_1.ethers.id("route:fherc20-mismatched-request"));
        await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, totalFunding));
        await payroll.connect(admin).createPayrollRun(orgId, payrollRunId, hardhat_1.ethers.id("asset:ccpusd-mismatched-request"), latestBlock + 1000, 2);
        await payroll.connect(admin).issueConfidentialPayrollToRun(orgId, payrollRunId, employee.address, await encryptUint128(adminClient, firstSettlementAmount), firstPaymentId, hardhat_1.ethers.id("memo:fherc20-mismatched-request:1"));
        await payroll.connect(admin).issueConfidentialPayrollToRun(orgId, payrollRunId, employee.address, await encryptUint128(adminClient, secondSettlementAmount), secondPaymentId, hardhat_1.ethers.id("memo:fherc20-mismatched-request:2"));
        await settlementToken.connect(admin).approve(await confidentialSettlementAdapter.getAddress(), totalFunding);
        await confidentialSettlementAdapter.connect(admin).depositPayrollFunds(orgId, totalFunding);
        await payroll.connect(admin).fundPayrollRunFromTreasury(orgId, payrollRunId, totalFunding);
        await payroll.connect(admin).activatePayrollRun(orgId, payrollRunId);
        const employeeAllocations = await payroll
            .connect(employee)
            .getEmployeeAllocations(orgId, employee.address);
        const firstAllocationDecryptResult = await employeeClient
            .decryptForTx(employeeAllocations[3][0])
            .withPermit(await employeeClient.permits.getOrCreateSelfPermit())
            .execute();
        const secondAllocationDecryptResult = await employeeClient
            .decryptForTx(employeeAllocations[3][1])
            .withPermit(await employeeClient.permits.getOrCreateSelfPermit())
            .execute();
        await payroll.connect(employee).requestPayrollSettlement(orgId, firstPaymentId, firstAllocationDecryptResult.decryptedValue, firstAllocationDecryptResult.signature);
        await payroll.connect(employee).requestPayrollSettlement(orgId, secondPaymentId, secondAllocationDecryptResult.decryptedValue, secondAllocationDecryptResult.signature);
        const firstSettlementRequest = await payroll.connect(employee).getPayrollSettlementRequest(firstPaymentId);
        const secondSettlementRequest = await payroll.connect(employee).getPayrollSettlementRequest(secondPaymentId);
        (0, chai_1.expect)(firstSettlementRequest.requestId).to.not.equal(secondSettlementRequest.requestId);
        const secondRequestDecryptResult = await employeeClient
            .decryptForTx(secondSettlementRequest.requestId)
            .withoutPermit()
            .execute();
        await (0, chai_1.expect)(payroll.connect(employee).finalizePayrollSettlement(orgId, firstPaymentId, secondRequestDecryptResult.decryptedValue, secondRequestDecryptResult.signature)).to.be.revertedWith("CipherRoll: invalid wrapper settlement proof");
        (0, chai_1.expect)(await payroll.isPayrollClaimed(firstPaymentId)).to.equal(false);
        (0, chai_1.expect)((await payroll.connect(employee).getPayrollSettlementRequest(firstPaymentId)).exists).to.equal(true);
        (0, chai_1.expect)((await payroll.connect(employee).getPayrollSettlementRequest(secondPaymentId)).exists).to.equal(true);
    });
    it("rejects replayed wrapper finalize attempts after a successful claim", async function () {
        const orgId = hardhat_1.ethers.id("org:fherc20-replayed-finalize");
        const metadataHash = hardhat_1.ethers.id("meta:fherc20-replayed-finalize");
        const payrollRunId = hardhat_1.ethers.id("run:fherc20-replayed-finalize");
        const paymentId = hardhat_1.ethers.id("payment:fherc20-replayed-finalize");
        const memoHash = hardhat_1.ethers.id("memo:fherc20-replayed-finalize");
        const latestBlock = await hardhat_network_helpers_1.time.latest();
        const settlementAmount = 9n * 10n ** 18n;
        await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
        await payroll.connect(admin).configureTreasury(orgId, await confidentialSettlementAdapter.getAddress(), hardhat_1.ethers.id("route:fherc20-replayed-finalize"));
        await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, settlementAmount));
        await payroll.connect(admin).createPayrollRun(orgId, payrollRunId, hardhat_1.ethers.id("asset:ccpusd-replayed-finalize"), latestBlock + 1000, 1);
        await payroll.connect(admin).issueConfidentialPayrollToRun(orgId, payrollRunId, employee.address, await encryptUint128(adminClient, settlementAmount), paymentId, memoHash);
        await settlementToken.connect(admin).approve(await confidentialSettlementAdapter.getAddress(), settlementAmount);
        await confidentialSettlementAdapter.connect(admin).depositPayrollFunds(orgId, settlementAmount);
        await payroll.connect(admin).fundPayrollRunFromTreasury(orgId, payrollRunId, settlementAmount);
        await payroll.connect(admin).activatePayrollRun(orgId, payrollRunId);
        const employeeAllocations = await payroll
            .connect(employee)
            .getEmployeeAllocations(orgId, employee.address);
        const allocationDecryptResult = await employeeClient
            .decryptForTx(employeeAllocations[3][0])
            .withPermit(await employeeClient.permits.getOrCreateSelfPermit())
            .execute();
        await payroll.connect(employee).requestPayrollSettlement(orgId, paymentId, allocationDecryptResult.decryptedValue, allocationDecryptResult.signature);
        const settlementRequest = await payroll.connect(employee).getPayrollSettlementRequest(paymentId);
        const requestDecryptResult = await employeeClient
            .decryptForTx(settlementRequest.requestId)
            .withoutPermit()
            .execute();
        await payroll.connect(employee).finalizePayrollSettlement(orgId, paymentId, requestDecryptResult.decryptedValue, requestDecryptResult.signature);
        await (0, chai_1.expect)(payroll.connect(employee).finalizePayrollSettlement(orgId, paymentId, requestDecryptResult.decryptedValue, requestDecryptResult.signature)).to.be.revertedWith("CipherRoll: already claimed");
    });
    it("rejects wrapper finalize calls when no settlement request is pending", async function () {
        const orgId = hardhat_1.ethers.id("org:fherc20-no-pending-request");
        const metadataHash = hardhat_1.ethers.id("meta:fherc20-no-pending-request");
        const payrollRunId = hardhat_1.ethers.id("run:fherc20-no-pending-request");
        const paymentId = hardhat_1.ethers.id("payment:fherc20-no-pending-request");
        const memoHash = hardhat_1.ethers.id("memo:fherc20-no-pending-request");
        const latestBlock = await hardhat_network_helpers_1.time.latest();
        const settlementAmount = 9n * 10n ** 18n;
        await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
        await payroll.connect(admin).configureTreasury(orgId, await confidentialSettlementAdapter.getAddress(), hardhat_1.ethers.id("route:fherc20-no-pending-request"));
        await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, settlementAmount));
        await payroll.connect(admin).createPayrollRun(orgId, payrollRunId, hardhat_1.ethers.id("asset:ccpusd-no-pending-request"), latestBlock + 1000, 1);
        await payroll.connect(admin).issueConfidentialPayrollToRun(orgId, payrollRunId, employee.address, await encryptUint128(adminClient, settlementAmount), paymentId, memoHash);
        await settlementToken.connect(admin).approve(await confidentialSettlementAdapter.getAddress(), settlementAmount);
        await confidentialSettlementAdapter.connect(admin).depositPayrollFunds(orgId, settlementAmount);
        await payroll.connect(admin).fundPayrollRunFromTreasury(orgId, payrollRunId, settlementAmount);
        await payroll.connect(admin).activatePayrollRun(orgId, payrollRunId);
        await (0, chai_1.expect)(payroll.connect(employee).finalizePayrollSettlement(orgId, paymentId, 1n, "0x")).to.be.revertedWith("CipherRoll: settlement request missing");
    });
    it("rejects invalid admin actions and malformed issuance requests", async function () {
        const orgId = hardhat_1.ethers.id("org:invalid-actions");
        const metadataHash = hardhat_1.ethers.id("meta:invalid-actions");
        const paymentId = hardhat_1.ethers.id("payment:invalid-actions");
        const memoHash = hardhat_1.ethers.id("memo:invalid-actions");
        await (0, chai_1.expect)(payroll.connect(admin).createOrganization(orgId, metadataHash, 0, 1)).to.be.revertedWith("CipherRoll: admin slots required");
        await (0, chai_1.expect)(payroll.connect(admin).createOrganization(orgId, metadataHash, 1, 2)).to.be.revertedWith("CipherRoll: invalid quorum");
        await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
        await (0, chai_1.expect)(payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2)).to.be.revertedWith("CipherRoll: org exists");
        await (0, chai_1.expect)(payroll.connect(outsider).depositBudget(orgId, await encryptUint128(outsiderClient, 4n))).to.be.revertedWith("CipherRoll: not admin");
        await (0, chai_1.expect)(payroll.connect(admin).configureTreasury(orgId, hardhat_1.ethers.ZeroAddress, hardhat_1.ethers.id("route:invalid"))).to.be.revertedWith("CipherRoll: adapter required");
        await (0, chai_1.expect)(payroll.connect(admin).issueConfidentialPayroll(orgId, hardhat_1.ethers.ZeroAddress, await encryptUint128(adminClient, 1n), paymentId, memoHash)).to.be.revertedWith("CipherRoll: employee required");
        await (0, chai_1.expect)(payroll.connect(admin).issueVestingAllocation(orgId, employee.address, await encryptUint128(adminClient, 1n), paymentId, memoHash, 10, 10)).to.be.revertedWith("CipherRoll: invalid vesting");
        const payrollRunId = hardhat_1.ethers.id("run:invalid-actions");
        const latestBlock = await hardhat_network_helpers_1.time.latest();
        await (0, chai_1.expect)(payroll.connect(admin).createPayrollRun(orgId, payrollRunId, hardhat_1.ethers.id("asset"), latestBlock - 1, 1)).to.be.revertedWith("CipherRoll: funding deadline required");
        await (0, chai_1.expect)(payroll.connect(admin).createPayrollRun(orgId, payrollRunId, hardhat_1.ethers.id("asset"), latestBlock + 100, 0)).to.be.revertedWith("CipherRoll: headcount required");
        await payroll.connect(admin).createPayrollRun(orgId, payrollRunId, hardhat_1.ethers.id("asset"), latestBlock + 100, 1);
        await (0, chai_1.expect)(payroll.connect(admin).fundPayrollRun(orgId, payrollRunId, await encryptUint128(adminClient, 1n))).to.be.revertedWith("CipherRoll: payroll run has no allocations");
        await payroll.connect(admin).configureTreasury(orgId, await settlementAdapter.getAddress(), hardhat_1.ethers.id("route:treasury"));
        await (0, chai_1.expect)(payroll.connect(admin).fundPayrollRun(orgId, payrollRunId, await encryptUint128(adminClient, 1n))).to.be.revertedWith("CipherRoll: treasury route requires funded asset");
    });
    it("rejects missing or unauthorized claim attempts and duplicate payment ids", async function () {
        const orgId = hardhat_1.ethers.id("org:claim-failures");
        const metadataHash = hardhat_1.ethers.id("meta:claim-failures");
        const paymentId = hardhat_1.ethers.id("payment:claim-failures");
        const memoHash = hardhat_1.ethers.id("memo:claim-failures");
        await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
        await payroll
            .connect(admin)
            .depositBudget(orgId, await encryptUint128(adminClient, 11n));
        await (0, chai_1.expect)(payroll.connect(employee).claimPayroll(orgId, paymentId)).to.be.revertedWith("CipherRoll: payment missing");
        await payroll.connect(admin).issueConfidentialPayroll(orgId, employee.address, await encryptUint128(adminClient, 3n), paymentId, memoHash);
        await (0, chai_1.expect)(payroll.connect(admin).issueConfidentialPayroll(orgId, employee.address, await encryptUint128(adminClient, 2n), paymentId, hardhat_1.ethers.id("memo:claim-failures:duplicate"))).to.be.revertedWith("CipherRoll: payment exists");
        await (0, chai_1.expect)(payroll.connect(outsider).claimPayroll(orgId, paymentId)).to.be.revertedWith("CipherRoll: not employee");
    });
});
