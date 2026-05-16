# CipherRoll Testing & Verification Guide

This guide outlines the current submission-readiness verification flow for the CoFHE-based CipherRoll contracts and frontend on Arbitrum Sepolia.

## 1. Smart Contract Compilation

Navigate to the repository root and compile the contracts using Hardhat/Foundry wrappers.

```bash
npm run compile
```

**Expected Output:**
- `CipherRollPayroll.sol` compiles successfully.
- Typechain artifacts are generated for the frontend.

## 2. Clean Engineering Baseline

Run the full submission baseline sweep from the repository root.

```bash
npm run baseline
```

**Expected Output:**
- `npm run compile` succeeds.
- `npm run test` succeeds.
- `npm run build:web` completes a production Next.js build successfully.
- The current submission snapshot is not treated as stable until this full sweep is green.

## 3. Protocol Deployment

Deploy the core protocol to Arbitrum Sepolia.

```bash
npm install
npm run deploy:arb-sepolia
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

1. **Workspace Genesis:** Connect an admin wallet and create a new organizational workspace. Confirm workspace creation succeeds both with a readable label and with the safer less-guessable ID option in the admin portal.
2. **Homomorphic Funding:** Deposit an encrypted budget amount. Ensure the transaction succeeds and the on-chain handle mapping updates without revealing the integer.
3. **Explicit Run Lifecycle:** Create a payroll run, upload at least one allocation, fund the run from encrypted budget state, and activate the claim window. Confirm claim attempts fail before activation and succeed only after the run becomes active.
4. **Confidential Issuance:** Issue a payroll allocation to a designated employee wallet address. Add a specific memo.
5. **Aggregate Admin Insight:** Refresh the admin portal and confirm it shows only organization-level counters such as total payroll items, active items, claimed items, vesting items, recipient count, and budget health.
6. **Vesting Issuance:** Issue a second payroll allocation with a future vesting window. Confirm the employee can see that it exists while the contract still blocks early claim attempts.
7. **Local Permit-Backed Decryption:** 
   - Switch your Web3 provider to the employee's wallet address.
   - Access the `/employee` portal.
   - Generate an EIP-712 security permit.
   - Validate that the browser `@cofhe/sdk` client successfully decrypts the ciphertext via `decryptForView()` and keeps plaintext local to the browser session.
   - Confirm the portal labels allocations clearly as draft/funded-awaiting-activation/claim-ready/vesting/claimed when applicable.
8. **Claim Path:** Claim an immediate allocation successfully, then verify that the same allocation cannot be claimed twice and that a still-vesting allocation remains blocked until unlock.
9. **Treasury-Backed Settlement Check:**
   - Configure a workspace treasury adapter and fund it with a real test token inventory.
   - Confirm the admin portal shows available and reserved treasury balances for the workspace before and after funding a payroll run.
   - Claim a payroll item from the employee wallet and confirm the employee receives an actual token balance increase on-chain.
   - For a wrapper-backed workspace, confirm the employee first requests payout and then finalizes the wrapper claim before the underlying token balance increases.
   - Confirm a workspace without treasury configuration still falls back to claim-state-only behavior.
10. **Auditor Selective-Disclosure Check:**
   - From the admin portal, create an auditor sharing permit for a named recipient wallet and copy the exported non-sensitive payload.
   - From the auditor portal, import that payload into the recipient wallet, activate the recipient permit, and refresh the workspace.
   - Confirm the auditor can decrypt only the aggregate budget / committed / available values while the portal continues to show public compliance-safe summary fields.
   - Confirm the auditor cannot access employee salary rows or employee allocation handles through the portal.
   - Confirm removing the permit from the admin or auditor browser clears the local session but the product language still describes that as a local revoke aid rather than a universal remote kill switch.
   - Confirm the auditor can select one aggregate metric, generate a `decryptForTx` proof from the imported recipient permit, and submit either a verify receipt or a publish receipt on-chain.
   - Confirm the evidence flow stays narrow: one aggregate metric at a time, no employee salary rows, and no broader disclosure than the chosen budget / committed / available value.
   - Confirm the auditor can also choose a batch of aggregate metrics and submit one batched verify receipt or one batched publish receipt without revealing employee-level encrypted state.
   - Confirm the portal clearly shows when the auditor is only reviewing permit-based data locally versus when they are producing an on-chain receipt.
11. **Privacy Boundary Check:**
   - Confirm encrypted values stay private: budget, committed amount, available amount, and employee allocation amounts.
   - Confirm public metadata is still visible by design: wallet addresses, workspace ids, payment ids, memo hashes, vesting timestamps, payroll-run status, and claim/finalization transactions.
   - Confirm the current product documents the wrapper privacy boundary honestly: confidential balances stay private before wrapper-request decryption, while the wrapper settlement amount becomes public once the on-chain `decryptForTx` finalize proof is submitted.
   - Confirm the product documents the shared-permit prerequisite honestly: the auditor flow depends on prior on-chain `FHE.allow(...)` access granted by the data owner to the aggregate handles exposed for audit review.
   - Confirm the product distinguishes clearly between a view-only aggregate disclosure and a provable on-chain audit receipt, including the extra publicity tradeoff of publishing decrypt results.
   - Confirm the product explains that batch receipts still remain aggregate-only and are built from the same shared-permit organization metrics rather than payroll-row disclosures.
   - Confirm the product explains in plain language that view mode keeps plaintext local to the auditor browser, while receipt mode records evidence on-chain.

## 6. Automated Unit Tests

Execute the standardized test suite to verify homomorphic logic, budget boundaries, and role-based access controllers.

```bash
npm run test
```

**Current Root Test Stack:**
- Hardhat runs with `@cofhe/hardhat-plugin` on the in-process `hardhat` network.
- CoFHE mock contracts are auto-deployed for local test runs.
- Tests create batteries-included CoFHE clients via `hre.cofhe.createClientWithBatteries(...)`.
- The suite currently covers encrypted multi-deposit budget math, confidential payroll issuance, explicit payroll-run lifecycle gating, privacy-safe organization insights, over-capacity zero-allocation behavior, employee-only reads, vesting metadata and claim enforcement, permit-enabled decrypt flows, admin/employee access control, wrapper-finalize proof verification, and malformed, mismatched, replayed, or duplicate request failure handling.

## 7. Backend Reporting & Export Verification

Once the Phase 4 backend is running, verify the indexed operator layer as well:

1. Open `GET /api/status` and confirm indexer progress plus object counts.
2. Open `GET /api/reports/organizations/:orgId/summary` for a real workspace and confirm it returns aggregate-only payroll, treasury, and claim posture.
3. Open `GET /api/notifications?orgId=:orgId` and confirm the feed includes funded runs, activated claims, employee claims, wrapper settlement requests/finalizations, and audit receipt events when applicable.
4. Open `GET /api/reports/organizations/:orgId/export` and confirm the JSON package contains:
   - summary
   - payroll runs
   - audit receipts
   - notifications
5. Open `GET /api/reports/organizations/:orgId/export?format=csv` and confirm the CSV downloads successfully.
6. Post to `POST /api/cipherbot/query` with a free-form question such as "Why can a later payroll run still show zero available treasury funds?" and confirm the answer cites current CipherRoll funding behavior rather than a generic chatbot response.
7. In the docs, admin, and auditor portals, confirm CipherBot accepts free-form questions and returns portal-aware answers plus follow-up prompts.
8. In the admin portal overview, confirm the backend operations panel shows:
   - indexer status
   - active payroll runs
   - pending employee claims
   - wrapper finalize backlog
   - filterable workflow notifications
9. In the auditor portal receipts tab, confirm the backend evidence package shows:
   - verified receipt stream
   - published receipt stream
   - packaged notification trail

Expected boundary:
- backend reporting should improve operator visibility
- employee plaintext salary rows must still remain out of backend reports and exports
