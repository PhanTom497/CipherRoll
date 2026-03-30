import { ethers } from "hardhat";
import fs from "fs";

async function main() {
  const artifact = JSON.parse(fs.readFileSync("artifacts/contracts/CipherRollPayroll.sol/CipherRollPayroll.json", "utf8"));
  const iface = new ethers.Interface(artifact.abi);
  
  const methods = [
    "depositBudget",
    "issueConfidentialPayroll",
    "getAdminSummaryHandles",
    "issueVestingAllocation",
    "getEmployeeHandles"
  ];
  
  methods.forEach(m => {
    const fns = iface.fragments.filter(f => f.type === "function" && f.name === m);
    if(fns.length > 0) {
      console.log(m, fns[0].format("sighash"));
    }
  });
}
main().catch(console.error);
