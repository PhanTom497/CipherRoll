# CipherRoll

**Confidential payroll and treasury operations on Fhenix.**

CipherRoll is the FHE-native payroll application. This Wave 1 buildathon version focuses on a clean, credible MVP:

- pure EVM/Fhenix workspace
- encrypted payroll budget and aggregate state
- confidential payroll issuance (standard and vesting)
- employee pull claims and permit-based reads
- docs-first submission quality for Akindo

## Wave 1 Scope

Live in this repo today:

- `CipherRollPayroll.sol` Wave 1 contract
- EVM wallet-based admin and employee portals
- treasury adapter boundary for later Privara settlement depth
- documentation route and repo docs aligned to the staged roadmap

Deferred intentionally:

- true `M-of-N` execution
- auditor permit sharing
- tax authority workflows
- richer treasury analytics

Those move into Wave 2 and Wave 3 rather than bloating the Wave 1 submission.

## Why FHE

CipherRoll moves the architecture toward encrypted shared state on Fhenix, where:

- contract state stays confidential on-chain
- wallets unseal only authorized views
- permits become the read primitive
- the product allows selective disclosure without rebuilding around record ownership

## Project Layout

```text
CipherRoll/
├── contracts/              # Wave 1 Fhenix/EVM contracts
├── ignition/               # Deployment module
├── test/                   # Hardhat test scaffolding
├── web/                    # Next.js frontend
├── docs/                   # Repo-level architecture, roadmap, and testing docs
├── hardhat.config.ts
└── package.json
```

## Local Setup

1. Install dependencies:

```bash
npm install
cd web && npm install
```

2. Create env files:

```bash
cp .env.example .env
```

3. Compile and deploy:

```bash
npm run compile
npm run deploy:sepolia
```

4. Run the frontend:

```bash
cd web
npm run dev
```

## Wave Plan

- **Wave 1:** FHE-native MVP with docs, admin issuance, employee permit reads, pull claims, and vesting
- **Wave 2:** true admin quorum, auditor selective disclosure, deeper treasury handling
- **Wave 3:** broader payroll parity including compliance workspaces

## Docs

- [Architecture](./docs/ARCHITECTURE.md)
- [Roadmap](./docs/ROADMAP.md)
- [Testing](./docs/TESTING.md)
- [Checklist](./CHECKLIST.md)
