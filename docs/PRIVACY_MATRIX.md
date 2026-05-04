# CipherRoll Privacy Matrix

This matrix describes the current CipherRoll product as it exists in this repository on April 30, 2026. It is intentionally implementation-specific rather than aspirational.

## How to read this

- `Encrypted on-chain` means the value is stored as an FHE handle or confidential wrapper balance rather than as plain EVM data.
- `Public by Arbitrum/EVM design` means the value is exposed because normal EVM transactions, calldata, logs, token transfers, and block metadata are public.
- `Public because CipherRoll stores or emits it explicitly` means CipherRoll itself writes or returns the value in plain form through storage structs, getters, or events.
- `Inferable because the current frontend hashes predictable strings` means the chain only sees a hash, but the frontend often derives that hash from a human-readable label that may be guessable.

## Current-product matrix

| Category | Values | Why |
| --- | --- | --- |
| Encrypted on-chain | Organization budget handle, committed payroll handle, available runway handle | Stored as `euint128` in `CipherRollPayroll` and only intended for permit-backed `decryptForView(...)` or scoped `decryptForTx(...)` usage. |
| Encrypted on-chain | Employee payroll allocation amounts | Stored as `euint128` allocation handles rather than plain salary numbers. |
| Encrypted on-chain | Auditor aggregate handles | Shared through permit-based decrypt flows but still stored as encrypted handles on-chain. |
| Encrypted on-chain | Wrapper-backed confidential balances before wrapper-request decryption | The FHERC20-style wrapper path keeps the confidential balance encrypted until the request is opened for the on-chain finalize proof flow. |
| Public by Arbitrum/EVM design | Transaction sender, recipient, nonce, tx hash, gas usage, block number, and block timestamp | Standard EVM transparency. |
| Public by Arbitrum/EVM design | Contract calldata for actions like `createOrganization`, `createPayrollRun`, `issueConfidentialPayrollToRun`, `claimPayroll`, `requestPayrollSettlement`, and `finalizePayrollSettlement` | Function arguments are public on Arbitrum unless encrypted before submission. |
| Public by Arbitrum/EVM design | Event logs and their indexed topics | All emitted logs are publicly queryable. |
| Public by Arbitrum/EVM design | ERC20 transfer events and final payout token balances | Treasury-backed direct settlement and wrapper unshield release both touch public ERC20 state. |
| Public by Arbitrum/EVM design | Wrapper settlement amounts once the `decryptForTx` request/finalize proof is submitted on-chain | The finalize flow verifies a plaintext + signature on-chain, so that amount is no longer only local browser data. |
| Public because CipherRoll stores or emits it explicitly | `orgId`, `metadataHash`, admin address, treasury adapter address, treasury route id, admin slot count, quorum, creation/update timestamps | Stored in the `Organization` struct. Route ids are still available through admin-facing/public contract reads, but convenience-only route-id display has been trimmed from the auditor surface. |
| Public because CipherRoll stores or emits it explicitly | `paymentId`, `memoHash`, employee address, payroll creation timestamp, vesting flags, vesting start/end timestamps | Stored in `PayrollAllocationMeta`. The event now emits only the core `orgId` / `paymentId` / `employee` linkage, and the detailed per-payment meta getter is now restricted to the employee tied to that payment. |
| Public because CipherRoll stores or emits it explicitly | `payrollRunId`, `settlementAssetId`, funding deadline, planned headcount, allocation count, claimed count, funded/activated/finalized timestamps, run status | Stored in `PayrollRun`. The run-created event now keeps the funding window public but drops convenience-only label payloads that were not required for the workflow. |
| Public because CipherRoll stores or emits it explicitly | Organization-level insights such as total items, active items, claimed items, vesting items, recipient count, last issued time, and last claimed time | Stored as plain counters in `OrganizationInsights`; admin and auditor-accessible summary flows expose them. |
| Public because CipherRoll stores or emits it explicitly | Wrapper settlement request metadata: `requestId`, payout asset address, confidential asset address, request timestamp, existence flag | Stored in `PayrollSettlementRequest` and emitted in `PayrollSettlementRequested`. The detailed getter is now restricted to the employee tied to that payment instead of acting as a public convenience read. |
| Public because CipherRoll stores or emits it explicitly | Payroll settlement outcomes: payout asset and payout amount | Emitted in `PayrollSettled`, and direct settlement also releases a public ERC20 balance change. |
| Inferable because the current frontend hashes predictable strings | Workspace ids entered through `orgIdInput` | The frontend computes `orgId = keccak256(toUtf8Bytes(input))`. The UI now encourages higher-entropy ids, but the shared default context can still be convenient and guessable if operators keep mnemonic labels. |
| Inferable because the current frontend hashes predictable strings | Treasury route ids from labels like `cipherroll-wrapper-route` | The admin UI still hashes the route label directly with `toBytes32Label(...)`, but now exposes a one-click high-entropy alternative. |
| Inferable because the current frontend hashes predictable strings | Payroll run ids from labels like `may-2026-payroll` | The admin UI still hashes the payroll run label directly with `toBytes32Label(...)`, but now exposes a one-click high-entropy alternative. |
| Public because CipherRoll stores or emits them, but now less guessable in the current frontend | Settlement asset ids and workspace metadata hashes | The admin UI now generates these with a high-entropy helper rather than a fully deterministic readable label. |
| Inferable because the current frontend hashes predictable strings | Memo hashes when operators use readable memo text | The frontend still hashes `memo:<text>` deterministically for operator-entered memo labels. Blank memos now fall back to a higher-entropy label instead. |
| Public because CipherRoll stores or emits them, but now less guessable in the current frontend | Payment ids | The admin UI now generates payment ids with a higher-entropy helper instead of a deterministic employee-plus-timestamp label. This reduces casual inference, but the id is still public once emitted or returned. |

## Important interpretation notes

- `Hashed` is not the same as `private`. If the unhashed source string is predictable, third parties may be able to reproduce the same `bytes32` label.
- The admin UI now uses higher-entropy generation automatically for payment ids, workspace metadata hashes, blank memo fallbacks, and settlement asset ids, and it offers one-click high-entropy alternatives for workspace ids, treasury route labels, and payroll run labels.
- Before Phase 3, CipherRoll intentionally kept admin/employee addresses, funding windows, and run-state transitions public because those values drive the shipped lifecycle. It trimmed convenience-only route-id display and some event payload labels that were not required for product operation.
- Employee allocation amounts remain encrypted at rest, but the surrounding workflow metadata does not.
- The wrapper route improves confidentiality before the finalize proof is posted; it does not make the entire settlement lifecycle opaque.
- Auditor permit review and auditor proof generation are separate privacy modes. `decryptForView(...)` keeps plaintext local to the auditor browser, while `decryptForTx(...)` creates an explicitly on-chain evidence path.
