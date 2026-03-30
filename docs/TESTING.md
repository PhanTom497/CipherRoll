# CipherRoll Testing & Verification Guide

This guide outlines the proper procedures for testing the Fhenix-native CipherRoll contracts and frontend integration.

## 1. Smart Contract Compilation

Navigate to the repository root and compile the contracts using Hardhat/Foundry wrappers.

```bash
npm run compile
```

**Expected Output:**
- `CipherRollPayroll.sol` compiles successfully.
- Treasury adapter mocks build securely without warnings.
- Typechain artifacts are generated for the frontend.

## 2. Protocol Deployment

Deploy the core protocol to the Sepolia Fhenix Testnet.

```bash
npm install
npm run deploy:sepolia
```

**Expected Output:**
- An instance of the `CipherRollPayroll` contract is deployed.
- A treasury adapter boundary proxy is deployed.
- `outputs/sepolia-deployment.json` is accurately seeded with new addresses.

## 3. Local Development Server

```bash
cd web
npm run dev
```

**Expected Output:**
- The frontend loads seamlessly at `http://localhost:3000`.
- All sub-routes (`/admin`, `/employee`, `/docs`) properly resolve and maintain state.

## 4. End-to-End Functional Flow

1. **Workspace Genesis:** Connect an admin wallet and create a new organizational workspace. Confirm the Keccak256 `orgId` deterministic label resolves properly.
2. **Homomorphic Funding:** Deposit an encrypted budget amount. Ensure the transaction succeeds and the on-chain handle mapping updates without revealing the integer.
3. **Confidential Issuance:** Issue a payroll allocation to a designated employee wallet address. Add a specific memo.
4. **Client-Side Decryption:** 
   - Switch your Web3 provider to the employee's wallet address.
   - Access the `/employee` portal.
   - Generate an EIP-712 security permit.
   - Validate that the browser WASM worker (`cofhejs`) successfully unseals the ciphertext into plaintext in the browser memory only.

## 5. Automated Unit Tests

Execute the standardized test suite to verify homomorphic logic, budget boundaries, and role-based access controllers.

```bash
npm run test
```
