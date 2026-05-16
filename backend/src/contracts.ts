import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Contract, Interface, JsonRpcProvider } from "ethers";
import { backendConfig } from "./config";

type Artifact = {
  abi: Array<Record<string, unknown>>;
};

function readArtifact(relativePath: string): Artifact {
  const artifactPath = resolve(__dirname, "../../", relativePath);
  return JSON.parse(readFileSync(artifactPath, "utf8")) as Artifact;
}

const payrollArtifact = readArtifact("artifacts/contracts/CipherRollPayroll.sol/CipherRollPayroll.json");
const auditorArtifact = readArtifact(
  "artifacts/contracts/CipherRollAuditorDisclosure.sol/CipherRollAuditorDisclosure.json"
);

export const provider = new JsonRpcProvider(backendConfig.rpcUrl);
export const payrollInterface = new Interface(payrollArtifact.abi);
export const auditorInterface = new Interface(auditorArtifact.abi);

export const payrollContract = new Contract(
  backendConfig.payrollAddress,
  payrollArtifact.abi,
  provider
);

export const auditorContract = new Contract(
  backendConfig.auditorDisclosureAddress,
  auditorArtifact.abi,
  provider
);
