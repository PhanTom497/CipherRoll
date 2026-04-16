import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import hre, { ethers } from "hardhat";
import { Encryptable, FheTypes } from "@cofhe/sdk";
import { createCofheClient, createCofheConfig } from "@cofhe/sdk/node";
import { arbSepolia as cofheArbSepolia } from "@cofhe/sdk/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, createWalletClient, http } from "viem";
import { arbitrumSepolia as viemArbitrumSepolia } from "viem/chains";

import type { CipherRollPayroll } from "../typechain-types";

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

async function encryptUint128(value: bigint) {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
  const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC_URL;

  if (!privateKey || !rpcUrl) {
    throw new Error("Missing DEPLOYER_PRIVATE_KEY or ARBITRUM_SEPOLIA_RPC_URL.");
  }

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({
    chain: viemArbitrumSepolia,
    transport: http(rpcUrl)
  });
  const walletClient = createWalletClient({
    account,
    chain: viemArbitrumSepolia,
    transport: http(rpcUrl)
  });

  const client = createCofheClient(
    createCofheConfig({
      supportedChains: [cofheArbSepolia]
    })
  );

  await client.connect(publicClient, walletClient);
  const [encrypted] = await client.encryptInputs([Encryptable.uint128(value)]).execute();

  return { client, encrypted };
}

async function decryptUint128(client: Awaited<ReturnType<typeof encryptUint128>>["client"], handle: string) {
  const permit = await client.permits.getOrCreateSelfPermit();
  return client.decryptForView(handle, FheTypes.Uint128).withPermit(permit).execute();
}

async function expectFailure(label: string, work: () => Promise<unknown>) {
  try {
    await work();
    return { label, ok: false, message: "Expected failure but call succeeded." };
  } catch (error) {
    return { label, ok: true, message: extractErrorMessage(error) };
  }
}

function getLiveGasOverrides() {
  return {
    gasPrice: 50_000_000n
  };
}

async function main() {
  if (hre.network.name !== "arb-sepolia") {
    throw new Error(`This smoke script must run on arb-sepolia, got ${hre.network.name}.`);
  }

  const contractAddress = process.env.NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS is not configured.");
  }

  const [admin] = await ethers.getSigners();
  const payroll = (await ethers.getContractAt(
    "CipherRollPayroll",
    contractAddress,
    admin
  )) as CipherRollPayroll;

  const adminAddress = await admin.getAddress();
  const employeeAddress = ethers.Wallet.createRandom().address;
  const seed = Date.now();
  const orgId = ethers.id(`smoke:org:${seed}`);
  const metadataHash = ethers.id(`smoke:meta:${seed}`);
  const paymentId = ethers.id(`smoke:payment:${seed}`);
  const memoHash = ethers.id(`smoke:memo:${seed}`);
  const budgetAmount = ethers.parseUnits("1.5", 18);
  const payrollAmount = ethers.parseUnits("0.4", 18);

  const { client, encrypted: encryptedBudget } = await encryptUint128(budgetAmount);
  const gasOverrides = getLiveGasOverrides();

  console.log(`Live smoke orgId: ${orgId}`);
  console.log(`Admin: ${adminAddress}`);
  console.log(`Employee test address: ${employeeAddress}`);
  console.log(`Using contract: ${contractAddress}`);

  const createTx = await payroll.createOrganization(orgId, metadataHash, 3, 2, {
    ...gasOverrides,
    gasLimit: 900_000n
  });
  await createTx.wait();
  console.log(`createOrganization tx: ${createTx.hash}`);

  const afterCreate = await payroll.getOrganization(orgId);

  const duplicateOrgFailure = await expectFailure("duplicate org create", async () => {
    await payroll.createOrganization.staticCall(orgId, metadataHash, 3, 2);
  });

  const unknownOrgDepositFailure = await expectFailure("unknown org deposit", async () => {
    const fakeOrgBudget = await client.encryptInputs([Encryptable.uint128(ethers.parseUnits("0.1", 18))]).execute();
    await payroll.depositBudget.staticCall(ethers.id(`missing:${seed}`), fakeOrgBudget[0]);
  });

  const depositTx = await payroll.depositBudget(orgId, encryptedBudget, {
    ...gasOverrides,
    gasLimit: 1_200_000n
  });
  await depositTx.wait();
  console.log(`depositBudget tx: ${depositTx.hash}`);

  const [budgetAfterDepositHandle, committedAfterDepositHandle, availableAfterDepositHandle] =
    await payroll.getAdminBudgetHandles(orgId);

  const budgetAfterDeposit = await decryptUint128(client, budgetAfterDepositHandle);
  const committedAfterDeposit = await decryptUint128(client, committedAfterDepositHandle);
  const availableAfterDeposit = await decryptUint128(client, availableAfterDepositHandle);

  const invalidEmployeeFailure = await expectFailure("invalid employee issuance", async () => {
    const badPayroll = await client.encryptInputs([Encryptable.uint128(ethers.parseUnits("0.2", 18))]).execute();
    await payroll.issueConfidentialPayroll.staticCall(
      orgId,
      ethers.ZeroAddress,
      badPayroll[0],
      ethers.id(`invalid-employee:${seed}`),
      memoHash
    );
  });

  const encryptedPayroll = (await client.encryptInputs([Encryptable.uint128(payrollAmount)]).execute())[0];
  const issueTx = await payroll.issueConfidentialPayroll(
    orgId,
    employeeAddress,
    encryptedPayroll,
    paymentId,
    memoHash,
    {
      ...gasOverrides,
      gasLimit: 1_500_000n
    }
  );
  await issueTx.wait();
  console.log(`issueConfidentialPayroll tx: ${issueTx.hash}`);

  const duplicatePaymentFailure = await expectFailure("duplicate payment id", async () => {
    const dupPayroll = await client.encryptInputs([Encryptable.uint128(ethers.parseUnits("0.1", 18))]).execute();
    await payroll.issueConfidentialPayroll.staticCall(
      orgId,
      employeeAddress,
      dupPayroll[0],
      paymentId,
      ethers.id(`dup:${seed}`)
    );
  });

  const [budgetHandle, committedHandle, availableHandle] = await payroll.getAdminBudgetHandles(orgId);
  const budget = await decryptUint128(client, budgetHandle);
  const committed = await decryptUint128(client, committedHandle);
  const available = await decryptUint128(client, availableHandle);
  const refreshedOrganization = await payroll.getOrganization(orgId);

  const result = {
    network: hre.network.name,
    chainId: (await admin.provider.getNetwork()).chainId.toString(),
    contractAddress,
    adminAddress,
    employeeAddress,
    orgId,
    paymentId,
    transactions: {
      createOrganization: createTx.hash,
      depositBudget: depositTx.hash,
      issuePayroll: issueTx.hash
    },
    gasPriceWei: gasOverrides.gasPrice.toString(),
    refreshChecks: {
      organizationExists: refreshedOrganization.exists,
      organizationAdmin: refreshedOrganization.admin,
      createdAt: Number(afterCreate.createdAt),
      updatedAtAfterIssue: Number(refreshedOrganization.updatedAt)
    },
    decryptedSummaries: {
      afterDeposit: {
        budget: budgetAfterDeposit.toString(),
        committed: committedAfterDeposit.toString(),
        available: availableAfterDeposit.toString()
      },
      afterIssue: {
        budget: budget.toString(),
        committed: committed.toString(),
        available: available.toString()
      }
    },
    expectedFailures: [
      duplicateOrgFailure,
      unknownOrgDepositFailure,
      invalidEmployeeFailure,
      duplicatePaymentFailure
    ]
  };

  mkdirSync(join(process.cwd(), "outputs"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "outputs", "arb-sepolia-live-smoke.json"),
    `${JSON.stringify(result, null, 2)}\n`
  );

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
