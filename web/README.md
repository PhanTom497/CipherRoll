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

- The shipped product surface is admin, employee, auditor, tax status, and docs.
- Permit-based reads replace the old record-scan mindset.
- Future selective-disclosure work will extend the same SDK flow with `decryptForTx()`.
- `/auditor` is a live aggregate-first review surface for shared permits and audit receipts.
- `/tax-authority` remains a roadmap/status page rather than a live compliance portal.
