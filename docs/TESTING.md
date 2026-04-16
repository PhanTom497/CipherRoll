# CipherRoll Testing & Verification Guide

This guide outlines the proper procedures for testing the CoFHE-based CipherRoll contracts and frontend integration on Arbitrum Sepolia or Base Sepolia.

## 1. Smart Contract Compilation

Navigate to the repository root and compile the contracts using Hardhat/Foundry wrappers.

```bash
npm run compile
```

**Expected Output:**
- `CipherRollPayroll.sol` compiles successfully.
- Typechain artifacts are generated for the frontend.

## 2. Clean Engineering Baseline

Run the full pre-milestone verification sweep from the repository root.

```bash
npm run baseline
```

**Expected Output:**
- `npm run compile` succeeds.
- `npm run test` succeeds.
- `npm run build:web` completes a production Next.js build successfully.
- No later Phase 2 milestone is treated as complete until this full sweep is green.

## 3. Protocol Deployment

Deploy the core protocol to Arbitrum Sepolia or Base Sepolia.

```bash
npm install
npm run deploy:arb-sepolia
# or
npm run deploy:base-sepolia
```

**Expected Output:**
- An instance of the `CipherRollPayroll` contract is deployed.
- Deployment metadata is updated with the new addresses.

## 4. Local Development Server

```bash
cd web
npm run dev
```

**Expected Output:**
- The frontend loads seamlessly at `http://localhost:3000`.
- All sub-routes (`/admin`, `/employee`, `/docs`) properly resolve and maintain state.

## 5. End-to-End Functional Flow

1. **Workspace Genesis:** Connect an admin wallet and create a new organizational workspace. Confirm the Keccak256 `orgId` deterministic label resolves properly.
2. **Homomorphic Funding:** Deposit an encrypted budget amount. Ensure the transaction succeeds and the on-chain handle mapping updates without revealing the integer.
3. **Confidential Issuance:** Issue a payroll allocation to a designated employee wallet address. Add a specific memo.
4. **Local Permit-Backed Decryption:** 
   - Switch your Web3 provider to the employee's wallet address.
   - Access the `/employee` portal.
   - Generate an EIP-712 security permit.
   - Validate that the browser `@cofhe/sdk` client successfully decrypts the ciphertext via `decryptForView()` and keeps plaintext local to the browser session.

## 6. Automated Unit Tests

Execute the standardized test suite to verify homomorphic logic, budget boundaries, and role-based access controllers.

```bash
npm run test
```

**Current Root Test Stack:**
- Hardhat runs with `@cofhe/hardhat-plugin` on the in-process `hardhat` network.
- CoFHE mock contracts are auto-deployed for local test runs.
- Tests create batteries-included CoFHE clients via `hre.cofhe.createClientWithBatteries(...)`.
- The suite currently covers encrypted multi-deposit budget math, confidential payroll issuance, over-capacity zero-allocation behavior, employee-only reads, vesting metadata and claim enforcement, permit-enabled decrypt flows, admin/employee access control, and malformed or duplicate request failure handling.
