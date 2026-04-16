# CipherRoll Architecture

## 🌐 System Overview

CipherRoll is built to provide operational privacy for payroll management using the official **CoFHE (Coprocessor for Fully Homomorphic Encryption)** architecture on **Arbitrum Sepolia** and **Base Sepolia**.

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
The fundamental backend orchestrator for the supported deployment targets: Arbitrum Sepolia and Base Sepolia.
- **State Management:** Manages organizational metadata and encrypted variables (`_encryptedBudget`, `_encryptedAvailable`, `_encryptedCommitted`).
- **Encrypted Math:** Uses `FHE.add`, `FHE.sub`, and `FHE.select` to update balances without revealing values.
- **Access Control:** Implements explicit visibility logic using `FHE.allowThis()` and `FHE.allow()`.

### 2. Client-Side Decryption (`@cofhe/sdk`)
CipherRoll uses `createCofheConfig(...)`, `createCofheClient(...)`, and `client.connect(...)` to bind an injected browser wallet to the CoFHE network through the current `@cofhe/sdk` builder-pattern API.
- **Encryption:** Payroll and budget inputs are prepared via `client.encryptInputs([...]).execute()` before contract submission.
- **Decryption:** Encrypted handles pulled from the contract are decrypted locally with `client.decryptForView(...)`. Phase 2 selective-disclosure flows will extend this with `client.decryptForTx(...)`.
- **Zero-Sync:** Replaces the legacy privacy UX where users had to sync thousands of node blocks to retrieve UTXOs.

### 3. Current Product Boundary
- The shipped web app and contract focus on organization setup, encrypted budget management, payroll issuance, and employee reads.
- Treasury settlement adapters, tax routing, and broader compliance roles remain roadmap work and are not active product flows yet.

## 🗄️ Data Model

### Organization State
- `admin`: The current operational wallet.
- `metadataHash`: IPFS or deterministic hash referencing off-chain organization mapping.
- `treasuryRouteId`: Reserved contract metadata, not an active frontend-managed settlement route today.
- **Encrypted State:** `_encryptedBudget`, `_encryptedCommitted`, `_encryptedAvailable`.

### Payroll Allocation State
- `employee`: The recipient wallet address.
- `paymentId`: A deterministic Keccak256 hash preventing duplicate processing.
- `encryptedAmount`: The exact salary disbursement, encrypted globally and allowed only to the recipient.
- `isVesting`: Boolean determining if the allocation unlocks linearly or instantly.

## 🔐 Advanced Privacy Handling

Access to encrypted state is strictly protected by cryptographically secure permits. 
In public blockchains, anyone can scrape open RPCs. In CipherRoll, an explicitly signed EIP-712 permit is required, which is then verified by the **CoFHE TaskManager**. This ensures absolute metadata and state privacy.
