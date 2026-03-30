# CipherRoll Roadmap

This roadmap is structured for the Fhenix buildathon rather than a one-shot feature dump.

## Wave 1: FHE-Native MVP

Status: Implemented in this repo

Delivered:

- pure Fhenix/EVM project scaffolding
- Wave 1 confidential payroll contract
- EVM wallet integration for the frontend
- admin workspace setup and encrypted budget flow
- employee permit-based allocation reads
- employee pull claims and vesting schedules
- docs-first buildathon framing
- preserved frontend design language with rewritten FHE copy

Not in Wave 1 on purpose:

- true multi-admin execution
- auditor permit sharing
- tax authority workflow
- advanced analytics

## Wave 2: Operational Controls

Status: Planned

Focus:

- turn reserved governance fields into real configurable `M-of-N`
- add approval proposals for payroll operations
- activate auditor selective disclosure with permits
- deepen treasury adapter integration

Target outcomes:

- `/auditor` becomes a functional workspace
- admin operations no longer rely on single-executor assumptions
- docs gain approval lifecycle diagrams and role matrix detail

## Wave 3: Full CipherRoll Goal

Status: Planned

Focus:

- expand from Wave 1 issuance to broader payroll coverage
- add treasury/compliance workspaces
- move toward the full ambition of the original payroll product, but in Fhenix-native form

Target outcomes:

- stronger compliance frameworks
- stronger Privara-backed settlement depth
- treasury and tax authority workspaces
- richer analytics and reporting surfaces

## Product Positioning Notes

Wave 1 is optimized for Akindo judging:

- small enough to be believable
- polished enough to demo cleanly
- documented enough for reviewers to understand the architecture quickly

Wave 2 and Wave 3 are where the deeper enterprise payroll surface should land.
