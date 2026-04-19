# CipherRoll 

<div align="center">
  <h3>Private Payroll. Blind Execution.</h3>
  <p>Confidential payroll infrastructure for Arbitrum Sepolia and Base Sepolia.</p>
</div>

---

**[🌐 Live Application](https://cipher-roll.vercel.app/)** | **[📚 Official Documentation](https://cipher-roll.vercel.app/docs)** | **[🎥 Video Demo](https://youtu.be/HryZFOa2eUY)**

---

## 🔒 What is CipherRoll?

CipherRoll is a confidential payroll application built for the latest official **CoFHE (Coprocessor for Fully Homomorphic Encryption)** workflow on **Arbitrum Sepolia** and **Base Sepolia**.

CipherRoll eliminates the need for transparent ledgers or clunky off-chain ZK provers. Instead, organizations deposit funds and issue payroll salaries into **mathematically encrypted states**. The host chain (EVM) computes the additions and subtractions natively over these ciphertexts without ever decrypting the underlying values.

## ✨ Core Features

- **True Confidentiality:** Salary amounts and budget summaries remain hidden on-chain.
- **Blind Computation:** EVM nodes execute payroll logic (`FHE.add`, `FHE.sub`) natively on ciphertexts.
- **Synchronized Encrypted State:** CipherRoll keeps payroll state in encrypted contract storage instead of relying on user-side record syncing.
- **Client-Side Permit-Backed Decryption:** Employees decrypt their specific allocations directly in the browser via `@cofhe/sdk` using `decryptForView()`, without relying on trusted backend proxies.
- **Explicit SDK Workflow:** CipherRoll encrypts inputs with `encryptInputs()` and is positioned to extend selective-disclosure flows with `decryptForTx()`.
- **EIP-712 Permit Scoping:** Encrypted state access is safeguarded by cryptographically secure permits verified inside the CoFHE TaskManager.

## 🔎 Current Privacy Boundary

- **Private today:** encrypted budget, committed payroll, available runway, and per-employee allocation amounts.
- **Visible today:** organization ids, admin and employee wallet addresses involved in transactions, payment ids, memo hashes, vesting timestamps, payroll-run status, funding deadlines, and claim/finalization transactions.
- **Asset being tracked today:** the app currently tracks encrypted host-chain payroll amounts shown in the UI as `ETH`-denominated values on the configured testnet.
- **Current settlement path:** when a workspace treasury adapter is configured, CipherRoll can now either release a token directly from treasury or use the official FHERC20 wrapper route. Wrapper-backed payouts follow a two-step flow: request confidential unshielding first, then finalize the wrapper claim to release the underlying token.
- **Practical summary:** CipherRoll now supports real treasury-backed payout delivery, including an FHERC20 wrapper-backed confidential settlement path.
- **Auditor disclosure boundary:** auditor access is now aggregate-only and shared-permit based. Admins can export a non-sensitive sharing payload for a named auditor recipient, and the auditor can import it to decrypt only aggregate budget / commitment / runway handles that already have on-chain `FHE.allow(...)` access. When a review needs defensible evidence, the auditor portal can move either one shared aggregate or a selected batch of aggregate metrics from viewable to provable through `decryptForTx` plus on-chain verify / publish receipts. Removing a permit from one browser session is only a local revoke aid; expiration and narrow scope remain the primary controls.
- **Audit mode clarity:** CipherRoll now distinguishes two auditor paths in plain language: `view-only permit review`, where decrypted aggregates stay local in the auditor browser, and `provable receipt mode`, where the same shared aggregates produce an on-chain verify or publish receipt.

## 🏗️ Architecture Flow

```mermaid
sequenceDiagram
    participant Admin
    participant CipherRoll Contract
    participant CoFHE Network
    participant Employee
    
    Admin->>CipherRoll Contract: Create Workspace & Deposit (Encrypted Budget)
    Admin->>CipherRoll Contract: Issue Payroll (Encrypted Amount)
    CipherRoll Contract->>CoFHE Network: Request FHE.sub(Budget, Amount)
    CoFHE Network-->>CipherRoll Contract: Return New Encrypted State
    CipherRoll Contract->>CipherRoll Contract: Update State & Grant FHE.allow(Employee)
    Employee->>CipherRoll Contract: Generate EIP-712 Permit
    CipherRoll Contract-->>Employee: Return Encrypted Handle
    Employee->>Employee: client.decryptForView(ctHash, type).execute()
```

## 🚀 Quick Setup

1. **Install Dependencies**
   ```bash
   npm install
   cd web && npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Ensure your Arbitrum Sepolia or Base Sepolia RPC and keys are configured
   ```

3. **Smart Contract Deployment**
   ```bash
   npm run compile
   npm run deploy:arb-sepolia
   ```

4. **Verify the Engineering Baseline**
   ```bash
   npm run baseline
   ```

5. **Launch Application**
   ```bash
   cd web
   npm run dev
   ```

## 📚 Technical Documentation

- [System Architecture](./docs/ARCHITECTURE.md)
- [Product Roadmap](./docs/ROADMAP.md)
- [Testing & QA](./docs/TESTING.md)
- [Frontend QA Guide](./docs/FRONTEND_MANUAL_QA.md)

## 🛡️ Security Model

CipherRoll leverages `@fhenixprotocol/cofhe-contracts` to handle operational lifecycles on Arbitrum Sepolia and Base Sepolia. We ensure that **"Blind Computation"** protects your organization's financial strength from malicious validators, metadata leakage, and unauthorized handle scraping via open RPCs.

---
*Built during the Fhenix Buildathon using the CoFHE stack on Arbitrum Sepolia and Base Sepolia.*
