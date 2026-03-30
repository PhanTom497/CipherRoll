# CipherRoll Wave 1 QA Checklist

Use this checklist before treating the Wave 1 buildathon submission as demo-ready.

Detailed browser QA lives in `docs/FRONTEND_MANUAL_QA.md`.

## Pre-flight

- root dependencies install
- web dependencies install
- `.env` exists
- `NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS` is set after deploy
- admin wallet available
- employee wallet available

## Landing Page

- branding says CipherRoll everywhere
- FHE/Fhenix copy is consistent
- existing premium design still feels intact
- links to admin, employee, docs, and future-wave previews all work

## Admin Portal

- wallet connects on Ethereum Sepolia
- workspace creation works
- treasury adapter configuration works
- budget deposit works
- payroll issuance works
- admin summary handles appear
- permit button works

## Employee Portal

- wallet connects
- permit generation works
- employee handle refresh works
- only employee-owned allocations are visible
- no transparent record language remains in the UI

## Docs

- Wave 1 scope is explicit
- Wave 2 and Wave 3 are clearly staged
- local setup commands are accurate
- architecture notes reflect the implemented code
- docs read like part of the buildathon submission, not leftover engineering notes

## Preview Portals

- auditor page reads as a polished Wave 2 preview
- treasury page reads as a polished Wave 3 preview
- neither page pretends unfinished functionality already exists

## Final Sign-Off

- no transparent-chain-specific terminology remains in user-facing copy
- no transparent wallet records or local claim queues remain in functional paths
- the repo tells one coherent CipherRoll Wave 1 story
