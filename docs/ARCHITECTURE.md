# CipherRoll Architecture

## 🌐 System Overview

CipherRoll is built to provide operational privacy for payroll management using the official **CoFHE (Coprocessor for Fully Homomorphic Encryption)** architecture on **Arbitrum Sepolia**.

Unlike traditional blockchain applications where state is plaintext, or early privacy protocols relying on isolated ZK-SNARK provers, CipherRoll processes all financial logic directly on the EVM using encrypted variables (`euint128`).

```mermaid
graph TD
    A[Admin Web UI] -->|Encrypted Deposits & Allocations| B(CipherRollPayroll.sol)
    C[Employee Web UI] -->|EIP-712 View Permits| B
    B <-->|Homomorphic Math| D{CoFHE Coprocessor}
    C -->|Encrypted Handles| E[Browser @cofhe/sdk Client]
    E -->|Local decryptForView() / future decryptForTx()| F((Employee Dashboard))
```

## 🧩 Core Components

### 1. Smart Contract Layer (`CipherRollPayroll.sol`)
The fundamental backend orchestrator for the current supported deployment target: Arbitrum Sepolia.
- **State Management:** Manages organizational metadata and encrypted variables (`_encryptedBudget`, `_encryptedAvailable`, `_encryptedCommitted`).
- **Encrypted Math:** Uses `FHE.add`, `FHE.sub`, and `FHE.select` to update balances without revealing values.
- **Access Control:** Implements explicit visibility logic using `FHE.allowThis()` and `FHE.allow()`.

### 2. Client-Side Decryption (`@cofhe/sdk`)
CipherRoll uses `createCofheConfig(...)`, `createCofheClient(...)`, and `client.connect(...)` to bind an injected browser wallet to the CoFHE network through the current `@cofhe/sdk` builder-pattern API.
- **Encryption:** Payroll and budget inputs are prepared via `client.encryptInputs([...]).execute()` before contract submission.
- **Decryption:** Encrypted handles pulled from the contract are decrypted locally with `client.decryptForView(...)`. Phase 2 selective-disclosure flows will extend this with `client.decryptForTx(...)`.
- **Synchronized State:** The current product reads encrypted contract state directly instead of depending on user-managed record syncing.

### 3. Current Product Boundary
- The shipped web app and contract now cover organization setup, encrypted budget management, payroll-run lifecycle management, treasury-backed settlement, FHERC20 wrapper payouts, employee self-service reads/claims, aggregate-first auditor review, and verifiable audit receipts.
- Tax authority workflows, automated withholding, and on-chain M-of-N governance remain roadmap work and are not active product flows yet.

### 4. What Is Private vs Public Right Now
- **Private:** `_encryptedBudget`, `_encryptedCommitted`, `_encryptedAvailable`, and each allocation's encrypted amount handle.
- **Public metadata:** workspace ids, admin wallet, employee wallet, payment ids, memo hashes, vesting timestamps, payroll-run lifecycle state, funding deadlines, and claim/finalization transactions.
- **Settlement boundary:** the current product can now release a live token balance when a workspace treasury adapter is configured, including an FHERC20 wrapper-backed path that requests an unshield first and then finalizes payout with `claimUnshielded`.
- **Asset interpretation:** payroll allocations remain encrypted in CipherRoll. Treasury-backed settlement assets and wrapper-backed confidential balances are now supported through the contract and admin surface. For the FHERC20 wrapper path, the confidential balance stays private until the employee finalizes the unshielded payout, at which point the underlying token amount becomes public on-chain.
- **Auditor selective disclosure:** the auditor portal imports a shared permit and decrypts only organization-level budget / committed / available handles plus public compliance-safe summary fields. Employee salary rows, employee allocation handles, and unnecessary PII are intentionally excluded from the contract-side auditor surfaces.
- **Provable audit receipts:** when an auditor needs cryptographically defensible evidence rather than a view-only disclosure, CipherRoll now supports `decryptForTx` on the shared aggregate handles and narrow on-chain receipt functions that either verify or publish one selected aggregate metric at a time, or a selected batch of aggregate metrics in one transaction.
- **Mode separation:** the product now treats permit-based view review and provable receipt generation as two different disclosure modes. View mode keeps decrypted aggregates local to the browser; verify/publish mode records evidence on-chain for the chosen aggregate metric or batch.

## 🗄️ Data Model

### Organization State
- `admin`: The current operational wallet.
- `metadataHash`: IPFS or deterministic hash referencing off-chain organization mapping.
- **Encrypted State:** `_encryptedBudget`, `_encryptedCommitted`, `_encryptedAvailable`.

### Payroll Allocation State
- `employee`: The recipient wallet address.
- `paymentId`: A deterministic Keccak256 hash preventing duplicate processing.
- `encryptedAmount`: The exact salary disbursement, encrypted globally and allowed only to the recipient.
- `isVesting`: Boolean determining if the allocation unlocks linearly or instantly.

## 🔐 Advanced Privacy Handling

Access to encrypted state is strictly protected by cryptographically secure permits. 
In public blockchains, anyone can scrape open RPCs. In CipherRoll, an explicitly signed EIP-712 permit is required, which is then verified by the **CoFHE TaskManager**. This protects encrypted values from open reads, but it does **not** make all transaction metadata private. Wallet addresses, ids, timestamps, and claim/finalization activity remain visible on the host chain.

### Auditor Sharing Model
- **Scope:** admins can share only the aggregate handles explicitly exposed by `getAuditorEncryptedSummaryHandles(...)` plus public compliance-safe organization summary data.
- **Prerequisite:** this sharing model still depends on prior on-chain `FHE.allow(...)` access granted by the data owner to those aggregate handles. Shared permits do not override admin-only salary getters or create new employee-level visibility.
- **Short-lived by design:** the current product uses explicit recipient addresses and permit expiration as the main disclosure controls.
- **Revocation honesty:** removing a sharing permit from the admin browser or removing a recipient permit from the auditor browser only clears that local wallet/browser session. It should be treated as a product-level revoke aid, not a universal remote invalidation of every imported copy.
