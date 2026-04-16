import { Interface } from "ethers";
import { readFileSync } from "node:fs";

async function main() {
  const artifact = JSON.parse(
    readFileSync("artifacts/contracts/CipherRollPayroll.sol/CipherRollPayroll.json", "utf8")
  );
  const iface = new Interface(artifact.abi);
  
  const methods = [
    "depositBudget",
    "issueConfidentialPayroll",
    "getAdminBudgetHandles",
    "issueVestingAllocation",
    "getEmployeeAllocations"
  ];
  
  methods.forEach((m) => {
    const fn = iface.getFunction(m);
    if (fn) {
      console.log(m, fn.format("sighash"));
    }
  });
}
main().catch(console.error);
