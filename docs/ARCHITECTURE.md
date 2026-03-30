# CipherRoll Architecture

## System Overview

CipherRoll Wave 1 is a confidential payroll MVP built on Fhenix-compatible EVM infrastructure.

CipherRoll uses:

- encrypted contract state for budget and payroll aggregates
- permit-based reads for admin and employee views
- an EVM wallet flow for interaction
- a treasury adapter boundary that can grow into deeper stablecoin settlement later

## Wave 1 Components

### Contract Layer

File: `contracts/CipherRollPayroll.sol`

Responsibilities:

- create payroll organizations
- reserve storage for future multi-admin quorum expansion
- configure a treasury adapter boundary
- accept Wave 1 budget deposits
- issue confidential push payroll allocations
- expose encrypted admin summary handles
- expose employee-scoped encrypted allocation handles

### Frontend Layer

Directory: `web/`

Wave 1 functional routes:

- `/`
- `/admin`
- `/employee`
- `/docs`

Wave 1 preview routes:

- `/auditor`
- `/tax-authority`

Responsibilities:

- EVM wallet connection
- organization setup and budget ops
- permit generation
- encrypted handle display
- employee-side allocation reads
- buildathon-ready docs presentation

### Treasury Adapter Layer

Files:

- `contracts/interfaces/ITreasuryAdapter.sol`
- `contracts/mocks/Wave1TreasuryAdapter.sol`

Purpose:

- establish the boundary where Privara-backed confidential settlement can plug in later
- keep Wave 1 architecture extensible without pretending full settlement depth already exists

## Data Model

### Organization

Public organization metadata:

- admin address
- treasury adapter address
- treasury route id
- metadata hash
- reserved admin slot count
- reserved quorum count

Encrypted organization state:

- payroll budget
- committed payroll total
- remaining available budget

### Payroll Allocation

Each allocation stores:

- employee wallet
- payment id
- memo hash
- creation timestamp
- encrypted allocation amount

Wave 1 supports admin-issued push allocations only.

## Privacy Model

### Admin

Wave 1 admin can:

- create the workspace
- deposit encrypted budget
- configure treasury routing
- issue payroll allocations
- unseal aggregate budget summary handles with a local permit

### Employee

Wave 1 employee can:

- connect an EVM wallet
- generate a local permit
- fetch only their own encrypted payroll handles
- attempt to unseal only those handles

### Auditor And Treasury Roles

Wave 1 keeps these as product previews.

Reason:

- the buildathon MVP is intentionally scoped to a trustworthy single admin-to-employee flow
- selective disclosure and compliance surfaces are more credible in Wave 2 and Wave 3 than as half-built MVP features

## Why FHE Changes The Product Shape

CipherRoll utilizes encrypted shared state:

- sensitive amounts live in encrypted contract state
- participants read through handles, rather than transparent records
- permits become the interface for selective disclosure
- the UI computes operational truth completely from on-chain FHE execution

## Known Wave 1 Constraints

- execution is single-admin even though storage reserves space for later quorum support
- budget inputs are plain integers for simpler MVP ergonomics, then encrypted on-chain
- treasury settlement is represented as an adapter boundary rather than full Privara workflow depth
- pull claims, vesting, tax flows, and auditor disclosure are deferred intentionally
