# CipherRoll Testing Guide

This guide covers the Wave 1 testing surface for the Fhenix-native CipherRoll product.

## Recommended Order

1. Compile the contracts.
2. Deploy the Wave 1 module.
3. Run the frontend.
4. Test the admin-to-employee flow.
5. Review the docs route for buildathon readiness.
6. Walk through `docs/FRONTEND_MANUAL_QA.md`.

## 1. Contract Compile

```bash
npm run compile
```

Expected:

- Foundry loads the Wave 1 workspace
- `CipherRollPayroll.sol` compiles
- the treasury adapter mock compiles

## 2. Deployment

Before deploying, install the root dependencies:

```bash
npm install
```

If you previously saw an error for `@fhenixprotocol/cofhe-hardhat-plugin`, pull the latest `package.json` changes first. CipherRoll now uses the published `cofhe-hardhat-plugin` package instead.

```bash
npm run deploy:sepolia
```

Expected:

- a Wave 1 payroll contract address is produced
- a Wave 1 treasury adapter address is produced
- `outputs/sepolia-deployment.json` is written
- the frontend env can be updated with the deployment address

## 3. Frontend Run

```bash
cd web
npm run dev
```

Expected:

- `/`, `/admin`, `/employee`, and `/docs` render
- `/auditor` and `/tax-authority` render as future-wave previews
- the existing visual design remains intact

## 4. Wave 1 Functional Validation

### Admin setup

Validate:

- admin wallet connects
- workspace can be created
- treasury adapter config saves
- reserved quorum metadata is visible

### Encrypted budget

Validate:

- budget deposit transaction succeeds
- admin summary handles update
- permit flow attempts to unseal budget, committed, and available values

### Confidential payroll issuance

Validate:

- admin can issue a standard payroll allocation
- admin can issue a vesting payroll allocation with future timestamps
- payment id and memo hash are created
- allocation respects available budget in encrypted logic

### Employee permit view and claim

Validate:

- employee wallet connects
- employee creates a permit
- employee can fetch only their own handles
- employee can execute `claimPayroll` on an available allocation
- employee unseal path succeeds when standard tooling is present

### Docs route

Validate:

- docs explain Wave 1 clearly
- docs explain Wave 2 and Wave 3 deferrals clearly
- local setup instructions are accurate
- architecture text matches the implemented contract/frontend shape

## 5. Manual Demo Path

1. Create the organization in `/admin`.
2. Configure a treasury adapter address and route id.
3. Deposit budget.
4. Issue a confidential payroll allocation.
5. Switch to the employee wallet.
6. Generate a permit.
7. Refresh `/employee`.
8. Confirm the employee sees only their own handle and, where supported, the unsealed amount.

## 6. Wave 1 Constraints To Remember

- single-admin execution is intentional
- later-wave role portals are previews, not full production flows
- compliance flows are out of scope for this milestone
