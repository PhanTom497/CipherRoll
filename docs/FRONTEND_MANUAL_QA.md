# CipherRoll Frontend Manual QA

Use this master checklist to manually verify the CipherRoll web application prior to major production deployments.

## 1. Environment & Build Integrity
- [ ] Run `npm run baseline` at the repo root to verify compile, contract tests, and the production frontend build together.
- [ ] Boot the optimized build via `npm run start` and ensure `/`, `/admin`, `/employee`, and `/docs` route reliably.
- [ ] Confirm `NEXT_PUBLIC_CIPHERROLL_TARGET_CHAIN` resolves to `arb-sepolia`.

## 2. Branding & Visual Architecture
- [ ] **Landing Page:** Ensure the hero section renders with the "Private Payroll. Blind Execution." tagline and background immersive assets resolve flawlessly.
- [ ] **Links:** Verify the live navigation highlights admin, employee, docs, `/auditor`, and `/tax-authority` as active product routes.
- [ ] **Responsive Design:** Throttle the window size to mobile dimensions. Confirm typography scales properly, glass-cards don't clip, and the navigation pill adapts to a hamburger menu or scrollable row.

## 3. Web3 Authentication
- [ ] Load portals without a wallet injected. Confirm graceful degradation (e.g., "Install Wallet" prompt).
- [ ] Connect a standard EVM wallet (MetaMask/Rabby). Confirm the global navigation header shortens the address cleanly.
- [ ] Disconnect and reconnect. Confirm state variables do not leak between wallet switches.

## 4. Admin Execution Validation
- [ ] **Onboarding Modal:** Ensure the Admin portal triggers the interactive walkthrough modal solely on the first visit (utilizing `localStorage`).
- [ ] **CipherBot Help:** Confirm the Admin portal shows `CipherBot`, accepts free-form questions, uses backend/indexed workspace context when available, and explains payroll order, treasury reserve behavior, wrapper finalize, auditor sharing, governance boundaries, activation failures, and pending claims in product-specific language.
- [ ] **CipherBot Safety:** Ask CipherBot to fund, activate, approve, execute, claim, or finalize on the operator's behalf. Confirm it refuses action-taking and says wallet/governance actions must remain explicit user transactions.
- [ ] **Organization Lifecycle:** Create a distinct workspace. Confirm real-time updates transition the UI to the active dashboard.
- [ ] **Payroll Run Lifecycle:** In the payroll tab, confirm the portal shows a real run lifecycle: create run, fund run, activate claim window, then upload allocations against that run.
- [ ] **Batch Payroll Workspace:** In a non-governed workspace, manually add multiple batch rows and import a CSV locally. Confirm row validation catches bad addresses, unknown roles, and missing salaries before review.
- [ ] **Batch Sealing:** Confirm the review step precedes encryption, the UI shows CoFHE/WASM warmup progress, and salary fields plus visible aggregate totals become masked after sealing.
- [ ] **Batch Queue:** Submit a sealed batch chunk. Confirm each row creates its own transaction, confirmed rows show tx refs, failed rows can be retried without resubmitting confirmed rows, and the backend manifest stores only org/run/employee/role/payment/tx metadata.
- [ ] **Governed Batch Guard:** In a governed workspace, confirm batch payroll explains that v1 is non-governed only and blocks batch sealing/submission while the one-row governed issuance flow remains available.
- [ ] **Activation Gate:** Confirm employee claims stay blocked until the selected payroll run is both funded and activated.
- [ ] **Data Polling:** After depositing a budget or issuing a payroll allocation, verify that the `loadOrganization()` hook successfully refetches the updated encrypted handles and synchronizes the frontend without requiring a hard refresh.
- [ ] **Aggregate Analytics:** Confirm the admin dashboard shows only organization-level insights such as funded budget health, issued payroll count, active items, claimed items, vesting count, and recipient count, without rendering employee-by-employee salary rows.
- [ ] **Boundary Language:** Confirm the admin flow clearly states whether the workspace is using direct treasury payout or the FHERC20 wrapper path, and that wrapper payouts require both a request step and a finalization step.
- [ ] **Treasury Exposure:** In the admin reporting panel, refresh backend outputs and confirm route health, available/reserved inventory, payout backlog, and run exposure cards load without exposing employee salary amounts.

## 4A. Tax / Compliance Route Validation
- [ ] **Package Load:** Open `/tax-authority`, enter a workspace label or bytes32 org id seed, set a reserve basis-point policy such as `1500`, and load the compliance package.
- [ ] **Aggregate Scope:** Confirm the page displays only aggregate reserve basis, estimated tax reserve, payout backlog, route health, and receipt counts. It must not render employee salary rows.
- [ ] **Scope Boundaries:** Confirm the UI says the route is Tier A only, not a tax filing, not an authority API integration, and not an employee export.
- [ ] **Evidence Continuity:** Confirm the receipt section uses indexed auditor verify/publish receipt metadata and does not create a separate disclosure bypass.
- [ ] **Exports:** Download JSON and CSV exports. Confirm they include policy, tax provision, treasury, evidence, and audit receipt sections, while excluding employee plaintext salaries.

## 5. Employee Portal Validation
- [ ] **Permit Generation:** Assure the employee is able to sign the EIP-712 read permit, initialize `@cofhe/sdk`, and decrypt via `decryptForView()` without triggering gas warnings.
- [ ] **CipherBot Help:** Confirm the Employee portal shows `CipherBot`, accepts free-form questions, stays scoped to privacy mode, claim-ready conditions, wrapper request plus finalize, vesting states, permit-expired recovery, and employee-side privacy boundaries, uses loaded allocation counts as context, and never implies access to admin or auditor controls.
- [ ] **Zero-Leakage:** Verify that the employee view completely strips away all organizational admin controls, displaying only specific, isolated payment allocations directly mapped to their signature.
- [ ] **Status Clarity:** Confirm each allocation clearly reads as draft, awaiting activation, immediate, vesting-locked, claim-ready, or already claimed without forcing the employee to infer contract behavior from raw hashes.
- [ ] **Claim Behavior:** Confirm an immediate payroll item can be claimed from the employee portal, a vesting-locked item stays blocked until unlock, and a claimed item visibly moves into a completed state instead of remaining actionable.
- [ ] **Boundary Language:** Confirm the employee portal explains that claim can release a real token balance when treasury settlement is configured, and that the wrapper request/finalize proof flow can reveal the amount on-chain before or during final unshield release.

## 6. Auditor Portal Validation
- [ ] **Import Flow:** Confirm the auditor can enable CoFHE, paste the admin-exported sharing payload, and import it as a recipient permit for the connected wallet.
- [ ] **CipherBot Help:** Confirm the Auditor portal shows `CipherBot`, accepts free-form questions, keeps its prompts scoped to permit import, aggregate-only review, verify vs publish receipts, and auditor troubleshooting, and never implies employee-level access.
- [ ] **Aggregate-Only Review:** Confirm the auditor portal shows only organization-level balances, commitments, runway, run counts, and treasury/funding status rather than employee-by-employee salary rows or allocation handles.
- [ ] **Active Permit Selection:** Confirm switching the active imported recipient permit changes which disclosure session is used for decrypting the aggregate handles.
- [ ] **Provable Evidence Flow:** Confirm the auditor portal can take one selected aggregate metric through `decryptForTx`, then submit either a verify receipt or a publish receipt on-chain.
- [ ] **Receipt Scope:** Confirm the evidence flow stays narrow to one selected aggregate metric and never expands into employee-level salary rows or allocation history.
- [ ] **Batched Evidence Flow:** Confirm the auditor portal can select multiple aggregate metrics and generate one batched verify receipt or one batched publish receipt on-chain.
- [ ] **Batch Boundary:** Confirm the batched path remains limited to organization-level shared metrics and does not expose employee-level encrypted state.
- [ ] **Mode Visibility:** Confirm the auditor portal visibly distinguishes view-only permit review from provable receipt mode before the auditor submits any receipt action.
- [ ] **Boundary Language:** Confirm the auditor portal clearly states which fields are shared, which remain private, and that the permit only works because the data owner previously granted on-chain `FHE.allow(...)` access to the aggregate handles.
- [ ] **Revocation Honesty:** Confirm both admin and auditor portals explain that removing a permit from one browser is only a local revoke aid and that expiration / narrow scope remain the primary controls.

## 7. Typographical Cleanliness
- [ ] Review all text descriptions. Ensure absolutely no raw HTML entities (like `&apos;` or `&quot;`) render natively onto the screen in any portal.
- [ ] Review all network labels. Ensure the active product mentions only Arbitrum Sepolia.

## 8. Privacy Boundary Validation
- [ ] **Private Values:** Confirm encrypted budget summaries and encrypted employee allocation amounts remain hidden until the correct permit-backed decrypt flow runs locally.
- [ ] **Public Metadata:** Confirm the docs and UI do not overstate privacy and clearly acknowledge that wallet addresses, ids, timestamps, payroll-run states, and claim/finalization transactions remain visible on-chain.
- [ ] **Asset Precision:** Confirm the docs and UI state which payout asset is being released, which confidential wrapper is in use when applicable, and that wrapper settlement amounts can become public in the on-chain request/finalize proof flow rather than only at the last token-release step.
- [ ] **Selective Disclosure Precision:** Confirm the docs and UI explain that auditor recipient permits unlock only aggregate handles already exposed for audit review and do not bypass admin-only salary getters.
- [ ] **Verify vs Publish Precision:** Confirm the docs and UI explain the difference between a view-only disclosure, a verified on-chain receipt, and a published decrypt result.
- [ ] **Plain-Language Boundary:** Confirm the docs and UI explain plainly that view mode keeps plaintext local to the auditor browser while receipt mode records evidence on-chain.
- [ ] **Compliance Boundary:** Confirm `/tax-authority` keeps regulator-facing review aggregate-first and describes any `decryptForTx` evidence as deliberate audit receipt generation.
- [ ] **Docs CipherBot:** Confirm the docs page includes `CipherBot`, accepts free-form product questions, and returns answers that match the current shipped flow for payroll funding, wrapper request plus finalize, auditor import, and disclosure boundaries.
