# CipherRoll Frontend Manual QA

Use this checklist to manually verify the Wave 1 frontend before recording a demo or submitting to the Fhenix buildathon.

## 1. Environment And Build

- Run `npm run compile` at the repo root.
  Expected: Foundry compile succeeds.
- Run `cd web && node node_modules/next/dist/bin/next build`.
  Expected: production build completes successfully and lists `/`, `/admin`, `/employee`, `/docs`, `/auditor`, and `/tax-authority`.
- Run `cd web && npm run dev`.
  Expected: the app starts without any build errors.
- Confirm `.env` or frontend env values are set.
  Expected: `NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS` is present for contract-backed testing.

## 2. Global Navigation And Branding

- Open `/`.
  Expected: the app is branded as `CipherRoll`.
- Check the nav, hero, portal cards, and footer copy.
  Expected: all text references FHE, permits, encrypted state, and Fhenix.
- Click each top-level navigation link.
  Expected: routes load correctly and preserve the existing glassmorphism design language.

## 3. Landing Page

- Verify the hero background video and section animations load.
  Expected: the landing page still feels premium and visually consistent with the prior design.
- Verify the portal cards navigate to `/admin`, `/employee`, `/auditor`, `/tax-authority`, and `/docs`.
  Expected: all links resolve without layout breakage.
- Resize from desktop to mobile width.
  Expected: no overlapping hero text, clipped buttons, or broken card layouts.

## 4. Wallet UX

- Visit `/admin` and `/employee` without a wallet installed.
  Expected: the wallet button shows `Install Wallet` and pages do not crash.
- Install or enable an injected EVM wallet and reload.
  Expected: the button changes to `Connect Wallet`.
- Connect a wallet.
  Expected: the button shows a shortened connected address and the network status component updates.
- Disconnect using the same button.
  Expected: the wallet state clears cleanly and the UI returns to the disconnected state.

## 5. Admin Flow

- Open `/admin` with the admin wallet connected.
  Expected: the page renders workspace, treasury, budget, and payroll actions.
- Click `Create workspace`.
  Expected: a transaction is requested and, after confirmation, the organization loads from chain.
- Configure the treasury adapter and route.
  Expected: a transaction is requested and the configured values appear in the organization summary.
- Deposit budget.
  Expected: a transaction is requested and admin summary handles update afterward.
- Generate an admin permit.
  Expected: a success toast appears and a permit is cached locally for that wallet.
- Issue a confidential payroll allocation to an employee address.
  Expected: a transaction is requested and the committed or available summary handles refresh.

## 6. Employee Flow

- Switch to the employee wallet and open `/employee`.
  Expected: the page loads without admin-only assumptions or crashes.
- Generate an employee permit.
  Expected: a success toast appears and the permit can be downloaded as JSON.
- Click `Refresh`.
  Expected: employee-owned handles load from the contract.
- Check the allocations list after admin issuance.
  Expected: the employee sees their own payment id, memo hash preview, created timestamp, and encrypted handle.
- Confirm the employee does not see unrelated admin state.
  Expected: no treasury configuration or aggregate admin controls are exposed on this route.

## 7. Docs Route

- Open `/docs`.
  Expected: the page explains what CipherRoll is, why FHE replaces the old model, and what is included in Wave 1.
- Read the roadmap content.
  Expected: Wave 2 and Wave 3 are clearly marked as future milestones.
- Review setup and architecture sections.
  Expected: the docs match the current repo structure and contract/frontend behavior.

## 8. Future-Wave Preview Routes

- Open `/auditor`.
  Expected: it reads as a polished Wave 2 preview, not fake live functionality.
- Open `/tax-authority`.
  Expected: it reads as a later-wave preview with accurate language about future scope.

## 9. Copy Audit

- Run a quick spot-check across the UI.
  Expected: no visible references to legacy frameworks or non-EVM terminologies.
- Confirm action labels match the FHE model.
  Expected: terminology uses `workspace`, `permit`, `encrypted handle`, `confidential payroll`, and `Fhenix`.

## 10. Known Wave 1 Limitations

- Employee and admin views currently load encrypted handles and signed permit bundles successfully.
- If the real CoFHE runtime is not installed, decrypted numeric values may still display as `Locked`.
- Auditor and tax authority routes are intentionally previews in Wave 1.

Treat the frontend as Wave 1 ready when the build succeeds, the admin-to-employee handle flow works, the docs are reviewer-friendly, and the UI tells one consistent CipherRoll-on-Fhenix story.
