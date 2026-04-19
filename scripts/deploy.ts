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

  const auditorDisclosureFactory = await ethers.getContractFactory("CipherRollAuditorDisclosure");
  const auditorDisclosure = await auditorDisclosureFactory.deploy(payrollAddress);
  await auditorDisclosure.waitForDeployment();
  const auditorDisclosureAddress = await auditorDisclosure.getAddress();
  console.log(`CipherRollAuditorDisclosure deployed at ${auditorDisclosureAddress}`);

  const adapterFactory = await ethers.getContractFactory("Wave1TreasuryAdapter");
  const treasuryAdapter = await adapterFactory.deploy();
  await treasuryAdapter.waitForDeployment();
  const treasuryAdapterAddress = await treasuryAdapter.getAddress();
  console.log(`Wave1TreasuryAdapter deployed at ${treasuryAdapterAddress}`);

  const settlementTokenFactory = await ethers.getContractFactory("MockSettlementToken");
  const settlementToken = await settlementTokenFactory.deploy();
  await settlementToken.waitForDeployment();
  const settlementTokenAddress = await settlementToken.getAddress();
  console.log(`MockSettlementToken deployed at ${settlementTokenAddress}`);

  const directSettlementAdapterFactory = await ethers.getContractFactory("MockSettlementTreasuryAdapter");
  const directSettlementAdapter = await directSettlementAdapterFactory.deploy(
    payrollAddress,
    settlementTokenAddress
  );
  await directSettlementAdapter.waitForDeployment();
  const directSettlementAdapterAddress = await directSettlementAdapter.getAddress();
  console.log(`MockSettlementTreasuryAdapter deployed at ${directSettlementAdapterAddress}`);

  const confidentialTokenFactory = await ethers.getContractFactory("MockConfidentialPayrollToken");
  const confidentialToken = await confidentialTokenFactory.deploy(settlementTokenAddress);
  await confidentialToken.waitForDeployment();
  const confidentialTokenAddress = await confidentialToken.getAddress();
  console.log(`MockConfidentialPayrollToken deployed at ${confidentialTokenAddress}`);

  const wrapperSettlementAdapterFactory = await ethers.getContractFactory("MockFHERC20SettlementTreasuryAdapter");
  const wrapperSettlementAdapter = await wrapperSettlementAdapterFactory.deploy(
    payrollAddress,
    settlementTokenAddress,
    confidentialTokenAddress
  );
  await wrapperSettlementAdapter.waitForDeployment();
  const wrapperSettlementAdapterAddress = await wrapperSettlementAdapter.getAddress();
  console.log(`MockFHERC20SettlementTreasuryAdapter deployed at ${wrapperSettlementAdapterAddress}`);

  const chainId = (await deployer.provider.getNetwork()).chainId;
  const deploymentFilename = `${networkName}-deployment.json`;
  const deployment = {
    network: networkName,
    chainId: chainId.toString(),
    deployer: deployerAddress,
    startNonce,
    payroll: payrollAddress,
    auditorDisclosure: auditorDisclosureAddress,
    treasuryAdapter: treasuryAdapterAddress,
    settlementToken: settlementTokenAddress,
    directSettlementAdapter: directSettlementAdapterAddress,
    confidentialPayrollToken: confidentialTokenAddress,
    wrapperSettlementAdapter: wrapperSettlementAdapterAddress,
    artifacts: {
      payroll: "artifacts/contracts/CipherRollPayroll.sol/CipherRollPayroll.json",
      auditorDisclosure: "artifacts/contracts/CipherRollAuditorDisclosure.sol/CipherRollAuditorDisclosure.json",
      treasuryAdapter: "artifacts/contracts/mocks/Wave1TreasuryAdapter.sol/Wave1TreasuryAdapter.json",
      settlementToken: "artifacts/contracts/mocks/MockSettlementToken.sol/MockSettlementToken.json",
      directSettlementAdapter: "artifacts/contracts/mocks/MockSettlementTreasuryAdapter.sol/MockSettlementTreasuryAdapter.json",
      confidentialPayrollToken: "artifacts/contracts/mocks/MockConfidentialPayrollToken.sol/MockConfidentialPayrollToken.json",
      wrapperSettlementAdapter: "artifacts/contracts/mocks/MockFHERC20SettlementTreasuryAdapter.sol/MockFHERC20SettlementTreasuryAdapter.json",
      typechain: {
        payroll: "typechain-types/contracts/CipherRollPayroll.ts",
        auditorDisclosure: "typechain-types/contracts/CipherRollAuditorDisclosure.ts"
      }
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
