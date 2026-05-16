# CipherRoll Backend Foundation

This backend is the first implementation slice of Phase 4 Priority 11.

It adds:

- a small Node.js + TypeScript backend service
- a local SQLite-backed indexed read layer
- normalized organization / payroll-run / payment / audit-receipt projections
- clean REST read APIs
- an authenticated reindex endpoint for operator/admin use
- a stable shared SDK client surface for backend status and indexed read queries

It does **not** replace wallet-local privacy or client-side decrypt flows. The backend indexes public chain state and compliance-safe projections only.

## Routes

- `GET /api/health`
- `GET /api/status`
- `GET /api/organizations`
- `GET /api/organizations/:orgId`
- `GET /api/organizations/:orgId/runs`
- `GET /api/organizations/:orgId/payments`
- `GET /api/payroll-runs/:payrollRunId`
- `GET /api/payments/:paymentId`
- `GET /api/audit-receipts`
- `GET /api/events`
- `GET /api/notifications`
- `GET /api/reports/organizations/:orgId/summary`
- `GET /api/reports/organizations/:orgId/audit-package`
- `GET /api/reports/organizations/:orgId/export`
- `POST /api/cipherbot/query`
- `POST /api/admin/reindex`

Current filter support includes:

- payroll runs by `status`
- organization payments by `claimState` and `settlementState`
- audit receipts by `published` and `receiptKind`
- notifications by `category` and `severity`

## Shared SDK Access

Phase 4 Priority 12 adds a reusable backend client in `packages/cipherroll-sdk`:

- `CipherRollBackendClient`
- `getHealth()`
- `getStatus()`
- `getOrganizations()`
- `getOrganization()`
- `getOrganizationRuns()`
- `getOrganizationPayments()`
- `getPayrollRun()`
- `getPayment()`
- `getAuditReceipts()`
- `getEvents()`
- `getNotifications()`
- `getOrganizationReportSummary()`
- `getOrganizationAuditPackage()`
- `getOrganizationExportPackage()`
- `queryCipherBot()`
- `reindex()`

This gives future frontend/backend integrations one stable query layer instead of hand-written fetch calls per surface.

## Environment

The backend reads the repo-root `.env` file and uses:

- `ARBITRUM_SEPOLIA_RPC_URL`
- `NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_CIPHERROLL_AUDITOR_DISCLOSURE_ADDRESS`

Optional backend-specific settings:

- `CIPHERROLL_BACKEND_HOST`
- `CIPHERROLL_BACKEND_PORT`
- `CIPHERROLL_BACKEND_BASE_URL`
- `CIPHERROLL_BACKEND_DB_PATH`
- `CIPHERROLL_INDEXER_START_BLOCK`
- `CIPHERROLL_INDEXER_POLL_INTERVAL_MS`
- `CIPHERROLL_INDEXER_CHUNK_SIZE`
- `CIPHERROLL_BACKEND_ADMIN_TOKEN`
- `NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL`
- `GOOGLE_API_KEY` (optional, enables real LLM-backed free-form CipherBot answers)
- `GOOGLE_GEMINI_MODEL` (optional)

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

## Notes

- If `CIPHERROLL_INDEXER_START_BLOCK` is not set, the backend derives a reasonable backfill start point from the existing live-smoke transaction outputs in `outputs/`.
- Payment projections intentionally avoid employee-only getters. The backend indexes what is public and contract-readable without violating CipherRoll's privacy boundary.
- Reporting and exports remain aggregate-first. They package run-state, treasury, notification, and audit evidence context without exposing employee plaintext salary rows.
- CipherBot queries stay support-oriented. The backend can enrich answers with indexed organization and status context, and if `GOOGLE_API_KEY` is configured it can also use a Gemini model for shorter, more natural free-form answers. It does not execute sensitive payroll actions.
