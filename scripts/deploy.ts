import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const startNonce = await deployer.provider.getTransactionCount(
    deployerAddress,
    "pending"
  );

  console.log(`Deploying CipherRoll with ${deployerAddress}`);
  console.log(`Starting nonce: ${startNonce}`);

  const payrollFactory = await ethers.getContractFactory("CipherRollPayroll");
  const payroll = await payrollFactory.deploy();
  await payroll.waitForDeployment();
  const payrollAddress = await payroll.getAddress();
  console.log(`CipherRollPayroll deployed at ${payrollAddress}`);

  const adapterFactory = await ethers.getContractFactory("Wave1TreasuryAdapter");
  const treasuryAdapter = await adapterFactory.deploy();
  await treasuryAdapter.waitForDeployment();
  const treasuryAdapterAddress = await treasuryAdapter.getAddress();
  console.log(`Wave1TreasuryAdapter deployed at ${treasuryAdapterAddress}`);

  const chainId = (await deployer.provider.getNetwork()).chainId;
  const deployment = {
    network: "eth-sepolia",
    chainId: chainId.toString(),
    deployer: deployerAddress,
    startNonce,
    payroll: payrollAddress,
    treasuryAdapter: treasuryAdapterAddress
  };

  mkdirSync(join(process.cwd(), "outputs"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "outputs", "sepolia-deployment.json"),
    `${JSON.stringify(deployment, null, 2)}\n`
  );

  console.log("Deployment written to outputs/sepolia-deployment.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
