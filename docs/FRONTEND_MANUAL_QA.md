# CipherRoll Frontend Manual QA

Use this master checklist to manually verify the CipherRoll web application prior to major production deployments.

## 1. Environment & Build Integrity
- [ ] Run `npm run compile` at the repo root to satisfy contract typings.
- [ ] Run `cd web && npm run build` to ensure the Next.js production pipeline clears all ESLint and TypeScript checks without fatal warnings.
- [ ] Boot the optimized build via `npm run start` and ensure `/`, `/admin`, `/employee`, and `/docs` route reliably.

## 2. Branding & Visual Architecture
- [ ] **Landing Page:** Ensure the hero section renders with the "Private Payroll. Blind Execution." tagline and background immersive assets resolve flawlessly.
- [ ] **Links:** Verify the "Watch Demo", "Open Portal", and all footer links accurately route to the live destinations (Demo video, App internals).
- [ ] **Responsive Design:** Throttle the window size to mobile dimensions. Confirm typography scales properly, glass-cards don't clip, and the navigation pill adapts to a hamburger menu or scrollable row.

## 3. Web3 Authentication
- [ ] Load portals without a wallet injected. Confirm graceful degradation (e.g., "Install Wallet" prompt).
- [ ] Connect a standard EVM wallet (MetaMask/Rabby). Confirm the global navigation header shortens the address cleanly.
- [ ] Disconnect and reconnect. Confirm state variables do not leak between wallet switches.

## 4. Admin Execution Validation
- [ ] **Onboarding Modal:** Ensure the Admin portal triggers the interactive walkthrough modal solely on the first visit (utilizing `localStorage`).
- [ ] **Organization Lifecycle:** Create a distinct workspace. Confirm real-time updates transition the UI to the active dashboard.
- [ ] **Data Polling:** After depositing a budget or issuing a payroll allocation, verify that the `loadOrganization()` hook successfully refetches the updated encrypted handles and synchronizes the frontend without requiring a hard refresh.

## 5. Employee Portal Validation
- [ ] **Permit Generation:** Assure the employee is able to sign the EIP-712 read permit without triggering gas warnings.
- [ ] **Zero-Leakage:** Verify that the employee view completely strips away all organizational admin controls, displaying only specific, isolated payment allocations directly mapped to their signature.

## 6. Typographical Cleanliness
- [ ] Review all text descriptions. Ensure absolutely no raw HTML entities (like `&apos;` or `&quot;`) render natively onto the screen in any portal.
