# CipherRoll Web App

This directory contains the Next.js frontend for CipherRoll.

## Wave 1 Functional Routes

- `/`
- `/admin`
- `/employee`
- `/docs`

## Preview Routes

- `/auditor`
- `/tax-authority`

## Responsibilities

The web app is responsible for:

- connecting an injected EVM wallet
- creating local view permits
- calling the Wave 1 payroll contract
- showing encrypted handle references
- attempting permit-based unseals for admin and employee views
- presenting the buildathon documentation experience

## Development

```bash
npm install
npm run dev
```

## Notes

- Wave 1 preserves the existing visual style while replacing the underlying trust model.
- Permit-based reads replace the old record-scan mindset.
- Later-wave roles are intentionally presented as polished previews instead of fake functionality.
