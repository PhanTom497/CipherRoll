import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
// @ts-ignore
import hre, { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const networkName = hre.network.name;
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
  const deploymentFilename = `${networkName}-deployment.json`;
  const deployment = {
    network: networkName,
    chainId: chainId.toString(),
    deployer: deployerAddress,
    startNonce,
    payroll: payrollAddress,
    treasuryAdapter: treasuryAdapterAddress,
    artifacts: {
      payroll: "artifacts/contracts/CipherRollPayroll.sol/CipherRollPayroll.json",
      treasuryAdapter: "artifacts/contracts/mocks/Wave1TreasuryAdapter.sol/Wave1TreasuryAdapter.json",
      typechain: "typechain-types/contracts/CipherRollPayroll.ts"
    },
    ciphertextHandleModel: {
      euint128: "bytes32",
      adminBudgetHandles: ["bytes32", "bytes32", "bytes32"],
      employeeAllocationHandles: "bytes32[]",
      encryptedInputTuple: {
        ctHash: "uint256",
        securityZone: "uint8",
        utype: "uint8",
        signature: "bytes"
      }
    }
  };

  mkdirSync(join(process.cwd(), "outputs"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "outputs", deploymentFilename),
    `${JSON.stringify(deployment, null, 2)}\n`
  );

  console.log(`Deployment written to outputs/${deploymentFilename}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
