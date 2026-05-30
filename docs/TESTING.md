# CipherRoll Testing & Verification Guide

This guide is the practical verification flow for the current **Wave 4** CipherRoll submission.

It covers:

- smart contract baseline checks
- frontend production readiness
- backend/indexer validation
- payroll workflow verification
- auditor and privacy-boundary checks
- hosted stack checks

---

## 1. Engineering Baseline

Run these from the repository root:

```bash
npm run compile
npm run test
npm run build:web
npm run build:backend
```

Expected result:

- contracts compile successfully
- tests pass
- frontend production build succeeds
- backend build succeeds

If this baseline is red, the current submission should not be treated as stable.

---

## 2. Local Product Loop

### Start the backend

```bash
npm run dev:backend
```

### Start the frontend

```bash
cd web
npm run dev
```

### Expected local routes

- `/`
- `/docs`
- `/admin`
- `/employee`
- `/auditor`
- `/tax-authority`

---

## 3. Backend Verification

### Health and status

Check the backend directly:

```bash
curl http://127.0.0.1:4000/api/health
curl http://127.0.0.1:4000/api/status
```

Expected:

- health returns `ok: true`
- status returns chain, indexer, and object-count information

### Read-model verification

Verify the backend can return frontend-facing data:

- `GET /api/reports/organizations/:orgId/summary`
- `GET /api/organizations/:orgId/runs`
- `GET /api/organizations/:orgId/payments`
- `GET /api/notifications?orgId=:orgId`
- `GET /api/compliance/organizations/:orgId/package?taxReserveBps=1500`
- `GET /api/compliance/organizations/:orgId/export?format=csv&taxReserveBps=1500`
- `GET /api/reports/organizations/:orgId/export`

Expected boundary:

- summaries are aggregate-first
- exports are useful for operators
- compliance packages include policy, aggregate tax provision, treasury posture, and receipt metadata
- employee plaintext salary rows do not appear in reports or exports

---

## 4. Admin Workflow Verification

1. Connect the intended admin wallet.
2. Confirm the wallet is on **Arbitrum Sepolia**.
3. Initialize **CoFHE**.
4. Create a workspace / organization.
5. Fund encrypted budget.
6. Create a payroll run.
7. Issue at least one payroll allocation, either through the one-row flow or the non-governed batch payroll workspace.
8. Fund the payroll run from treasury-backed inventory.
9. Refresh backend reporting and confirm the treasury exposure panel shows route health, available/reserved inventory, payout backlog, and funded/active run exposure without salary rows.
10. Activate claims.
11. Refresh the admin portal and confirm the backend reporting panel loads.

Verify:

- workspace metadata loads correctly
- operator role is recognized
- encrypted summary cards can be read after CoFHE init
- backend reporting cards load without 404 or JSON parse errors
- batch payroll CSV import stays browser-local, sealed rows mask salaries, and each submitted row maps to one existing issuance transaction
- batch payroll manifests contain role labels and tx refs but no salary amounts
- exports work
- workflow notifications appear

---

## 5. Employee Workflow Verification

1. Switch to the employee wallet.
2. Open `/employee`.
3. Generate or reuse the local permit flow.
4. Confirm payroll rows load for the intended employee.
5. Decrypt values locally through the browser flow.
6. Claim an allocation.
7. If the route is wrapper-backed, finalize the payout.

Verify:

- values decrypt locally
- early claim attempts remain blocked when expected
- claim-ready state appears only after activation
- wrapper-backed flow requires request plus finalize
- final payout becomes meaningful on-chain

---

## 6. Auditor Workflow Verification

1. From the admin portal, create an auditor sharing permit.
2. Export the non-sensitive sharing payload.
3. Open `/auditor` with the recipient wallet.
4. Import the shared payload.
5. Activate the permit locally.
6. Review aggregate-only values.
7. Create verify or publish receipts when needed.

Verify:

- auditor can read aggregate summary values
- auditor cannot see employee salary rows
- receipt generation stays narrow and aggregate-scoped
- portal distinguishes between local review and on-chain evidence

---

## 7. Privacy Boundary Verification

Confirm the product stays honest about its privacy model.

### Should remain encrypted

- organization budget
- committed payroll
- available runway
- employee allocation amounts
- aggregate disclosure handles

### Should remain public or inferable

- wallet addresses
- organization ids
- run states
- funding deadlines
- timestamps
- claim and finalize transactions

### Wrapper-specific check

Confirm the product explains that wrapper-backed balances stay confidential before request/finalize decryption, but the finalized settlement amount becomes public once the `decryptForTx` proof is submitted on-chain.

---

## 8. CipherBot Verification

CipherBot is now part of the shipped Wave 4 surface and should be verified explicitly.

### Test locations

- `/docs`
- `/admin`
- `/employee`
- `/auditor`

### What to verify

- the widget opens and accepts free-form questions
- answers are relevant to the current portal
- the chat route responds without hanging
- Gemini-backed answers work on the deployed frontend
- the route rotates across the configured Gemini flash models instead of answering from a local-doc fallback
- if every Gemini model is unavailable, the UI shows a clear provider/quota message rather than a stitched local-doc answer

### Useful browser check

In DevTools `Network`, inspect the `/api/chat` response headers:

- `X-CipherBot-Mode`
- `X-CipherBot-Model`
- `X-CipherBot-Reason`

This helps distinguish real model responses from missing-key or all-models-unavailable states.

---

## 9. Hosted Submission Verification

For the deployed Wave 4 stack, verify all three layers:

### Frontend

- Vercel deployment loads successfully
- docs, admin, employee, and auditor routes render correctly

### Backend

- Render backend returns healthy responses
- backend read-model routes return JSON

### Database

- backend remains stable across restarts
- indexed counts and summaries persist through the hosted Postgres layer

### Practical check

In the frontend browser DevTools `Network` tab:

- CipherBot should hit the Vercel route: `/api/chat`
- backend reporting requests should hit the Render backend host
- no product data fetch should be trying to use `localhost` or `127.0.0.1` in production

---

## 10. Final Submission Checklist

Before treating the Wave 4 submission as complete, confirm:

- [ ] contracts compile
- [ ] tests pass
- [ ] frontend production build passes
- [ ] backend build passes
- [ ] admin workflow works
- [ ] employee workflow works
- [ ] auditor workflow works
- [ ] backend status and summaries load
- [ ] exports work
- [ ] CipherBot works in deployed mode
- [ ] privacy wording still matches real behavior
- [ ] no deployed frontend route is still relying on localhost
