# CipherRoll Production QA Checklist

Use this checklist before authorizing a stable production or testnet deployment of the CipherRoll protocol.

Detailed browser QA lives in `docs/FRONTEND_MANUAL_QA.md`.

## Pre-flight Engine Check

- root dependencies installed securely
- web dependencies installed securely
- `.env` configured properly
- `NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS` is accurately mapped after deployment
- admin operational multisig/wallet provisioned
- employee test wallets available

## Landing Page & Global Routing

- branding reads as purely `CipherRoll`
- FHE/CoFHE copy is consistent and accurate
- premium glassmorphism design renders at all breakpoints
- links to admin, employee, docs, and feature-preview routes resolve correctly

## Admin Workspace

- wallet binds to EVM successfully via injected provider
- organizational workspace mints on-chain
- treasury adapter routing parameters save accurately
- encrypted budget injection operations commit successfully
- confidential payroll push allocations execute without revert
- encrypted admin summary handles appear dynamically via data polling
- EIP-712 security permit generation operates seamlessly

## Employee Workspace

- employee wallet binds to EVM securely
- local cache EIP-712 permit generation succeeds
- employee handle refresh sequence pulls directly from contract state
- rigid visibility limits remain in place (only employee-owned allocations load)
- WASM decryption via `cofhejs` drops ciphertexts to plaintext seamlessly

## Documentation

- architectural documentation is entirely up-to-date
- roadmap accurately details current deployment vs. future compliance flows
- local setup and build commands are tested
- all technical notes reflect the `InEuint128` data structure currently implemented

## Final Sign-Off

- no legacy transparent-chain terminology remains in user-facing copy
- no unencrypted local tracking logic remains functional
- the repository delivers a single, frictionless privacy-first payroll experience
