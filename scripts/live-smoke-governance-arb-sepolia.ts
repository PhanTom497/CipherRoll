import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import hre, { ethers } from "hardhat";
import { Encryptable, FheTypes } from "@cofhe/sdk";
import { createCofheClient, createCofheConfig } from "@cofhe/sdk/node";
import { arbSepolia as cofheArbSepolia } from "@cofhe/sdk/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, createWalletClient, http } from "viem";
import { arbitrumSepolia as viemArbitrumSepolia } from "viem/chains";

import type {
  CipherRollGovernance,
  CipherRollPayroll
} from "../typechain-types";

type DeploymentRecord = {
  payroll: string;
  governance: string;
  directSettlementAdapter: string;
};

const GovernanceActionType = {
  ConfigureTreasury: 0,
  CreatePayrollRun: 1,
  FundPayrollRun: 2,
  FundPayrollRunFromTreasury: 3,
  ActivatePayrollRun: 4,
  IssueConfidentialPayroll: 5,
  IssueConfidentialPayrollToRun: 6,
  IssueVestingAllocation: 7,
  IssueVestingAllocationToRun: 8,
  AddAdmin: 9,
  RemoveAdmin: 10,
  UpdateQuorum: 11
} as const;

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
  const secondAdmin = ethers.Wallet.createRandom().connect(admin.provider);
  const secondAdminAddress = await secondAdmin.getAddress();
  const liveClient = await createLiveClient();
  const gasOverrides = { gasPrice: 50_000_000n };
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  const payroll = (await ethers.getContractAt(
    "CipherRollPayroll",
    deployment.payroll,
    admin
  )) as CipherRollPayroll;

  const governance = (await ethers.getContractAt(
    "CipherRollGovernance",
    deployment.governance,
    admin
  )) as CipherRollGovernance;

  const seed = Date.now();
  const orgId = ethers.id(`smoke:governance:org:${seed}`);
  const metadataHash = ethers.id(`smoke:governance:meta:${seed}`);
  const payrollRunId = ethers.id(`smoke:governance:run:${seed}`);
  const settlementAssetId = ethers.id(`smoke:governance:asset:${seed}`);
  const paymentId = ethers.id(`smoke:governance:payment:${seed}`);
  const memoHash = ethers.id(`smoke:governance:memo:${seed}`);
  const treasuryRouteId = ethers.id(`smoke:governance:route:${seed}`);
  const payrollAmount = ethers.parseUnits("0.25", 18);
  const governanceExpiry = BigInt(Math.floor(Date.now() / 1000) + 3600);

  console.log(`Using payroll: ${deployment.payroll}`);
  console.log(`Using governance: ${deployment.governance}`);
  console.log(`Admin wallet: ${adminAddress}`);
  console.log(`Bootstrap signer wallet: ${secondAdminAddress}`);
  console.log(`Governance smoke orgId: ${orgId}`);

  const fundBootstrapSignerTx = await admin.sendTransaction({
    to: secondAdminAddress,
    value: ethers.parseEther("0.005"),
    ...gasOverrides
  });
  await fundBootstrapSignerTx.wait();

  const createOrgTx = await payroll.createOrganization(orgId, metadataHash, 3, 2, {
    ...gasOverrides,
    gasLimit: 900_000n
  });
  await createOrgTx.wait();

  const bootstrapTx = await governance.bootstrapOrganization(orgId, {
    ...gasOverrides,
    gasLimit: 900_000n
  });
  await bootstrapTx.wait();

  const bootstrapSignerTx = await governance.bootstrapOrganizationAdmin(
    orgId,
    secondAdminAddress,
    {
      ...gasOverrides,
      gasLimit: 900_000n
    }
  );
  await bootstrapSignerTx.wait();

  const linkExecutorTx = await payroll.configureOrganizationGovernanceExecutor(
    orgId,
    deployment.governance,
    {
      ...gasOverrides,
      gasLimit: 900_000n
    }
  );
  await linkExecutorTx.wait();

  const governanceState = await governance.getOrganizationGovernance(orgId);
  const linkedExecutor = await payroll.getOrganizationGovernanceExecutor(orgId);
  const governanceActive = await governance.isGovernanceActive(orgId);
  const connectedAdminIsRecognized = await governance.isOrganizationAdmin(orgId, adminAddress);
  const bootstrapAdminIsRecognized = await governance.isOrganizationAdmin(orgId, secondAdminAddress);
  const governanceFromBootstrapSigner = governance.connect(secondAdmin);

  const configureTreasuryPayload = abiCoder.encode(
    ["address", "bytes32"],
    [deployment.directSettlementAdapter, treasuryRouteId]
  );
  const configureTreasuryProposalPreview = await governance.proposeGovernanceAction.staticCall(
    orgId,
    GovernanceActionType.ConfigureTreasury,
    configureTreasuryPayload,
    governanceExpiry
  );
  const configureTreasuryProposalTx = await governance.proposeGovernanceAction(
    orgId,
    GovernanceActionType.ConfigureTreasury,
    configureTreasuryPayload,
    governanceExpiry,
    { ...gasOverrides, gasLimit: 1_200_000n }
  );
  await configureTreasuryProposalTx.wait();

  const configureTreasuryProposalIds = await governance.getOrganizationGovernanceProposalIds(orgId);
  const configureTreasuryProposalId = configureTreasuryProposalIds[configureTreasuryProposalIds.length - 1];

  const approveTreasuryProposalTx = await governanceFromBootstrapSigner.approveGovernanceProposal(
    configureTreasuryProposalId,
    { ...gasOverrides, gasLimit: 900_000n }
  );
  await approveTreasuryProposalTx.wait();

  const executeTreasuryProposalTx = await governance.executeGovernanceProposal(
    configureTreasuryProposalId,
    { ...gasOverrides, gasLimit: 1_400_000n }
  );
  await executeTreasuryProposalTx.wait();

  const treasuryDetails = await payroll.getTreasuryAdapterDetails(orgId);

  const latestBlock = await ethers.provider.getBlock("latest");
  const fundingDeadline = BigInt((latestBlock?.timestamp ?? Math.floor(Date.now() / 1000)) + 3600);
  const createRunPayload = abiCoder.encode(
    ["bytes32", "bytes32", "uint64", "uint32"],
    [payrollRunId, settlementAssetId, fundingDeadline, 1]
  );
  const createRunProposalTx = await governance.proposeGovernanceAction(
    orgId,
    GovernanceActionType.CreatePayrollRun,
    createRunPayload,
    governanceExpiry + 1n,
    { ...gasOverrides, gasLimit: 1_200_000n }
  );
  await createRunProposalTx.wait();

  const createRunProposalIds = await governance.getOrganizationGovernanceProposalIds(orgId);
  const createRunProposalId = createRunProposalIds[createRunProposalIds.length - 1];

  const approveCreateRunProposalTx = await governanceFromBootstrapSigner.approveGovernanceProposal(
    createRunProposalId,
    { ...gasOverrides, gasLimit: 900_000n }
  );
  await approveCreateRunProposalTx.wait();

  const executeCreateRunProposalTx = await governance.executeGovernanceProposal(
    createRunProposalId,
    { ...gasOverrides, gasLimit: 1_500_000n }
  );
  await executeCreateRunProposalTx.wait();

  const [encryptedPayroll] = await liveClient.encryptInputs([Encryptable.uint128(payrollAmount)]).execute();
  const encryptedTuple = [
    encryptedPayroll.ctHash,
    encryptedPayroll.securityZone,
    encryptedPayroll.utype,
    encryptedPayroll.signature
  ] as const;

  const issuePayrollPayload = abiCoder.encode(
    ["bytes32", "address", "(uint256,uint8,uint8,bytes)", "bytes32", "bytes32"],
    [payrollRunId, adminAddress, encryptedTuple, paymentId, memoHash]
  );

  const issuePayrollProposalTx = await governance.proposeGovernanceAction(
    orgId,
    GovernanceActionType.IssueConfidentialPayrollToRun,
    issuePayrollPayload,
    governanceExpiry + 2n,
    { ...gasOverrides, gasLimit: 1_400_000n }
  );
  await issuePayrollProposalTx.wait();

  const issueProposalIds = await governance.getOrganizationGovernanceProposalIds(orgId);
  const issuePayrollProposalId = issueProposalIds[issueProposalIds.length - 1];

  const approveIssuePayrollProposalTx = await governanceFromBootstrapSigner.approveGovernanceProposal(
    issuePayrollProposalId,
    { ...gasOverrides, gasLimit: 900_000n }
  );
  await approveIssuePayrollProposalTx.wait();

  const issuePayrollTx = await payroll.issueConfidentialPayrollToRun(
    orgId,
    payrollRunId,
    adminAddress,
    encryptedPayroll,
    paymentId,
    memoHash,
    { ...gasOverrides, gasLimit: 1_800_000n }
  );
  await issuePayrollTx.wait();

  const employeeAllocations = await payroll.getEmployeeAllocations(orgId, adminAddress);
  const permit = await liveClient.permits.getOrCreateSelfPermit();
  const decryptedAllocation = await liveClient
    .decryptForView(employeeAllocations[3][0], FheTypes.Uint128)
    .withPermit(permit)
    .execute();

  const payrollRun = await payroll.getPayrollRun(payrollRunId);
  const issueProposal = await governance.getGovernanceProposal(issuePayrollProposalId);

  const result = {
    network: hre.network.name,
    chainId: (await admin.provider.getNetwork()).chainId.toString(),
    payroll: deployment.payroll,
    governanceAddress: deployment.governance,
    directSettlementAdapter: deployment.directSettlementAdapter,
    adminAddress,
    secondAdminAddress,
    orgId,
    payrollRunId,
    paymentId,
    governanceState: {
      contract: deployment.governance,
      initialized: governanceState.initialized,
      active: governanceActive,
      connectedAdminIsRecognized,
      bootstrapAdminIsRecognized,
      quorum: Number(governanceState.quorum),
      adminCount: Number(governanceState.adminCount),
      linkedExecutor
    },
    transactions: {
      fundBootstrapSigner: fundBootstrapSignerTx.hash,
      createOrganization: createOrgTx.hash,
      bootstrapGovernance: bootstrapTx.hash,
      bootstrapGovernanceAdmin: bootstrapSignerTx.hash,
      linkExecutor: linkExecutorTx.hash,
      proposeConfigureTreasury: configureTreasuryProposalTx.hash,
      approveConfigureTreasury: approveTreasuryProposalTx.hash,
      executeConfigureTreasury: executeTreasuryProposalTx.hash,
      proposeCreatePayrollRun: createRunProposalTx.hash,
      approveCreatePayrollRun: approveCreateRunProposalTx.hash,
      executeCreatePayrollRun: executeCreateRunProposalTx.hash,
      proposeIssuePayroll: issuePayrollProposalTx.hash,
      approveIssuePayroll: approveIssuePayrollProposalTx.hash,
      executeIssuePayrollFromWallet: issuePayrollTx.hash
    },
    proposals: {
      configureTreasuryProposalPreview,
      configureTreasuryProposalId,
      createRunProposalId,
      issuePayrollProposalId,
      issuePayrollExecuted: issueProposal.executed,
      issuePayrollRequiresWalletExecutor: true
    },
    treasury: {
      adapter: treasuryDetails[0],
      routeId: treasuryDetails[1]
    },
    payrollRun: {
      status: Number(payrollRun.status),
      allocationCount: Number(payrollRun.allocationCount),
      claimedCount: Number(payrollRun.claimedCount)
    },
    decryptedAllocation: decryptedAllocation.toString()
  };

  mkdirSync(join(process.cwd(), "outputs"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "outputs", "arb-sepolia-governance-live-smoke.json"),
    `${JSON.stringify(result, null, 2)}\n`
  );

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
