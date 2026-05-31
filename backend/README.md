# CipherRoll Backend

The CipherRoll backend is the read-model, reporting, support, and export layer for the final Wave 5 product.

It supports the frontend without replacing wallet-local privacy. The backend indexes public chain state and compliance-safe projections, then packages that data for admin reporting, auditor evidence review, treasury exposure, batch manifests, compliance exports, notifications, and CipherBot context.

It must never become a salary plaintext server.

## What It Does

- Runs a small Node.js + TypeScript HTTP service.
- Indexes payroll, governance, treasury, settlement, and audit-receipt events.
- Persists normalized read models in Postgres.
- Serves status, reports, notifications, exports, and support context to the frontend.
- Stores safe batch payroll manifests after confirmed row submissions.
- Packages treasury exposure without exposing employee salary amounts.
- Packages Tier A compliance summaries from aggregate state and audit receipt metadata.
- Enriches CipherBot with indexed context while keeping it read-only.

## Privacy Boundary

The backend may store and serve:

- organization ids, admins, treasury route metadata, and lifecycle timestamps
- payroll run ids, statuses, allocation counts, claim counts, and funding state
- public payment ids, employee wallet addresses, claim/finalize state, and tx hashes
- audit receipt metadata, verify/publish mode, metric labels, and tx hashes
- batch manifest metadata: org id, run id, employee, role label/slug, payment id, tx hash
- aggregate treasury and reporting summaries
- Tier A compliance package summaries and exports

The backend must not store:

- decrypted employee salary amounts
- browser-local `decryptForView(...)` outputs
- employee-only allocation plaintext
- private permit secrets
- admin wallet private keys
- tax filing secrets or external authority credentials

## Core Routes

### Health and Status

- `GET /api/health`
- `GET /api/status`

### Indexed Read Models

- `GET /api/organizations`
- `GET /api/organizations/:orgId`
- `GET /api/organizations/:orgId/runs`
- `GET /api/organizations/:orgId/payments`
- `GET /api/payroll-runs/:payrollRunId`
- `GET /api/payments/:paymentId`
- `GET /api/audit-receipts`
- `GET /api/events`
- `GET /api/notifications`

### Reporting and Exports

- `GET /api/reports/organizations/:orgId/summary`
- `GET /api/reports/organizations/:orgId/treasury`
- `GET /api/reports/organizations/:orgId/audit-package`
- `GET /api/reports/organizations/:orgId/export`

### Batch Payroll

- `GET /api/organizations/:orgId/batch-payroll-manifests`
- `POST /api/batch-payroll-manifests`

Batch manifests are deliberately safe. They store role and transaction references, not salary amounts or CSV payloads.

### Compliance

- `GET /api/compliance/organizations/:orgId/package`
- `GET /api/compliance/organizations/:orgId/export`

Compliance packages are Tier A only. They include aggregate tax reserve policy, treasury posture, and audit receipt metadata. They are not tax filings, not authority API submissions, and not employee salary exports.

### CipherBot and Admin Operations

- `POST /api/cipherbot/query`
- `POST /api/admin/reindex`

`/api/admin/reindex` may require `CIPHERROLL_BACKEND_ADMIN_TOKEN` when configured.

## Filter Support

Current filters include:

- payroll runs by `status`
- organization payments by `claimState` and `settlementState`
- batch payroll manifests by `payrollRunId`
- audit receipts by `published` and `receiptKind`
- notifications by `category` and `severity`
- compliance exports by `taxReserveBps` and `format=csv`

## Shared SDK Access

The shared SDK in `packages/cipherroll-sdk` exposes the backend client used by frontend surfaces:

- `CipherRollBackendClient`
- `getHealth()`
- `getStatus()`
- `getOrganizations()`
- `getOrganization()`
- `getOrganizationRuns()`
- `getOrganizationPayments()`
- `getPayrollRun()`
- `getPayment()`
- `getBatchPayrollManifests()`
- `createBatchPayrollManifest()`
- `getAuditReceipts()`
- `getEvents()`
- `getNotifications()`
- `getOrganizationReportSummary()`
- `getTreasuryExposureSummary()`
- `getCompliancePackage()`
- `getOrganizationAuditPackage()`
- `getOrganizationExportPackage()`
- `queryCipherBot()`
- `reindex()`

This keeps frontend, backend, docs, and scripts aligned around one typed API surface.

## Environment

The backend reads the repo-root `.env` file and uses:

- `ARBITRUM_SEPOLIA_RPC_URL`
- `NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_CIPHERROLL_AUDITOR_DISCLOSURE_ADDRESS`
- `NEXT_PUBLIC_CIPHERROLL_GOVERNANCE_ADDRESS`

Optional backend-specific settings:

- `CIPHERROLL_BACKEND_HOST`
- `CIPHERROLL_BACKEND_PORT`
- `CIPHERROLL_BACKEND_BASE_URL`
- `CIPHERROLL_DATABASE_URL`
- `CIPHERROLL_DATABASE_SSL`
- `CIPHERROLL_INDEXER_START_BLOCK`
- `CIPHERROLL_INDEXER_POLL_INTERVAL_MS`
- `CIPHERROLL_INDEXER_CHUNK_SIZE`
- `CIPHERROLL_BACKEND_ADMIN_TOKEN`
- `NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL`
- `GOOGLE_API_KEY`
- `GOOGLE_GEMINI_MODEL`

`GOOGLE_API_KEY` enables Gemini-backed CipherBot answers. CipherBot remains read-only even when Gemini is available.

## Commands

From the repo root:

```bash
npm run build:backend
npm run sync:backend
npm run start:backend
```

For local development:

```bash
npm run dev:backend
```

Useful verification:

```bash
curl http://127.0.0.1:4000/api/health
curl http://127.0.0.1:4000/api/status
```

## Final Wave 5 Responsibilities

### Governance Indexing

The backend indexes governance events so the frontend can display proposal activity and status. Governance remains an on-chain execution boundary, not a backend permission shortcut.

### Treasury Exposure

The backend packages:

- route health
- available treasury inventory
- reserved treasury inventory
- payout backlog
- active and funded run exposure
- pending wrapper finalization state
- route safety notes

This is an operational report, not a salary disclosure report.

### Batch Payroll Manifests

The frontend submits a manifest after each confirmed batch row. The backend stores only safe metadata:

- org id
- payroll run id
- employee address
- role slug and role label
- payment id
- transaction hash

CSV parsing, salary selection, and CoFHE sealing remain browser-local.

### Compliance Packages

Compliance packages combine:

- aggregate organization report
- treasury exposure summary
- operator-selected tax reserve basis points
- estimated aggregate reserve amount
- verify/publish receipt counts
- recent audit receipt metadata
- explicit safety notes

They intentionally exclude employee salary rows and do not integrate with any real tax authority.

### CipherBot Context

The backend can provide CipherBot with:

- indexed organization summaries
- pending claims and finalizations
- treasury route state
- status/indexer health
- docs and product guidance context

CipherBot cannot create, fund, reserve, activate, approve, execute, claim, finalize, disclose, or publish anything for the user.

## Notes

- If `CIPHERROLL_INDEXER_START_BLOCK` is not set, the backend derives a reasonable backfill start point from the existing live-smoke transaction outputs in `outputs/`.
- Payment projections intentionally avoid employee-only getters.
- Reporting and exports remain aggregate-first.
- Permit/share flows stay browser-local and use modern CoFHE permit semantics.
- The backend is a support layer for CipherRoll’s verified Wave 5 product, not a replacement for wallet-controlled execution.
