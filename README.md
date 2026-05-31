# CipherRoll

<div align="center">

## Private Payroll. Blind Execution.

**CipherRoll** is a confidential payroll system built on **Fhenix CoFHE** for **Arbitrum Sepolia**.

It combines **encrypted on-chain payroll state**, **real treasury-backed settlement**, **M-of-N governance for sensitive actions**, **browser-local batch payroll**, **aggregate-only audit review**, **Tier A compliance exports**, and a backend application layer for reporting, notifications, exports, and operator support.

[Live App](https://cipher-roll.vercel.app/) · [Docs](https://cipher-roll.vercel.app/docs) · [Demo Video](https://youtu.be/uBAilNYfFIw)

</div>

---

## Highlights

- 🔐 **Encrypted payroll core:** salary amounts, budget state, committed payroll, and runway-sensitive values stay encrypted on-chain as CoFHE handles.
- 💸 **Real payout flow:** CipherRoll does not stop at bookkeeping. Payroll can move through treasury-backed settlement and reach a real employee payout path.
- 🧾 **Aggregate-only auditing:** auditors review organization-level summaries without receiving employee salary rows.
- 🛡️ **Governed sensitive execution:** payroll issuance, vesting issuance, treasury route changes, governance membership, and quorum updates route through M-of-N governance.
- 📦 **Batch payroll v1:** browser-local CSV import, row validation, salary sealing, retryable row transactions, and safe backend manifests.
- 📡 **Backend reporting layer:** the frontend runs with indexed summaries, treasury exposure, compliance packages, status APIs, exports, notifications, and support-oriented APIs.
- 🧠 **In-product support:** CipherBot is live across docs and product portals to answer workflow and product questions in context.
- ☁️ **Hosted submission stack:** Vercel frontend, Render backend, and Supabase-backed Postgres persistence.

---

## What CipherRoll Solves

Traditional on-chain payroll leaks too much:

- salary amounts become inferable
- treasury posture becomes visible
- employee payout events become easy to link
- audit workflows often reveal more than they need to

CipherRoll is designed to keep the **financial core private** while staying honest about what still becomes public on the host chain.

### Private by design

- encrypted organization budget
- committed payroll
- remaining available budget / runway
- employee allocation amounts
- aggregate disclosure handles
- wrapper-backed confidential balances before request/finalize decryption

### Still public or inferable

- wallet addresses
- organization ids and submitted labels
- payroll-run states
- deadlines and timestamps
- claim / finalize transactions
- wrapper settlement amount once a `decryptForTx` proof is submitted on-chain

CipherRoll does **not** claim that all metadata disappears. It claims a narrower and more useful property: the **sensitive financial values stay encrypted**, while the product remains truthful about the public traces that still exist.

---

## Final Wave 5 Product Snapshot

Wave 5 is the final verified product wave for this roadmap. It completes the confidential payroll core with governance, batch operations, treasury hardening, compliance packaging, and backend-assisted product support.

### Shipped in this submission

- ✅ confidential payroll workflow from workspace funding to employee claim
- ✅ explicit payroll-run lifecycle with funding and activation gates
- ✅ treasury-backed direct settlement path
- ✅ FHERC20 wrapper-backed payout path
- ✅ local employee decrypt and claim / finalize flow
- ✅ aggregate-only auditor permit review
- ✅ verify / publish audit receipts
- ✅ M-of-N governance for sensitive admin actions
- ✅ browser-local batch payroll with sealed salaries and retryable row submissions
- ✅ treasury exposure reporting with route health and payout backlog
- ✅ Tier A aggregate compliance package and JSON/CSV exports
- ✅ indexed backend reporting and export APIs
- ✅ workflow notifications and operational summaries
- ✅ shared SDK for runtime config, backend clients, and product types
- ✅ retrieval-backed CipherBot in docs and product portals
- ✅ hosted stack with durable backend persistence

### Why the final wave matters

Earlier waves proved the confidential payroll protocol, settlement path, auditor receipts, and backend layer.  
Wave 5 proves that CipherRoll can behave like a **complete operator-facing product**:

- the frontend no longer depends only on ad hoc contract inspection
- operators now have reporting and export surfaces
- admins and auditors now have indexed workflow context
- sensitive execution has an M-of-N governance boundary
- batch payroll is practical without uploading salaries to the backend
- treasury and compliance surfaces stay aggregate-first
- the hosted deployment behaves much closer to the local product

---

## Product Surfaces

CipherRoll currently ships the following user-facing routes:

| Surface | Route | Purpose |
| --- | --- | --- |
| Landing page | `/` | Product story and submission framing |
| Admin portal | `/admin` | Workspace setup, budget funding, payroll management, reporting, and auditor sharing |
| Employee portal | `/employee` | Local decrypt, payroll review, claim, and wrapper-finalize flow |
| Auditor portal | `/auditor` | Permit import, aggregate review, and audit receipt workflow |
| Docs | `/docs` | Product documentation, roadmap, reference, and support context |
| Tax compliance page | `/tax-authority` | Tier A aggregate compliance package, tax reserve policy, and receipt evidence export |

---

## Core Workflow

### Admin flow

1. Connect admin wallet on **Arbitrum Sepolia**
2. Initialize **CoFHE**
3. Create workspace / organization
4. Fund encrypted organization budget
5. Configure treasury route
6. Create payroll run
7. Issue confidential allocations through governed one-row flow or non-governed batch workspace
8. Reserve treasury-backed run funding
9. Activate claims
10. Review treasury exposure, notifications, compliance packages, and exports

### Employee flow

1. Connect employee wallet
2. Create or reuse local permit session
3. Review payroll allocations
4. Decrypt data locally in the browser
5. Claim payroll
6. Finalize wrapper-backed payout when the route requires it

### Auditor flow

1. Import admin-shared recipient permit payload
2. Activate permit locally
3. Review aggregate-only organization metrics
4. Decrypt only the allowed summary values
5. Generate verify or publish receipts when evidence is needed

---

## Architecture Overview

```mermaid
flowchart TD
    A[Admin Portal] --> B[CipherRollPayroll]
    C[Employee Portal] --> B
    D[Auditor Portal] --> E[CipherRollAuditorDisclosure]

    A --> F["CoFHE SDK"]
    C --> F
    D --> F
    F --> G[CoFHE Network]

    B --> H[Encrypted Budget Handles]
    B --> I[Payroll Run State]
    B --> J[Employee Allocation Handles]
    B --> K[Treasury Route]

    E --> L[Aggregate Disclosure Getters]
    E --> M[Verify / Publish Receipt Functions]

    K --> N[Direct Settlement Adapter]
    K --> O[Wrapper Settlement Adapter]
    O --> P[Settlement Token]

    A --> Q[CipherRoll Backend]
    D --> Q
    Q --> R[Supabase Postgres]
```

### Main building blocks

- **Contracts:** confidential payroll and auditor disclosure logic
- **Frontend:** admin, employee, auditor, docs, and tax-facing surfaces
- **Backend:** indexed read models, notifications, summaries, treasury exposure, compliance packages, exports, and support APIs
- **Shared SDK:** runtime config, backend client, shared product types, and cross-surface helpers
- **Database:** Supabase-backed Postgres for hosted persistence

---

## Current Hosted Stack

| Layer | Current stack |
| --- | --- |
| Frontend hosting | **Vercel** |
| Backend hosting | **Render** |
| Backend persistence | **Supabase Postgres** |
| Chain target | **Arbitrum Sepolia** |
| Privacy execution | **Fhenix CoFHE** |
| Browser decrypt path | **`@cofhe/sdk`** |

This is important for the final Wave 5 build because CipherRoll is no longer a frontend-only delivery. The deployed product depends on the frontend, backend, and database layers all being in place.

---

## Contracts and Deployment Values

Current **Arbitrum Sepolia** deployment:

| Contract | Address |
| --- | --- |
| `CipherRollPayroll` | `0xDDE597a07fdBFb489c865f1B1f01aA633Ff4f9A7` |
| `CipherRollGovernance` | `0xE4Fd9d1Df1c8EeD3a91AF3C832BFA8eCF3210cCC` |
| `CipherRollAuditorDisclosure` | `0x3e84af37DddBdff7e2Cb2aAe4f1c5347d22890e9` |
| `DirectSettlementAdapter` | `0x8Aec7daF18A47026E0a3aC0ad3A939Ee824882D8` |
| `WrapperSettlementAdapter` | `0xa32df000E716B795B53cE925e78e0374Dd966b85` |

Deployment metadata:

- [outputs/arb-sepolia-deployment.json](./outputs/arb-sepolia-deployment.json)

---

## Local Development

### 1. Install dependencies

```bash
npm install
cd web
npm install
cd ..
```

### 2. Start the backend

```bash
npm run dev:backend
```

### 3. Start the web app

```bash
cd web
npm run dev
```

### 4. Useful quality checks

```bash
npm run compile
npm run test
npm run build:web
npm run build:backend
```

---

## Repository Guide

| Path | Purpose |
| --- | --- |
| `contracts/` | Core CipherRoll contracts and settlement adapters |
| `backend/` | Node.js backend service, indexer, API routes, and database layer |
| `packages/cipherroll-sdk/` | Shared runtime config, backend client, types, and helpers |
| `web/` | Next.js frontend for landing page, portals, docs, and CipherBot |
| `docs/` | Architecture, roadmap, testing, QA, privacy, and supporting references |
| `outputs/` | Deployment metadata and network output artifacts |

---

## Documentation Map

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — system design, backend layer, privacy boundaries, and hosted stack
- [docs/ROADMAP.md](./docs/ROADMAP.md) — wave-by-wave product progression through the completed final Wave 5 roadmap
- [docs/TESTING.md](./docs/TESTING.md) — verification flow for contracts, frontend, backend, and hosted submission behavior
- [docs/FRONTEND_MANUAL_QA.md](./docs/FRONTEND_MANUAL_QA.md) — frontend validation checklist
- [docs/PRIVACY_MATRIX.md](./docs/PRIVACY_MATRIX.md) — private vs public values and disclosure boundaries

---

## Scope Boundaries

### Shipped now

- confidential payroll
- treasury-backed settlement
- wrapper-backed payout flow
- aggregate-only auditor review
- audit receipts
- backend reporting and exports
- governed sensitive actions
- batch payroll authoring and retryable submission
- treasury exposure reporting
- Tier A aggregate compliance packages
- workflow notifications
- portal-integrated CipherBot

### Intentionally deferred

- full tax automation
- real tax authority integrations
- multi-jurisdiction tax modeling
- multi-network rollout
- enterprise auth / role server model
- action-taking AI assistants

---

## Why This Submission Is Strong

CipherRoll’s final Wave 5 submission is not only a protocol demo and not only a UI demo.

It now demonstrates:

- **confidential value handling**
- **real payroll settlement**
- **truthful privacy framing**
- **auditor-safe selective disclosure**
- **backend-assisted operator visibility**
- **governed execution boundaries**
- **batch payroll and compliance workflows**
- **hosted full-stack deployment**

That combination is what makes the project feel like a serious confidential payroll product rather than a collection of isolated features.
