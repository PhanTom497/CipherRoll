import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Encryptable, FheTypes, type CofheClient } from "@cofhe/sdk";
import { PermitUtils } from "@cofhe/sdk/permits";
import { expect } from "chai";
import hre, { ethers } from "hardhat";

import type {
  CipherRollAuditorDisclosure,
  CipherRollPayroll,
  MockConfidentialPayrollToken,
  MockFHERC20SettlementTreasuryAdapter,
  MockSettlementToken,
  MockSettlementTreasuryAdapter
} from "../typechain-types";

describe("CipherRollPayroll", function () {
  let payroll: CipherRollPayroll;
  let auditorDisclosure: CipherRollAuditorDisclosure;
  let admin: HardhatEthersSigner;
  let employee: HardhatEthersSigner;
  let outsider: HardhatEthersSigner;
  let settlementToken: MockSettlementToken;
  let settlementAdapter: MockSettlementTreasuryAdapter;
  let confidentialSettlementToken: MockConfidentialPayrollToken;
  let confidentialSettlementAdapter: MockFHERC20SettlementTreasuryAdapter;
  let adminClient: CofheClient;
  let employeeClient: CofheClient;
  let outsiderClient: CofheClient;

  async function encryptUint128(client: CofheClient, value: bigint) {
    const [encrypted] = await client
      .encryptInputs([Encryptable.uint128(value)])
      .execute();

    return encrypted;
  }

  async function decryptUint128(client: CofheClient, handle: string) {
    return client.decryptForView(handle, FheTypes.Uint128).execute();
  }

  async function decryptUint128WithExplicitPermit(client: CofheClient, handle: string) {
    const permit = await client.permits.getOrCreateSelfPermit();

    return client.decryptForView(handle, FheTypes.Uint128).withPermit(permit).execute();
  }

  async function expectDecryptFailure(work: () => Promise<unknown>) {
    let failed = false;

    try {
      await work();
    } catch {
      failed = true;
    }

    expect(failed).to.equal(true);
  }

  beforeEach(async function () {
    [admin, employee, outsider] = await ethers.getSigners();

    adminClient = await hre.cofhe.createClientWithBatteries(admin);
    employeeClient = await hre.cofhe.createClientWithBatteries(employee);
    outsiderClient = await hre.cofhe.createClientWithBatteries(outsider);

    const payrollFactory = await ethers.getContractFactory("CipherRollPayroll");
    payroll = await payrollFactory.deploy();
    await payroll.waitForDeployment();

    const auditorDisclosureFactory = await ethers.getContractFactory("CipherRollAuditorDisclosure");
    auditorDisclosure = await auditorDisclosureFactory.deploy(await payroll.getAddress());
    await auditorDisclosure.waitForDeployment();

    const settlementTokenFactory = await ethers.getContractFactory("MockSettlementToken");
    settlementToken = await settlementTokenFactory.deploy();
    await settlementToken.waitForDeployment();

    const settlementAdapterFactory = await ethers.getContractFactory("MockSettlementTreasuryAdapter");
    settlementAdapter = await settlementAdapterFactory.deploy(
      await payroll.getAddress(),
      await settlementToken.getAddress()
    );
    await settlementAdapter.waitForDeployment();

    const confidentialSettlementTokenFactory = await ethers.getContractFactory("MockConfidentialPayrollToken");
    confidentialSettlementToken = await confidentialSettlementTokenFactory.deploy(
      await settlementToken.getAddress()
    );
    await confidentialSettlementToken.waitForDeployment();

    const confidentialSettlementAdapterFactory = await ethers.getContractFactory("MockFHERC20SettlementTreasuryAdapter");
    confidentialSettlementAdapter = await confidentialSettlementAdapterFactory.deploy(
      await payroll.getAddress(),
      await settlementToken.getAddress(),
      await confidentialSettlementToken.getAddress()
    );
    await confidentialSettlementAdapter.waitForDeployment();
  });

  it("encrypts budget math across multiple deposits and keeps summaries decryptable for the admin", async function () {
    const orgId = ethers.id("org:budget");
    const metadataHash = ethers.id("meta:budget");
    const firstDeposit = 25n;
    const secondDeposit = 10n;
    const payrollAmount = 7n;

    await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);

    await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, firstDeposit));
    await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, secondDeposit));
    await payroll.connect(admin).issueConfidentialPayroll(
      orgId,
      employee.address,
      await encryptUint128(adminClient, payrollAmount),
      ethers.id("payment:budget-math"),
      ethers.id("memo:budget-math")
    );

    const [budgetHandle, committedHandle, availableHandle] =
      await payroll.connect(admin).getAdminBudgetHandles(orgId);

    await expect(payroll.connect(employee).getAdminBudgetHandles(orgId)).to.be.revertedWith(
      "CipherRoll: not admin"
    );

    expect(await decryptUint128WithExplicitPermit(adminClient, budgetHandle)).to.equal(
      firstDeposit + secondDeposit
    );
    expect(await decryptUint128WithExplicitPermit(adminClient, committedHandle)).to.equal(
      payrollAmount
    );
    expect(await decryptUint128WithExplicitPermit(adminClient, availableHandle)).to.equal(
      firstDeposit + secondDeposit - payrollAmount
    );
  });

  it("issues confidential payroll and lets only the employee decrypt their allocation", async function () {
    const orgId = ethers.id("org:payroll");
    const metadataHash = ethers.id("meta:payroll");
    const paymentId = ethers.id("payment:1");
    const memoHash = ethers.id('memo:payroll');
    const depositAmount = 25n;
    const payrollAmount = 7n;

    await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
    await payroll
      .connect(admin)
      .depositBudget(orgId, await encryptUint128(adminClient, depositAmount));

    await payroll.connect(admin).issueConfidentialPayroll(
      orgId,
      employee.address,
      await encryptUint128(adminClient, payrollAmount),
      paymentId,
      memoHash
    );

    const [budgetHandle, committedHandle, availableHandle] =
      await payroll.connect(admin).getAdminBudgetHandles(orgId);

    expect(await decryptUint128(adminClient, budgetHandle)).to.equal(depositAmount);
    expect(await decryptUint128(adminClient, committedHandle)).to.equal(payrollAmount);
    expect(await decryptUint128(adminClient, availableHandle)).to.equal(depositAmount - payrollAmount);

    const employeeAllocations = await payroll
      .connect(employee)
      .getEmployeeAllocations(orgId, employee.address);

    expect(employeeAllocations[0]).to.deep.equal([paymentId]);
    expect(employeeAllocations[1]).to.deep.equal([memoHash]);
    expect(employeeAllocations[3]).to.have.length(1);
    expect(
      await decryptUint128WithExplicitPermit(employeeClient, employeeAllocations[3][0])
    ).to.equal(payrollAmount);

    await expect(
      payroll.connect(outsider).getEmployeeAllocations(orgId, employee.address)
    ).to.be.revertedWith("CipherRoll: employee only");

    await expectDecryptFailure(async () => {
      await decryptUint128WithExplicitPermit(outsiderClient, employeeAllocations[3][0]);
    });
  });

  it("zeroes an allocation that exceeds the available encrypted budget", async function () {
    const orgId = ethers.id("org:capacity");
    const metadataHash = ethers.id("meta:capacity");
    const paymentId = ethers.id("payment:capacity");
    const memoHash = ethers.id("memo:capacity");

    await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
    await payroll
      .connect(admin)
      .depositBudget(orgId, await encryptUint128(adminClient, 5n));

    await payroll.connect(admin).issueConfidentialPayroll(
      orgId,
      employee.address,
      await encryptUint128(adminClient, 8n),
      paymentId,
      memoHash
    );

    const [budgetHandle, committedHandle, availableHandle] =
      await payroll.connect(admin).getAdminBudgetHandles(orgId);
    const employeeAllocations = await payroll
      .connect(employee)
      .getEmployeeAllocations(orgId, employee.address);

    expect(await decryptUint128(adminClient, budgetHandle)).to.equal(5n);
    expect(await decryptUint128(adminClient, committedHandle)).to.equal(0n);
    expect(await decryptUint128(adminClient, availableHandle)).to.equal(5n);
    expect(await decryptUint128(employeeClient, employeeAllocations[3][0])).to.equal(0n);
  });

  it("requires a permit-backed decrypt flow for summary reads", async function () {
    const orgId = ethers.id("org:permit");
    const metadataHash = ethers.id("meta:permit");

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

    expect(
      await adminClient.decryptForView(budgetHandle, FheTypes.Uint128).withPermit(explicitPermit).execute()
    ).to.equal(14n);
  });

  it("enforces vesting before claim and prevents double claim", async function () {
    const orgId = ethers.id("org:vesting");
    const metadataHash = ethers.id("meta:vesting");
    const paymentId = ethers.id("payment:vesting");
    const memoHash = ethers.id("memo:vesting");
    const latestBlock = await time.latest();
    const vestingStart = latestBlock + 10;
    const vestingEnd = vestingStart + 100;

    await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
    await payroll
      .connect(admin)
      .depositBudget(orgId, await encryptUint128(adminClient, 12n));

    await payroll.connect(admin).issueVestingAllocation(
      orgId,
      employee.address,
      await encryptUint128(adminClient, 4n),
      paymentId,
      memoHash,
      vestingStart,
      vestingEnd
    );

    await expect(payroll.connect(employee).claimPayroll(orgId, paymentId)).to.be.revertedWith(
      "CipherRoll: vesting active"
    );

    await time.increaseTo(vestingEnd);

    await expect(payroll.connect(employee).claimPayroll(orgId, paymentId))
      .to.emit(payroll, "PayrollClaimed")
      .withArgs(orgId, paymentId, employee.address);

    expect(await payroll.isPayrollClaimed(paymentId)).to.equal(true);

    await expect(payroll.connect(employee).claimPayroll(orgId, paymentId)).to.be.revertedWith(
      "CipherRoll: already claimed"
    );
  });

  it("stores public vesting metadata while keeping the amount encrypted", async function () {
    const orgId = ethers.id("org:vesting-meta");
    const metadataHash = ethers.id("meta:vesting-meta");
    const paymentId = ethers.id("payment:vesting-meta");
    const memoHash = ethers.id("memo:vesting-meta");
    const latestBlock = await time.latest();
    const vestingStart = latestBlock + 15;
    const vestingEnd = vestingStart + 50;

    await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
    await payroll
      .connect(admin)
      .depositBudget(orgId, await encryptUint128(adminClient, 20n));

    await payroll.connect(admin).issueVestingAllocation(
      orgId,
      employee.address,
      await encryptUint128(adminClient, 6n),
      paymentId,
      memoHash,
      vestingStart,
      vestingEnd
    );

    const meta = await payroll.connect(employee).getPayrollAllocationMeta(paymentId);
    const employeeAllocations = await payroll
      .connect(employee)
      .getEmployeeAllocations(orgId, employee.address);

    expect(meta.employee).to.equal(employee.address);
    expect(meta.paymentId).to.equal(paymentId);
    expect(meta.memoHash).to.equal(memoHash);
    expect(meta.isVesting).to.equal(true);
    expect(Number(meta.vestingStart)).to.equal(vestingStart);
    expect(Number(meta.vestingEnd)).to.equal(vestingEnd);
    expect(await decryptUint128WithExplicitPermit(employeeClient, employeeAllocations[3][0])).to.equal(6n);
  });

  it("tracks aggregate organization insights without exposing employee salary rows", async function () {
    const orgId = ethers.id("org:insights");
    const metadataHash = ethers.id("meta:insights");
    const firstPaymentId = ethers.id("payment:insights:1");
    const secondPaymentId = ethers.id("payment:insights:2");
    const latestBlock = await time.latest();

    await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
    await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, 25n));

    await payroll.connect(admin).issueConfidentialPayroll(
      orgId,
      employee.address,
      await encryptUint128(adminClient, 5n),
      firstPaymentId,
      ethers.id("memo:insights:1")
    );

    await payroll.connect(admin).issueVestingAllocation(
      orgId,
      outsider.address,
      await encryptUint128(adminClient, 4n),
      secondPaymentId,
      ethers.id("memo:insights:2"),
      latestBlock + 10,
      latestBlock + 30
    );

    await payroll.connect(employee).claimPayroll(orgId, firstPaymentId);

    const insights = await payroll.connect(admin).getOrganizationInsights(orgId);

    expect(Number(insights.totalPayrollItems)).to.equal(2);
    expect(Number(insights.activePayrollItems)).to.equal(1);
    expect(Number(insights.claimedPayrollItems)).to.equal(1);
    expect(Number(insights.vestingPayrollItems)).to.equal(1);
    expect(Number(insights.employeeRecipients)).to.equal(2);
    expect(Number(insights.lastIssuedAt)).to.be.greaterThan(0);
    expect(Number(insights.lastClaimedAt)).to.be.greaterThan(0);

    await expect(payroll.connect(employee).getOrganizationInsights(orgId)).to.be.revertedWith(
      "CipherRoll: not admin"
    );
  });

  it("exposes auditor-safe aggregate summaries and shared-permit decryptable handles", async function () {
    const orgId = ethers.id("org:auditor-summary");
    const metadataHash = ethers.id("meta:auditor-summary");
    const draftRunId = ethers.id("run:auditor:draft");
    const fundedRunId = ethers.id("run:auditor:funded");
    const finalizedRunId = ethers.id("run:auditor:finalized");
    const fundedPaymentId = ethers.id("payment:auditor:funded");
    const finalizedPaymentId = ethers.id("payment:auditor:finalized");
    const latestBlock = await time.latest();

    await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
    await payroll.connect(admin).configureTreasury(
      orgId,
      await settlementAdapter.getAddress(),
      ethers.id("route:auditor-summary")
    );
    await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, 20n));

    await payroll.connect(admin).createPayrollRun(
      orgId,
      draftRunId,
      ethers.id("asset:auditor:draft"),
      latestBlock + 1000,
      1
    );
    await payroll.connect(admin).createPayrollRun(
      orgId,
      fundedRunId,
      ethers.id("asset:auditor:funded"),
      latestBlock + 1100,
      1
    );
    await payroll.connect(admin).createPayrollRun(
      orgId,
      finalizedRunId,
      ethers.id("asset:auditor:finalized"),
      latestBlock + 1200,
      1
    );

    await payroll.connect(admin).issueConfidentialPayrollToRun(
      orgId,
      fundedRunId,
      outsider.address,
      await encryptUint128(adminClient, 5n),
      fundedPaymentId,
      ethers.id("memo:auditor:funded")
    );
    await payroll.connect(admin).issueConfidentialPayrollToRun(
      orgId,
      finalizedRunId,
      employee.address,
      await encryptUint128(adminClient, 4n),
      finalizedPaymentId,
      ethers.id("memo:auditor:finalized")
    );

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

    await payroll.connect(employee).claimPayrollWithSettlement(
      orgId,
      finalizedPaymentId,
      settlementProof.decryptedValue,
      settlementProof.signature
    );

    const auditorSummary = await auditorDisclosure.connect(outsider).getAuditorOrganizationSummary(orgId);

    expect(auditorSummary.treasuryRouteConfigured).to.equal(true);
    expect(auditorSummary.supportsConfidentialSettlement).to.equal(false);
    expect(auditorSummary.settlementAsset).to.equal(await settlementToken.getAddress());
    expect(auditorSummary.confidentialSettlementAsset).to.equal(ethers.ZeroAddress);
    expect(auditorSummary.availableTreasuryFunds).to.equal(0n);
    expect(auditorSummary.reservedTreasuryFunds).to.equal(5n);
    expect(Number(auditorSummary.totalPayrollRuns)).to.equal(3);
    expect(Number(auditorSummary.draftPayrollRuns)).to.equal(1);
    expect(Number(auditorSummary.fundedPayrollRuns)).to.equal(1);
    expect(Number(auditorSummary.activePayrollRuns)).to.equal(0);
    expect(Number(auditorSummary.finalizedPayrollRuns)).to.equal(1);
    expect(Number(auditorSummary.totalPayrollItems)).to.equal(2);
    expect(Number(auditorSummary.activePayrollItems)).to.equal(1);
    expect(Number(auditorSummary.claimedPayrollItems)).to.equal(1);
    expect(Number(auditorSummary.vestingPayrollItems)).to.equal(0);
    expect(Number(auditorSummary.employeeRecipients)).to.equal(2);
    expect(Number(auditorSummary.lastIssuedAt)).to.be.greaterThan(0);
    expect(Number(auditorSummary.lastClaimedAt)).to.be.greaterThan(0);

    const [budgetHandle, committedHandle, availableHandle] =
      await auditorDisclosure.connect(outsider).getAuditorEncryptedSummaryHandles(orgId);

    await expectDecryptFailure(async () => {
      await decryptUint128WithExplicitPermit(outsiderClient, budgetHandle);
    });

    const sharingPermit = await adminClient.permits.createSharing({
      name: "Auditor aggregate summary",
      issuer: admin.address,
      recipient: outsider.address
    });
    const recipientPermit = await outsiderClient.permits.importShared(PermitUtils.export(sharingPermit));

    expect(
      await outsiderClient.decryptForView(budgetHandle, FheTypes.Uint128).withPermit(recipientPermit).execute()
    ).to.equal(20n);
    expect(
      await outsiderClient.decryptForView(committedHandle, FheTypes.Uint128).withPermit(recipientPermit).execute()
    ).to.equal(9n);
    expect(
      await outsiderClient.decryptForView(availableHandle, FheTypes.Uint128).withPermit(recipientPermit).execute()
    ).to.equal(11n);

    await expect(payroll.connect(outsider).getAdminBudgetHandles(orgId)).to.be.revertedWith(
      "CipherRoll: not admin"
    );
    await expect(payroll.connect(outsider).getOrganizationInsights(orgId)).to.be.revertedWith(
      "CipherRoll: not admin"
    );
  });

  it("promotes shared auditor aggregates from viewable to provable with verify and publish receipts", async function () {
    const orgId = ethers.id("org:auditor-evidence");
    const metadataHash = ethers.id("meta:auditor-evidence");

    await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
    await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, 30n));
    await payroll.connect(admin).issueConfidentialPayroll(
      orgId,
      employee.address,
      await encryptUint128(adminClient, 12n),
      ethers.id("payment:auditor-evidence"),
      ethers.id("memo:auditor-evidence")
    );

    const sharingPermit = await adminClient.permits.createSharing({
      name: "Auditor provable evidence",
      issuer: admin.address,
      recipient: outsider.address
    });
    const recipientPermit = await outsiderClient.permits.importShared(PermitUtils.export(sharingPermit));

    const budgetHandle = await auditorDisclosure.getAuditorAggregateHandle(orgId, 0);
    const availableHandle = await auditorDisclosure.getAuditorAggregateHandle(orgId, 2);

    const budgetProof = await outsiderClient
      .decryptForTx(budgetHandle)
      .withPermit(recipientPermit)
      .execute();

    await expect(
      auditorDisclosure.connect(outsider).verifyAuditorAggregateDisclosure(
        orgId,
        0,
        budgetProof.decryptedValue,
        budgetProof.signature
      )
    )
      .to.emit(auditorDisclosure, "AuditorAggregateDisclosureRecorded")
      .withArgs(orgId, 0, outsider.address, 30n, false);

    await expect(
      auditorDisclosure.connect(outsider).verifyAuditorAggregateDisclosure(
        orgId,
        0,
        budgetProof.decryptedValue + 1n,
        budgetProof.signature
      )
    ).to.be.reverted;

    const availableProof = await outsiderClient
      .decryptForTx(availableHandle)
      .withPermit(recipientPermit)
      .execute();

    await expect(
      auditorDisclosure.connect(outsider).publishAuditorAggregateDisclosure(
        orgId,
        2,
        availableProof.decryptedValue,
        availableProof.signature
      )
    )
      .to.emit(auditorDisclosure, "AuditorAggregateDisclosureRecorded")
      .withArgs(orgId, 2, outsider.address, 18n, true);
  });

  it("supports batched auditor evidence receipts without exposing employee-level state", async function () {
    const orgId = ethers.id("org:auditor-batch");
    const metadataHash = ethers.id("meta:auditor-batch");

    await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
    await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, 40n));
    await payroll.connect(admin).issueConfidentialPayroll(
      orgId,
      employee.address,
      await encryptUint128(adminClient, 14n),
      ethers.id("payment:auditor-batch"),
      ethers.id("memo:auditor-batch")
    );

    const sharingPermit = await adminClient.permits.createSharing({
      name: "Auditor batch evidence",
      issuer: admin.address,
      recipient: outsider.address
    });
    const recipientPermit = await outsiderClient.permits.importShared(PermitUtils.export(sharingPermit));

    const metrics = [0, 1, 2] as const;
    const handles = await Promise.all(
      metrics.map((metric) => auditorDisclosure.getAuditorAggregateHandle(orgId, metric))
    );
    const decryptResults = await Promise.all(
      handles.map((handle) =>
        outsiderClient.decryptForTx(handle).withPermit(recipientPermit).execute()
      )
    );

    await expect(
      auditorDisclosure.connect(outsider).verifyAuditorAggregateDisclosureBatch(
        orgId,
        [...metrics],
        decryptResults.map((result) => result.decryptedValue),
        decryptResults.map((result) => result.signature)
      )
    )
      .to.emit(auditorDisclosure, "AuditorAggregateDisclosureBatchRecorded")
      .withArgs(
        orgId,
        outsider.address,
        ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint8[]", "uint128[]", "bytes32[]"],
            [[...metrics], [40n, 14n, 26n], handles]
          )
        ),
        false
      );

    await expect(
      auditorDisclosure.connect(outsider).publishAuditorAggregateDisclosureBatch(
        orgId,
        [...metrics],
        decryptResults.map((result) => result.decryptedValue),
        decryptResults.map((result) => result.signature)
      )
    )
      .to.emit(auditorDisclosure, "AuditorAggregateDisclosureBatchRecorded")
      .withArgs(
        orgId,
        outsider.address,
        ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint8[]", "uint128[]", "bytes32[]"],
            [[...metrics], [40n, 14n, 26n], handles]
          )
        ),
        true
      );

    await expect(
      auditorDisclosure.connect(outsider).verifyAuditorAggregateDisclosureBatch(
        orgId,
        [0, 1],
        [decryptResults[0].decryptedValue],
        [decryptResults[0].signature, decryptResults[1].signature]
      )
    ).to.be.revertedWith("CR: batch length");
  });

  it("models explicit payroll runs with funding, activation, and finalization gates", async function () {
    const orgId = ethers.id("org:run-lifecycle");
    const metadataHash = ethers.id("meta:run-lifecycle");
    const payrollRunId = ethers.id("run:lifecycle");
    const paymentId = ethers.id("payment:lifecycle");
    const memoHash = ethers.id("memo:lifecycle");
    const latestBlock = await time.latest();

    await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
    await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, 20n));
    await payroll.connect(admin).createPayrollRun(
      orgId,
      payrollRunId,
      ethers.id("asset:test-payroll"),
      latestBlock + 1000,
      1
    );

    await payroll.connect(admin).issueConfidentialPayrollToRun(
      orgId,
      payrollRunId,
      employee.address,
      await encryptUint128(adminClient, 6n),
      paymentId,
      memoHash
    );

    await expect(payroll.connect(employee).claimPayroll(orgId, paymentId)).to.be.revertedWith(
      "CipherRoll: payroll run not active"
    );

    await expect(payroll.connect(admin).activatePayrollRun(orgId, payrollRunId)).to.be.revertedWith(
      "CipherRoll: payroll run not funded"
    );

    await payroll.connect(admin).fundPayrollRun(
      orgId,
      payrollRunId,
      await encryptUint128(adminClient, 6n)
    );

    let payrollRun = await payroll.connect(admin).getPayrollRun(payrollRunId);
    expect(Number(payrollRun.status)).to.equal(1);
    expect(Number(payrollRun.allocationCount)).to.equal(1);
    expect(Number(payrollRun.claimedCount)).to.equal(0);

    await payroll.connect(admin).activatePayrollRun(orgId, payrollRunId);
    payrollRun = await payroll.connect(admin).getPayrollRun(payrollRunId);
    expect(Number(payrollRun.status)).to.equal(2);

    expect(await payroll.getPayrollRunForPayment(paymentId)).to.equal(payrollRunId);

    await payroll.connect(employee).claimPayroll(orgId, paymentId);

    payrollRun = await payroll.connect(admin).getPayrollRun(payrollRunId);
    expect(Number(payrollRun.status)).to.equal(3);
    expect(Number(payrollRun.claimedCount)).to.equal(1);
    expect(Number(payrollRun.finalizedAt)).to.be.greaterThan(0);
  });

  it("settles a claimed payroll allocation into a real token balance when treasury settlement is configured", async function () {
    const orgId = ethers.id("org:settlement");
    const metadataHash = ethers.id("meta:settlement");
    const payrollRunId = ethers.id("run:settlement");
    const paymentId = ethers.id("payment:settlement");
    const memoHash = ethers.id("memo:settlement");
    const latestBlock = await time.latest();
    const settlementAmount = 8n * 10n ** 18n;

    await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
    await payroll.connect(admin).configureTreasury(
      orgId,
      await settlementAdapter.getAddress(),
      ethers.id("route:settlement")
    );
    await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, settlementAmount));
    await payroll.connect(admin).createPayrollRun(
      orgId,
      payrollRunId,
      ethers.id("asset:cpusd"),
      latestBlock + 1000,
      1
    );

    await payroll.connect(admin).issueConfidentialPayrollToRun(
      orgId,
      payrollRunId,
      employee.address,
      await encryptUint128(adminClient, settlementAmount),
      paymentId,
      memoHash
    );

    await settlementToken.connect(admin).approve(await settlementAdapter.getAddress(), settlementAmount);
    await settlementAdapter.connect(admin).depositPayrollFunds(orgId, settlementAmount);

    await payroll.connect(admin).fundPayrollRunFromTreasury(
      orgId,
      payrollRunId,
      settlementAmount
    );
    await payroll.connect(admin).activatePayrollRun(orgId, payrollRunId);

    const employeeAllocations = await payroll
      .connect(employee)
      .getEmployeeAllocations(orgId, employee.address);
    const decryptResult = await employeeClient
      .decryptForTx(employeeAllocations[3][0])
      .withPermit(await employeeClient.permits.getOrCreateSelfPermit())
      .execute();

    const startingBalance = await settlementToken.balanceOf(employee.address);

    await expect(
      payroll.connect(employee).claimPayrollWithSettlement(
        orgId,
        paymentId,
        decryptResult.decryptedValue,
        decryptResult.signature
      )
    )
      .to.emit(payroll, "PayrollSettled")
      .withArgs(orgId, paymentId, employee.address, await settlementToken.getAddress(), settlementAmount);

    expect(await payroll.isPayrollClaimed(paymentId)).to.equal(true);
    expect(await settlementToken.balanceOf(employee.address)).to.equal(startingBalance + settlementAmount);
    expect(await settlementAdapter.availablePayrollFunds(orgId)).to.equal(0n);
    expect(await settlementAdapter.reservedPayrollFunds(orgId)).to.equal(0n);
  });

  it("uses the official FHERC20 wrapper path for request and finalize payroll settlement", async function () {
    const orgId = ethers.id("org:fherc20-settlement");
    const metadataHash = ethers.id("meta:fherc20-settlement");
    const payrollRunId = ethers.id("run:fherc20-settlement");
    const paymentId = ethers.id("payment:fherc20-settlement");
    const memoHash = ethers.id("memo:fherc20-settlement");
    const latestBlock = await time.latest();
    const settlementAmount = 9n * 10n ** 18n;

    await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
    await payroll.connect(admin).configureTreasury(
      orgId,
      await confidentialSettlementAdapter.getAddress(),
      ethers.id("route:fherc20-settlement")
    );
    await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, settlementAmount));
    await payroll.connect(admin).createPayrollRun(
      orgId,
      payrollRunId,
      ethers.id("asset:ccpusd"),
      latestBlock + 1000,
      1
    );

    await payroll.connect(admin).issueConfidentialPayrollToRun(
      orgId,
      payrollRunId,
      employee.address,
      await encryptUint128(adminClient, settlementAmount),
      paymentId,
      memoHash
    );

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

    await expect(
      payroll.connect(employee).requestPayrollSettlement(
        orgId,
        paymentId,
        allocationDecryptResult.decryptedValue,
        allocationDecryptResult.signature
      )
    )
      .to.emit(payroll, "PayrollSettlementRequested");

    const settlementRequest = await payroll.connect(employee).getPayrollSettlementRequest(paymentId);
    expect(settlementRequest.exists).to.equal(true);
    expect(settlementRequest.payoutAsset).to.equal(await settlementToken.getAddress());
    expect(settlementRequest.confidentialAsset).to.equal(await confidentialSettlementToken.getAddress());

    const requestDecryptResult = await employeeClient
      .decryptForTx(settlementRequest.requestId)
      .withoutPermit()
      .execute();

    const startingBalance = await settlementToken.balanceOf(employee.address);

    await expect(
      payroll.connect(employee).finalizePayrollSettlement(
        orgId,
        paymentId,
        requestDecryptResult.decryptedValue,
        requestDecryptResult.signature
      )
    )
      .to.emit(payroll, "PayrollSettled")
      .withArgs(orgId, paymentId, employee.address, await settlementToken.getAddress(), settlementAmount);

    expect(await payroll.isPayrollClaimed(paymentId)).to.equal(true);
    expect(await settlementToken.balanceOf(employee.address)).to.equal(startingBalance + settlementAmount);
    expect((await payroll.connect(employee).getPayrollSettlementRequest(paymentId)).exists).to.equal(false);
    expect(await confidentialSettlementAdapter.availablePayrollFunds(orgId)).to.equal(0n);
    expect(await confidentialSettlementAdapter.reservedPayrollFunds(orgId)).to.equal(0n);
  });

  it("supports fractional wrapper payroll amounts with standard token decimals", async function () {
    const orgId = ethers.id("org:fherc20-fractional-settlement");
    const metadataHash = ethers.id("meta:fherc20-fractional-settlement");
    const payrollRunId = ethers.id("run:fherc20-fractional-settlement");
    const paymentId = ethers.id("payment:fherc20-fractional-settlement");
    const memoHash = ethers.id("memo:fherc20-fractional-settlement");
    const latestBlock = await time.latest();
    const settlementAmount = ethers.parseEther("3.5");

    await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
    await payroll.connect(admin).configureTreasury(
      orgId,
      await confidentialSettlementAdapter.getAddress(),
      ethers.id("route:fherc20-fractional-settlement")
    );
    await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, settlementAmount));
    await payroll.connect(admin).createPayrollRun(
      orgId,
      payrollRunId,
      ethers.id("asset:ccpusd-fractional"),
      latestBlock + 1000,
      1
    );

    await payroll.connect(admin).issueConfidentialPayrollToRun(
      orgId,
      payrollRunId,
      employee.address,
      await encryptUint128(adminClient, settlementAmount),
      paymentId,
      memoHash
    );

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

    await payroll.connect(employee).requestPayrollSettlement(
      orgId,
      paymentId,
      allocationDecryptResult.decryptedValue,
      allocationDecryptResult.signature
    );

    const settlementRequest = await payroll.connect(employee).getPayrollSettlementRequest(paymentId);
    const requestDecryptResult = await employeeClient
      .decryptForTx(settlementRequest.requestId)
      .withoutPermit()
      .execute();

    const startingBalance = await settlementToken.balanceOf(employee.address);

    await payroll.connect(employee).finalizePayrollSettlement(
      orgId,
      paymentId,
      requestDecryptResult.decryptedValue,
      requestDecryptResult.signature
    );

    expect(await payroll.isPayrollClaimed(paymentId)).to.equal(true);
    expect(await settlementToken.balanceOf(employee.address)).to.equal(startingBalance + settlementAmount);
    expect((await payroll.connect(employee).getPayrollSettlementRequest(paymentId)).exists).to.equal(false);
  });

  it("rejects wrapper finalize payloads with the wrong plaintext for the unshield request", async function () {
    const orgId = ethers.id("org:fherc20-wrong-plaintext");
    const metadataHash = ethers.id("meta:fherc20-wrong-plaintext");
    const payrollRunId = ethers.id("run:fherc20-wrong-plaintext");
    const paymentId = ethers.id("payment:fherc20-wrong-plaintext");
    const memoHash = ethers.id("memo:fherc20-wrong-plaintext");
    const latestBlock = await time.latest();
    const settlementAmount = 9n * 10n ** 18n;

    await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
    await payroll.connect(admin).configureTreasury(
      orgId,
      await confidentialSettlementAdapter.getAddress(),
      ethers.id("route:fherc20-wrong-plaintext")
    );
    await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, settlementAmount));
    await payroll.connect(admin).createPayrollRun(
      orgId,
      payrollRunId,
      ethers.id("asset:ccpusd-wrong-plaintext"),
      latestBlock + 1000,
      1
    );

    await payroll.connect(admin).issueConfidentialPayrollToRun(
      orgId,
      payrollRunId,
      employee.address,
      await encryptUint128(adminClient, settlementAmount),
      paymentId,
      memoHash
    );

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

    await payroll.connect(employee).requestPayrollSettlement(
      orgId,
      paymentId,
      allocationDecryptResult.decryptedValue,
      allocationDecryptResult.signature
    );

    const settlementRequest = await payroll.connect(employee).getPayrollSettlementRequest(paymentId);
    const requestDecryptResult = await employeeClient
      .decryptForTx(settlementRequest.requestId)
      .withoutPermit()
      .execute();

    await expect(
      payroll.connect(employee).finalizePayrollSettlement(
        orgId,
        paymentId,
        requestDecryptResult.decryptedValue + 1n,
        requestDecryptResult.signature
      )
    ).to.be.revertedWith("CipherRoll: invalid wrapper settlement proof");

    expect(await payroll.isPayrollClaimed(paymentId)).to.equal(false);
    expect((await payroll.connect(employee).getPayrollSettlementRequest(paymentId)).exists).to.equal(true);
  });

  it("rejects wrapper finalize payloads whose decrypt proof belongs to a different unshield request", async function () {
    const orgId = ethers.id("org:fherc20-mismatched-request");
    const metadataHash = ethers.id("meta:fherc20-mismatched-request");
    const payrollRunId = ethers.id("run:fherc20-mismatched-request");
    const firstPaymentId = ethers.id("payment:fherc20-mismatched-request:1");
    const secondPaymentId = ethers.id("payment:fherc20-mismatched-request:2");
    const latestBlock = await time.latest();
    const firstSettlementAmount = 4n * 10n ** 18n;
    const secondSettlementAmount = 5n * 10n ** 18n;
    const totalFunding = firstSettlementAmount + secondSettlementAmount;

    await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
    await payroll.connect(admin).configureTreasury(
      orgId,
      await confidentialSettlementAdapter.getAddress(),
      ethers.id("route:fherc20-mismatched-request")
    );
    await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, totalFunding));
    await payroll.connect(admin).createPayrollRun(
      orgId,
      payrollRunId,
      ethers.id("asset:ccpusd-mismatched-request"),
      latestBlock + 1000,
      2
    );

    await payroll.connect(admin).issueConfidentialPayrollToRun(
      orgId,
      payrollRunId,
      employee.address,
      await encryptUint128(adminClient, firstSettlementAmount),
      firstPaymentId,
      ethers.id("memo:fherc20-mismatched-request:1")
    );
    await payroll.connect(admin).issueConfidentialPayrollToRun(
      orgId,
      payrollRunId,
      employee.address,
      await encryptUint128(adminClient, secondSettlementAmount),
      secondPaymentId,
      ethers.id("memo:fherc20-mismatched-request:2")
    );

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

    await payroll.connect(employee).requestPayrollSettlement(
      orgId,
      firstPaymentId,
      firstAllocationDecryptResult.decryptedValue,
      firstAllocationDecryptResult.signature
    );
    await payroll.connect(employee).requestPayrollSettlement(
      orgId,
      secondPaymentId,
      secondAllocationDecryptResult.decryptedValue,
      secondAllocationDecryptResult.signature
    );

    const firstSettlementRequest = await payroll.connect(employee).getPayrollSettlementRequest(firstPaymentId);
    const secondSettlementRequest = await payroll.connect(employee).getPayrollSettlementRequest(secondPaymentId);
    expect(firstSettlementRequest.requestId).to.not.equal(secondSettlementRequest.requestId);

    const secondRequestDecryptResult = await employeeClient
      .decryptForTx(secondSettlementRequest.requestId)
      .withoutPermit()
      .execute();

    await expect(
      payroll.connect(employee).finalizePayrollSettlement(
        orgId,
        firstPaymentId,
        secondRequestDecryptResult.decryptedValue,
        secondRequestDecryptResult.signature
      )
    ).to.be.revertedWith("CipherRoll: invalid wrapper settlement proof");

    expect(await payroll.isPayrollClaimed(firstPaymentId)).to.equal(false);
    expect((await payroll.connect(employee).getPayrollSettlementRequest(firstPaymentId)).exists).to.equal(true);
    expect((await payroll.connect(employee).getPayrollSettlementRequest(secondPaymentId)).exists).to.equal(true);
  });

  it("rejects replayed wrapper finalize attempts after a successful claim", async function () {
    const orgId = ethers.id("org:fherc20-replayed-finalize");
    const metadataHash = ethers.id("meta:fherc20-replayed-finalize");
    const payrollRunId = ethers.id("run:fherc20-replayed-finalize");
    const paymentId = ethers.id("payment:fherc20-replayed-finalize");
    const memoHash = ethers.id("memo:fherc20-replayed-finalize");
    const latestBlock = await time.latest();
    const settlementAmount = 9n * 10n ** 18n;

    await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
    await payroll.connect(admin).configureTreasury(
      orgId,
      await confidentialSettlementAdapter.getAddress(),
      ethers.id("route:fherc20-replayed-finalize")
    );
    await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, settlementAmount));
    await payroll.connect(admin).createPayrollRun(
      orgId,
      payrollRunId,
      ethers.id("asset:ccpusd-replayed-finalize"),
      latestBlock + 1000,
      1
    );

    await payroll.connect(admin).issueConfidentialPayrollToRun(
      orgId,
      payrollRunId,
      employee.address,
      await encryptUint128(adminClient, settlementAmount),
      paymentId,
      memoHash
    );

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

    await payroll.connect(employee).requestPayrollSettlement(
      orgId,
      paymentId,
      allocationDecryptResult.decryptedValue,
      allocationDecryptResult.signature
    );

    const settlementRequest = await payroll.connect(employee).getPayrollSettlementRequest(paymentId);
    const requestDecryptResult = await employeeClient
      .decryptForTx(settlementRequest.requestId)
      .withoutPermit()
      .execute();

    await payroll.connect(employee).finalizePayrollSettlement(
      orgId,
      paymentId,
      requestDecryptResult.decryptedValue,
      requestDecryptResult.signature
    );

    await expect(
      payroll.connect(employee).finalizePayrollSettlement(
        orgId,
        paymentId,
        requestDecryptResult.decryptedValue,
        requestDecryptResult.signature
      )
    ).to.be.revertedWith("CipherRoll: already claimed");
  });

  it("rejects wrapper finalize calls when no settlement request is pending", async function () {
    const orgId = ethers.id("org:fherc20-no-pending-request");
    const metadataHash = ethers.id("meta:fherc20-no-pending-request");
    const payrollRunId = ethers.id("run:fherc20-no-pending-request");
    const paymentId = ethers.id("payment:fherc20-no-pending-request");
    const memoHash = ethers.id("memo:fherc20-no-pending-request");
    const latestBlock = await time.latest();
    const settlementAmount = 9n * 10n ** 18n;

    await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
    await payroll.connect(admin).configureTreasury(
      orgId,
      await confidentialSettlementAdapter.getAddress(),
      ethers.id("route:fherc20-no-pending-request")
    );
    await payroll.connect(admin).depositBudget(orgId, await encryptUint128(adminClient, settlementAmount));
    await payroll.connect(admin).createPayrollRun(
      orgId,
      payrollRunId,
      ethers.id("asset:ccpusd-no-pending-request"),
      latestBlock + 1000,
      1
    );

    await payroll.connect(admin).issueConfidentialPayrollToRun(
      orgId,
      payrollRunId,
      employee.address,
      await encryptUint128(adminClient, settlementAmount),
      paymentId,
      memoHash
    );

    await settlementToken.connect(admin).approve(await confidentialSettlementAdapter.getAddress(), settlementAmount);
    await confidentialSettlementAdapter.connect(admin).depositPayrollFunds(orgId, settlementAmount);

    await payroll.connect(admin).fundPayrollRunFromTreasury(orgId, payrollRunId, settlementAmount);
    await payroll.connect(admin).activatePayrollRun(orgId, payrollRunId);

    await expect(
      payroll.connect(employee).finalizePayrollSettlement(
        orgId,
        paymentId,
        1n,
        "0x"
      )
    ).to.be.revertedWith("CipherRoll: settlement request missing");
  });

  it("rejects invalid admin actions and malformed issuance requests", async function () {
    const orgId = ethers.id("org:invalid-actions");
    const metadataHash = ethers.id("meta:invalid-actions");
    const paymentId = ethers.id("payment:invalid-actions");
    const memoHash = ethers.id("memo:invalid-actions");

    await expect(
      payroll.connect(admin).createOrganization(orgId, metadataHash, 0, 1)
    ).to.be.revertedWith("CipherRoll: admin slots required");
    await expect(
      payroll.connect(admin).createOrganization(orgId, metadataHash, 1, 2)
    ).to.be.revertedWith("CipherRoll: invalid quorum");

    await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);

    await expect(
      payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2)
    ).to.be.revertedWith("CipherRoll: org exists");

    await expect(
      payroll.connect(outsider).depositBudget(orgId, await encryptUint128(outsiderClient, 4n))
    ).to.be.revertedWith("CipherRoll: not admin");

    await expect(
      payroll.connect(admin).configureTreasury(orgId, ethers.ZeroAddress, ethers.id("route:invalid"))
    ).to.be.revertedWith("CipherRoll: adapter required");

    await expect(
      payroll.connect(admin).issueConfidentialPayroll(
        orgId,
        ethers.ZeroAddress,
        await encryptUint128(adminClient, 1n),
        paymentId,
        memoHash
      )
    ).to.be.revertedWith("CipherRoll: employee required");

    await expect(
      payroll.connect(admin).issueVestingAllocation(
        orgId,
        employee.address,
        await encryptUint128(adminClient, 1n),
        paymentId,
        memoHash,
        10,
        10
      )
    ).to.be.revertedWith("CipherRoll: invalid vesting");

    const payrollRunId = ethers.id("run:invalid-actions");
    const latestBlock = await time.latest();

    await expect(
      payroll.connect(admin).createPayrollRun(orgId, payrollRunId, ethers.id("asset"), latestBlock - 1, 1)
    ).to.be.revertedWith("CipherRoll: funding deadline required");

    await expect(
      payroll.connect(admin).createPayrollRun(orgId, payrollRunId, ethers.id("asset"), latestBlock + 100, 0)
    ).to.be.revertedWith("CipherRoll: headcount required");

    await payroll.connect(admin).createPayrollRun(orgId, payrollRunId, ethers.id("asset"), latestBlock + 100, 1);

    await expect(
      payroll.connect(admin).fundPayrollRun(orgId, payrollRunId, await encryptUint128(adminClient, 1n))
    ).to.be.revertedWith("CipherRoll: payroll run has no allocations");

    await payroll.connect(admin).configureTreasury(
      orgId,
      await settlementAdapter.getAddress(),
      ethers.id("route:treasury")
    );

    await expect(
      payroll.connect(admin).fundPayrollRun(orgId, payrollRunId, await encryptUint128(adminClient, 1n))
    ).to.be.revertedWith("CipherRoll: treasury route requires funded asset");
  });

  it("rejects missing or unauthorized claim attempts and duplicate payment ids", async function () {
    const orgId = ethers.id("org:claim-failures");
    const metadataHash = ethers.id("meta:claim-failures");
    const paymentId = ethers.id("payment:claim-failures");
    const memoHash = ethers.id("memo:claim-failures");

    await payroll.connect(admin).createOrganization(orgId, metadataHash, 3, 2);
    await payroll
      .connect(admin)
      .depositBudget(orgId, await encryptUint128(adminClient, 11n));

    await expect(payroll.connect(employee).claimPayroll(orgId, paymentId)).to.be.revertedWith(
      "CipherRoll: payment missing"
    );

    await payroll.connect(admin).issueConfidentialPayroll(
      orgId,
      employee.address,
      await encryptUint128(adminClient, 3n),
      paymentId,
      memoHash
    );

    await expect(
      payroll.connect(admin).issueConfidentialPayroll(
        orgId,
        employee.address,
        await encryptUint128(adminClient, 2n),
        paymentId,
        ethers.id("memo:claim-failures:duplicate")
      )
    ).to.be.revertedWith("CipherRoll: payment exists");

    await expect(payroll.connect(outsider).claimPayroll(orgId, paymentId)).to.be.revertedWith(
      "CipherRoll: not employee"
    );
  });
});
