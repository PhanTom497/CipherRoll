import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import hre, { ethers } from "hardhat";
import { Encryptable } from "@cofhe/sdk";
import { createCofheClient, createCofheConfig } from "@cofhe/sdk/node";
import { arbSepolia as cofheArbSepolia } from "@cofhe/sdk/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, createWalletClient, http } from "viem";
import { arbitrumSepolia as viemArbitrumSepolia } from "viem/chains";

import type {
  CipherRollPayroll,
  MockFHERC20SettlementTreasuryAdapter,
  MockSettlementToken
} from "../typechain-types";

type DeploymentRecord = {
  payroll: string;
  settlementToken: string;
  wrapperSettlementAdapter: string;
  confidentialPayrollToken: string;
};

async function createLiveClient() {
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
  return client;
}

async function main() {
  if (hre.network.name !== "arb-sepolia") {
    throw new Error(`This smoke script must run on arb-sepolia, got ${hre.network.name}.`);
  }

  const deploymentPath = join(process.cwd(), "outputs", "arb-sepolia-deployment.json");
  const deployment = JSON.parse(readFileSync(deploymentPath, "utf8")) as DeploymentRecord;

  const [admin] = await ethers.getSigners();
  const adminAddress = await admin.getAddress();
  const liveClient = await createLiveClient();
  const gasOverrides = { gasPrice: 50_000_000n };

  const payroll = (await ethers.getContractAt(
    "CipherRollPayroll",
    deployment.payroll,
    admin
  )) as CipherRollPayroll;
  const settlementToken = (await ethers.getContractAt(
    "MockSettlementToken",
    deployment.settlementToken,
    admin
  )) as MockSettlementToken;
  const wrapperAdapter = (await ethers.getContractAt(
    "MockFHERC20SettlementTreasuryAdapter",
    deployment.wrapperSettlementAdapter,
    admin
  )) as MockFHERC20SettlementTreasuryAdapter;

  const seed = Date.now();
  const orgId = ethers.id(`smoke:fherc20:org:${seed}`);
  const metadataHash = ethers.id(`smoke:fherc20:meta:${seed}`);
  const payrollRunId = ethers.id(`smoke:fherc20:run:${seed}`);
  const paymentId = ethers.id(`smoke:fherc20:payment:${seed}`);
  const memoHash = ethers.id(`smoke:fherc20:memo:${seed}`);
  const treasuryRouteId = ethers.id(`smoke:fherc20:route:${seed}`);
  const budgetAmount = ethers.parseUnits("3.0", 18);
  // The local FHERC20-style mock wrapper only accepts whole wrapped units at a 1e18 rate.
  const payrollAmount = ethers.parseUnits("1.0", 18);

  const [encryptedBudget] = await liveClient.encryptInputs([Encryptable.uint128(budgetAmount)]).execute();
  const [encryptedPayroll] = await liveClient.encryptInputs([Encryptable.uint128(payrollAmount)]).execute();

  console.log(`Using payroll: ${deployment.payroll}`);
  console.log(`Using settlement token: ${deployment.settlementToken}`);
  console.log(`Using wrapper adapter: ${deployment.wrapperSettlementAdapter}`);
  console.log(`Admin/employee wallet: ${adminAddress}`);
  console.log(`Smoke orgId: ${orgId}`);

  const createOrgTx = await payroll.createOrganization(orgId, metadataHash, 3, 2, {
    ...gasOverrides,
    gasLimit: 900_000n
  });
  await createOrgTx.wait();

  const configureTreasuryTx = await payroll.configureTreasury(
    orgId,
    deployment.wrapperSettlementAdapter,
    treasuryRouteId,
    { ...gasOverrides, gasLimit: 900_000n }
  );
  await configureTreasuryTx.wait();

  const depositBudgetTx = await payroll.depositBudget(orgId, encryptedBudget, {
    ...gasOverrides,
    gasLimit: 1_200_000n
  });
  await depositBudgetTx.wait();

  const latestBlock = await ethers.provider.getBlock("latest");
  const fundingDeadline = BigInt((latestBlock?.timestamp ?? Math.floor(Date.now() / 1000)) + 3600);

  const createRunTx = await payroll.createPayrollRun(
    orgId,
    payrollRunId,
    ethers.id("asset:ccpusd-live"),
    fundingDeadline,
    1,
    { ...gasOverrides, gasLimit: 1_000_000n }
  );
  await createRunTx.wait();

  const issueTx = await payroll.issueConfidentialPayrollToRun(
    orgId,
    payrollRunId,
    adminAddress,
    encryptedPayroll,
    paymentId,
    memoHash,
    { ...gasOverrides, gasLimit: 1_500_000n }
  );
  await issueTx.wait();

  const approveTreasuryTx = await settlementToken.approve(
    deployment.wrapperSettlementAdapter,
    payrollAmount,
    gasOverrides
  );
  await approveTreasuryTx.wait();

  const depositTreasuryTx = await wrapperAdapter.depositPayrollFunds(orgId, payrollAmount, {
    ...gasOverrides,
    gasLimit: 1_200_000n
  });
  await depositTreasuryTx.wait();

  const fundRunTx = await payroll.fundPayrollRunFromTreasury(orgId, payrollRunId, payrollAmount, {
    ...gasOverrides,
    gasLimit: 1_200_000n
  });
  await fundRunTx.wait();

  const activateRunTx = await payroll.activatePayrollRun(orgId, payrollRunId, {
    ...gasOverrides,
    gasLimit: 900_000n
  });
  await activateRunTx.wait();

  const employeeAllocations = await payroll.getEmployeeAllocations(orgId, adminAddress);
  const allocationDecrypt = await liveClient
    .decryptForTx(employeeAllocations[3][0])
    .withPermit(await liveClient.permits.getOrCreateSelfPermit())
    .execute();

  const requestSettlementTx = await payroll.requestPayrollSettlement(
    orgId,
    paymentId,
    allocationDecrypt.decryptedValue,
    allocationDecrypt.signature,
    { ...gasOverrides, gasLimit: 1_400_000n }
  );
  await requestSettlementTx.wait();

  const settlementRequest = await payroll.getPayrollSettlementRequest(paymentId);
  const payoutBalanceBeforeFinalize = await settlementToken.balanceOf(adminAddress);

  const requestDecrypt = await liveClient
    .decryptForTx(settlementRequest.requestId)
    .withoutPermit()
    .execute();

  const finalizeSettlementTx = await payroll.finalizePayrollSettlement(
    orgId,
    paymentId,
    requestDecrypt.decryptedValue,
    requestDecrypt.signature,
    { ...gasOverrides, gasLimit: 1_400_000n }
  );
  await finalizeSettlementTx.wait();

  const payoutBalanceAfterFinalize = await settlementToken.balanceOf(adminAddress);
  const treasuryDetails = await payroll.getTreasuryAdapterDetails(orgId);
  const settlementRequestAfterFinalize = await payroll.getPayrollSettlementRequest(paymentId);
  const runAfterFinalize = await payroll.getPayrollRun(payrollRunId);

  const result = {
    network: hre.network.name,
    chainId: (await admin.provider.getNetwork()).chainId.toString(),
    payroll: deployment.payroll,
    settlementToken: deployment.settlementToken,
    wrapperSettlementAdapter: deployment.wrapperSettlementAdapter,
    confidentialPayrollToken: deployment.confidentialPayrollToken,
    adminAddress,
    orgId,
    payrollRunId,
    paymentId,
    transactions: {
      createOrganization: createOrgTx.hash,
      configureTreasury: configureTreasuryTx.hash,
      depositBudget: depositBudgetTx.hash,
      createPayrollRun: createRunTx.hash,
      issuePayroll: issueTx.hash,
      approveTreasuryInventory: approveTreasuryTx.hash,
      depositTreasuryInventory: depositTreasuryTx.hash,
      fundPayrollRunFromTreasury: fundRunTx.hash,
      activatePayrollRun: activateRunTx.hash,
      requestPayrollSettlement: requestSettlementTx.hash,
      finalizePayrollSettlement: finalizeSettlementTx.hash
    },
    balances: {
      beforeFinalize: payoutBalanceBeforeFinalize.toString(),
      afterFinalize: payoutBalanceAfterFinalize.toString(),
      delta: (payoutBalanceAfterFinalize - payoutBalanceBeforeFinalize).toString()
    },
    treasury: {
      settlementAsset: treasuryDetails[5],
      confidentialSettlementAsset: treasuryDetails[6],
      availablePayrollFunds: treasuryDetails[7].toString(),
      reservedPayrollFunds: treasuryDetails[8].toString()
    },
    settlementRequest: {
      requestId: settlementRequest.requestId,
      payoutAsset: settlementRequest.payoutAsset,
      confidentialAsset: settlementRequest.confidentialAsset,
      requestedAt: Number(settlementRequest.requestedAt),
      existsAfterFinalize: settlementRequestAfterFinalize.exists
    },
    payrollRun: {
      statusAfterFinalize: Number(runAfterFinalize.status),
      claimedCount: Number(runAfterFinalize.claimedCount),
      finalizedAt: Number(runAfterFinalize.finalizedAt)
    }
  };

  mkdirSync(join(process.cwd(), "outputs"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "outputs", "arb-sepolia-wrapper-live-smoke.json"),
    `${JSON.stringify(result, null, 2)}\n`
  );

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
