# CipherRoll Web App

This directory contains the Next.js frontend for CipherRoll.

The active frontend is designed only for Arbitrum Sepolia deployments.

## Current Functional Routes

- `/`
- `/admin`
- `/employee`
- `/docs`

## Additional Routes

- `/auditor`
- `/tax-authority`

## Responsibilities

The web app is responsible for:

- connecting an injected EVM wallet
- creating local view permits
- calling the current payroll contract
- showing encrypted handle references
- executing permit-backed `decryptForView()` reads for admin and employee views
- presenting the current product and documentation experience

## Development

```bash
npm install
npm run dev
```

## Notes

- The shipped product surface is admin, employee, auditor, tax compliance, and docs.
- Permit-based reads replace the old record-scan mindset.
- Evidence workflows extend the same SDK flow with deliberate `decryptForTx()` receipt generation.
- `/auditor` is a live aggregate-first review surface for shared permits and audit receipts.
- `/tax-authority` is a Tier A aggregate compliance package route, not a filing or external authority integration.
