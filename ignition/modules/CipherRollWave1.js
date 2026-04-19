"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const modules_1 = require("@nomicfoundation/hardhat-ignition/modules");
exports.default = (0, modules_1.buildModule)("CipherRollWave1", (module) => {
    const treasuryAdapter = module.contract("Wave1TreasuryAdapter");
    const payroll = module.contract("CipherRollPayroll");
    return {
        payroll,
        treasuryAdapter
    };
});
