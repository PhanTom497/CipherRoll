import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CipherRollWave1", (module) => {
  const treasuryAdapter = module.contract("Wave1TreasuryAdapter");
  const payroll = module.contract("CipherRollPayroll");

  return {
    payroll,
    treasuryAdapter
  };
});
