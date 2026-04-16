import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Encryptable, FheTypes, type CofheClient } from "@cofhe/sdk";
import { expect } from "chai";
import hre, { ethers } from "hardhat";

import type { CipherRollPayroll } from "../typechain-types";

describe("CipherRollPayroll", function () {
  let payroll: CipherRollPayroll;
  let admin: HardhatEthersSigner;
  let employee: HardhatEthersSigner;
  let outsider: HardhatEthersSigner;
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

    const meta = await payroll.getPayrollAllocationMeta(paymentId);
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
