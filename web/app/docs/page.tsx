'use client';

import type { ReactNode } from 'react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Cpu,
  FileCode2,
  FileKey2,
  Lock,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
  Wallet,
  Zap,
} from 'lucide-react';
import CipherBotWidget from '@/components/CipherBotWidget';
import GlassCard from '@/components/GlassCard';
import {
  AUDITOR_DISCLOSURE_CONTRACT_ADDRESS,
  BACKEND_BASE_URL,
  CONTRACT_ADDRESS,
  DEFAULT_ORG_ID,
  DIRECT_SETTLEMENT_ADAPTER_ADDRESS,
  GOVERNANCE_CONTRACT_ADDRESS,
  TARGET_CHAIN_ID,
  TARGET_CHAIN_NAME,
  WRAPPER_SETTLEMENT_ADAPTER_ADDRESS,
} from '@/lib/cipherroll-config';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

type DocsTabId =
  | 'getting-started'
  | 'workflows'
  | 'privacy'
  | 'architecture'
  | 'contracts'
  | 'api'
  | 'roadmap'
  | 'troubleshooting';

type DocsTab = {
  id: DocsTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type DocsSection = {
  id: string;
  group: string;
  label: string;
  eyebrow: string;
  title: string;
  summary: string;
  searchText: string;
  content: ReactNode;
  subAnchors?: Array<{ id: string; label: string }>;
};

type SearchResult = {
  tabId: DocsTabId;
  tabLabel: string;
  section: DocsSection;
  score: number;
};

const docsTabs: DocsTab[] = [
  { id: 'getting-started', label: 'Getting Started', icon: Rocket },
  { id: 'workflows', label: 'Workflows', icon: Building2 },
  { id: 'privacy', label: 'Privacy & Audit', icon: ShieldCheck },
  { id: 'architecture', label: 'Architecture', icon: Cpu },
  { id: 'contracts', label: 'Contracts', icon: FileCode2 },
  { id: 'api', label: 'API & SDK', icon: Terminal },
  { id: 'roadmap', label: 'Roadmap', icon: Sparkles },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: Wrench },
];

const rootCommands = `npm install
npm run build:sdk
npm run dev:backend`;

const webCommands = `cd web
npm install
npm run dev`;

const envExample = `ARBITRUM_SEPOLIA_RPC_URL=<rpc-url>
NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS=${CONTRACT_ADDRESS}
NEXT_PUBLIC_CIPHERROLL_AUDITOR_DISCLOSURE_ADDRESS=${AUDITOR_DISCLOSURE_CONTRACT_ADDRESS}
NEXT_PUBLIC_CIPHERROLL_GOVERNANCE_ADDRESS=${GOVERNANCE_CONTRACT_ADDRESS}
NEXT_PUBLIC_CIPHERROLL_DIRECT_SETTLEMENT_ADAPTER=${DIRECT_SETTLEMENT_ADAPTER_ADDRESS}
NEXT_PUBLIC_CIPHERROLL_WRAPPER_SETTLEMENT_ADAPTER=${WRAPPER_SETTLEMENT_ADAPTER_ADDRESS}
NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL=${BACKEND_BASE_URL || "backend-url"}
CIPHERROLL_DATABASE_URL=<supabase-session-pooler-url>
CIPHERROLL_BACKEND_ADMIN_TOKEN=<admin-token>`;

const cofheInitExample = `import { initCofhe } from "@/lib/fhenix-permits";

const provider = await createBrowserProvider();
await initCofhe(provider);`;

const encryptExample = `import { encryptUint128 } from "@/lib/fhenix-permits";

const encryptedAmount = await encryptUint128(
  BigInt(salaryInWei)
);

await contract.depositBudget(orgId, encryptedAmount, BigInt(salaryInWei));`;

const decryptViewExample = `import { decryptUint128ForView } from "@/lib/fhenix-permits";

const handle = budgetHandles.budget;
const plaintext = await decryptUint128ForView(handle);`;

const decryptTxExample = `import { decryptUint128ForTx } from "@/lib/fhenix-permits";

const result = await decryptUint128ForTx(handle);
// result.cleartextValue - the decrypted uint128
// result.signature - threshold signature for on-chain proof`;

const auditorPermitExample = `import {
  createAuditorSharingPermit,
  importAuditorSharingPermit,
} from "@/lib/fhenix-permits";

// Admin creates a sharing permit
const { exportPayload } = await createAuditorSharingPermit({
  issuer: adminAddress,
  recipient: auditorAddress,
  name: "Q3 Audit Review",
});

// Auditor imports the shared permit
await importAuditorSharingPermit(exportPayload);`;

const backendClientExample = `import { createCipherRollBackendClient } from "cipherroll-sdk";

const client = createCipherRollBackendClient({
  baseUrl: process.env.NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL!,
  fetchFn: fetch,
});

const summary = await client.getOrganizationReportSummary(orgId);
const treasury = await client.getTreasuryExposureSummary(orgId);`;

const complianceExample = `const pkg = await client.getCompliancePackage(orgId, {
  taxReserveBps: 1500,
});

console.log(pkg.policy);           // reserve basis-point policy
console.log(pkg.taxProvision);     // estimated aggregate reserve
console.log(pkg.treasury);         // route health, inventory, backlog
console.log(pkg.evidence);         // receipt metadata summary`;

const claimSettlementExample = `// Direct settlement: single-step claim
await contract.claimPayrollWithSettlement(
  orgId, paymentId, cleartextAmount, signature
);

// Wrapper settlement: two-step request + finalize
await contract.requestPayrollSettlement(
  orgId, paymentId, cleartextAmount, signature
);
// ...wait for on-chain decryption...
await contract.finalizePayrollSettlement(
  orgId, paymentId, decryptedAmount, decryptionProof
);`;

const sectionContentByTab: Record<DocsTabId, DocsSection[]> = {
  'getting-started': [
    {
      id: 'gs-overview',
      group: 'Introduction',
      label: 'Overview',
      eyebrow: 'Overview',
      title: 'CipherRoll documentation',
      summary:
        'CipherRoll is a confidential payroll application built on Fhenix CoFHE for Arbitrum Sepolia. Salary amounts, budget state, and committed payroll stay encrypted on-chain. Operators manage payroll through governed workflows. Auditors review aggregate-only disclosures. Employees claim and finalize payouts from their own wallet.',
      searchText:
        'overview cipherroll docs confidential payroll fhenix cofhe arbitrum sepolia admin employee auditor backend encrypted budget settlement',
      subAnchors: [
        { id: 'gs-overview-core', label: 'Core concepts' },
        { id: 'gs-overview-flow', label: 'Payroll flow' },
        { id: 'gs-overview-portals', label: 'Portal routes' },
      ],
      content: (
        <div className="space-y-8">
          <A id="gs-overview-core">
            <p className="text-sm leading-7 text-gray-300">
              CipherRoll keeps salary-sensitive values <K>encrypted</K> on-chain while supporting a
              practical payroll workflow. Each role has a narrow, privacy-safe surface.
            </p>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={Lock}
                title="Encrypted core"
                description="Budget, committed payroll, runway, and employee allocation amounts stay encrypted as euint128 handles on-chain."
              />
              <MetricCard
                icon={Wallet}
                title="Role-based portals"
                description="Separate admin, employee, auditor, tax compliance, and docs routes with role-specific access and privacy boundaries."
              />
              <MetricCard
                icon={FileKey2}
                title="Selective disclosure"
                description="Auditor review is aggregate-only by design. Sharing permits unlock budget/committed/available handles, never employee salary rows."
              />
              <MetricCard
                icon={ShieldCheck}
                title="M-of-N governance"
                description="Sensitive actions — payroll issuance, vesting, treasury changes, membership — require multi-admin approval before execution."
              />
            </div>
          </A>

          <A id="gs-overview-flow">
            <FlowDiagram
              steps={['Admin funds budget', 'Issue allocations', 'Fund run from treasury', 'Activate claims', 'Employee claims payout']}
            />
          </A>

          <A id="gs-overview-portals">
            <DataTable
              headers={['Portal', 'Route', 'Primary responsibility']}
              rows={[
                ['Admin', '/admin', 'Workspace setup, budget funding, payroll-run management, treasury routing, batch payroll, reporting, and auditor sharing.'],
                ['Employee', '/employee', 'Local decrypt, payroll review, claim, and wrapper-finalize flow.'],
                ['Auditor', '/auditor', 'Recipient permit import, aggregate review, and verify/publish receipt workflow.'],
                ['Tax compliance', '/tax-authority', 'Tier A aggregate compliance package, tax reserve policy, and receipt evidence export.'],
                ['Docs', '/docs', 'Product documentation, contract reference, API reference, and support context.'],
              ]}
            />
          </A>
        </div>
      ),
    },
    {
      id: 'gs-prerequisites',
      group: 'Introduction',
      label: 'Prerequisites',
      eyebrow: 'Before You Start',
      title: 'What you need before testing the product',
      summary:
        'Use the right network, role wallets, and local services so the frontend behaves like the shipped product.',
      searchText:
        'prerequisites requirements wallets network backend local services target chain employee admin auditor role wallets cofhe rpc',
      content: (
        <div className="space-y-8">
          <DataTable
            headers={['Requirement', 'Why it matters', 'Notes']}
            rows={[
              ['Arbitrum Sepolia access', 'CipherRoll is designed and deployed only for this target network.', 'Use chain id ' + TARGET_CHAIN_ID + '. Test with separate admin, employee, and auditor wallets.'],
              ['EVM wallet (MetaMask / Rabby)', 'All portal actions depend on an injected wallet for signing and transaction submission.', 'The frontend will show an install prompt if no provider is detected.'],
              ['Backend service running', 'Admin and auditor surfaces rely on indexed read models, exports, notifications, and support endpoints.', 'Run the backend before testing the full product loop.'],
              ['Database connection', 'The hosted backend persists indexed state in Supabase Postgres rather than relying on a local file.', 'For deployment, use the Supabase session-pooler connection string.'],
              ['Browser-based CoFHE flow', 'Employee and auditor experiences depend on permit-backed local decrypt operations.', 'Expect wallet prompts, WASM warmup, local permit storage, and role-specific sessions.'],
              ['Accurate scope expectations', 'The tax page is a Tier A aggregate compliance package route, not a filing or external authority integration.', 'Keep aggregate-first review and receipt evidence boundaries explicit in demos.'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'gs-setup',
      group: 'Local Setup',
      label: 'Local setup',
      eyebrow: 'Setup',
      title: 'Run the backend and web app locally',
      summary:
        'Start the backend first, then the web app, so reporting, exports, notifications, and support flows are available during review.',
      searchText:
        'local setup install backend web app run commands environment variables frontend backend development',
      subAnchors: [
        { id: 'gs-setup-commands', label: 'Commands' },
        { id: 'gs-setup-env', label: 'Environment' },
        { id: 'gs-setup-startup', label: 'Startup order' },
      ],
      content: (
        <div className="space-y-8">
          <A id="gs-setup-commands">
            <div className="grid gap-5 lg:grid-cols-2">
              <CodeBlock title="Repo root" language="bash" code={rootCommands} />
              <CodeBlock title="Web app" language="bash" code={webCommands} />
            </div>
          </A>

          <A id="gs-setup-env">
            <CodeBlock title="Environment example" language="env" code={envExample} />
          </A>

          <A id="gs-setup-startup">
            <Callout title="Startup order" tone="blue">
              The <K>backend</K> must be running before the frontend can serve indexed read models,
              treasury exposure reports, compliance packages, or CipherBot queries. If the backend
              is unavailable the admin and auditor portals will still render but reporting cards
              will show load errors.
            </Callout>
          </A>
        </div>
      ),
    },
    {
      id: 'gs-first-review',
      group: 'Local Setup',
      label: 'First review loop',
      eyebrow: 'Walkthrough',
      title: 'A practical first-pass review of the shipped product',
      summary:
        'Review the docs page first, then move through admin, employee, auditor, and tax compliance in the order the product uses them.',
      searchText:
        'first review loop docs admin employee auditor walkthrough first pass testing order review flow',
      subAnchors: [
        { id: 'gs-review-steps', label: 'Review steps' },
        { id: 'gs-review-wallets', label: 'Wallet separation' },
      ],
      content: (
        <div className="space-y-8">
          <A id="gs-review-steps">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                'Open /docs and confirm the deployment constants match your environment.',
                'Open /admin — connect wallet, initialize CoFHE, and create a workspace.',
                'In /admin, fund encrypted budget, create a payroll run, issue allocations, fund from treasury, activate claims.',
                'Test governance boundaries, batch payroll, treasury exposure panel, and reporting refresh.',
                'Open /employee — test privacy-mode setup, payroll loading, local decrypt, and claim or wrapper finalization.',
                'Open /auditor — validate permit import, aggregate review, verify and publish receipt modes.',
                'Open /tax-authority — verify Tier A package load, reserve policy, and JSON/CSV export.',
              ].map((step, index) => (
                <StepCard key={step} number={index + 1} text={step} />
              ))}
            </div>
          </A>

          <A id="gs-review-wallets">
            <Callout title="Wallet separation" tone="orange">
              Use <K>distinct wallets</K> for admin, employee, and auditor roles during testing. The
              contract enforces <K>role-based access</K> at the function level, so a single wallet cannot
              meaningfully test all three portals in sequence without confusion.
            </Callout>
          </A>
        </div>
      ),
    },
  ],
  workflows: [
    {
      id: 'wf-admin',
      group: 'Admin Portal',
      label: 'Admin workflow',
      eyebrow: 'Admin Portal',
      title: 'Run a complete payroll cycle from workspace setup to claim activation',
      summary:
        'The admin portal is the operational center for workspace setup, encrypted budget funding, payroll-run management, treasury routing, batch payroll, and auditor sharing.',
      searchText:
        'admin workflow workspace setup budget funding payroll run treasury route activation auditor sharing operator portal',
      subAnchors: [
        { id: 'wf-admin-lifecycle', label: 'Payroll lifecycle' },
        { id: 'wf-admin-states', label: 'Run states' },
        { id: 'wf-admin-ids', label: 'Identifier hygiene' },
      ],
      content: (
        <div className="space-y-8">
          <A id="wf-admin-lifecycle">
            <SequenceFlow
            title="Admin payroll lifecycle"
            steps={[
              { label: 'Initialize CoFHE', detail: 'Call initCofhe(provider) to connect the browser wallet to the CoFHE coprocessor.' },
              { label: 'Create workspace', detail: 'Call createOrganization(orgId, metadataHash, adminSlots, quorum). Org ID is keccak256 of your input label.' },
              { label: 'Fund encrypted budget', detail: 'Call depositBudget(orgId, encryptedAmount, fundingLimit). The amount is encrypted client-side; the clear funding limit prevents treasury runs from exceeding deposited budget.' },
              { label: 'Configure treasury', detail: 'Call configureTreasury(orgId, adapter, routeId). Chooses between direct or wrapper-backed settlement.' },
              { label: 'Create payroll run', detail: 'Call createPayrollRun(orgId, runId, assetId, deadline, headcount). Sets funding window and planned size.' },
              { label: 'Issue allocations', detail: 'Use issueConfidentialPayrollToRun() for one-row governed flow, or batch payroll for non-governed workspaces.' },
              { label: 'Fund from treasury', detail: 'Call fundPayrollRunFromTreasury(orgId, runId, amount). Reserves inventory from the adapter.' },
              { label: 'Activate claims', detail: 'Call activatePayrollRun(orgId, runId). Transitions run from Funded to Active. Employees can now claim.' },
            ]}
          />
          </A>

          <A id="wf-admin-states">
          <StateDiagram
            title="Payroll run lifecycle"
            states={[
              { name: 'Draft', color: 'gray' },
              { name: 'Funded', color: 'blue' },
              { name: 'Active', color: 'green' },
              { name: 'Finalized', color: 'cyan' },
            ]}
            transitions={[
              { from: 0, to: 1, label: 'fundPayrollRun' },
              { from: 1, to: 2, label: 'activatePayrollRun' },
              { from: 2, to: 3, label: 'all allocations claimed' },
            ]}
          />
          </A>

          <A id="wf-admin-ids">
          <Callout title="Identifier hygiene" tone="orange">
            Use <K>high-entropy</K> workspace ids, route ids, run ids, and memo defaults whenever the UI
            allows it. Many identifiers remain <K>public or inferable</K> even when values stay encrypted.
            Readable labels like &quot;may-2026-payroll&quot; produce deterministic keccak256 hashes
            that third parties can reproduce.
            </Callout>
          </A>
        </div>
      ),
    },
    {
      id: 'wf-governance',
      group: 'Admin Portal',
      label: 'Governance',
      eyebrow: 'Governance',
      title: 'Which actions require M-of-N approval and which stay single-admin',
      summary:
        'CipherRoll implements M-of-N governance for sensitive payroll actions while preserving single-admin operational usability for day-to-day run management.',
      searchText:
        'governance m of n quorum proposal approval execution governed actions single admin payroll issuance treasury route membership permits',
      subAnchors: [
        { id: 'wf-gov-table', label: 'Governed vs single' },
        { id: 'wf-gov-flow', label: 'Approval flow' },
        { id: 'wf-gov-lifecycle', label: 'Proposal lifecycle' },
        { id: 'wf-gov-permit', label: 'Permit boundary' },
      ],
      content: (
        <div className="space-y-8">
          <A id="wf-gov-table">
          <DataTable
            headers={['Action', 'Execution model', 'Reason']}
            rows={[
              ['Payroll allocation issuance', 'Governed', 'Salary-bearing issuance is sensitive and should require multi-admin approval.'],
              ['Vesting allocation issuance', 'Governed', 'Vesting grants carry the same salary/privacy sensitivity as instant allocations.'],
              ['Treasury route changes', 'Governed', 'Changing the payout route affects settlement safety and employee payout behavior.'],
              ['Add / remove admin', 'Governed', 'Admin set changes protect the control plane itself.'],
              ['Update quorum', 'Governed', 'Quorum changes affect the governance threshold.'],
              ['Create payroll run', 'Single-admin', 'Run creation is an operational action that does not move funds.'],
              ['Fund payroll run', 'Single-admin', 'Funding is an operational action after issuance has been approved.'],
              ['Activate payroll run', 'Single-admin', 'Activation is an operational action that opens claims after funding succeeds.'],
            ]}
          />
          </A>

          <A id="wf-gov-flow">
          <FlowDiagram
            steps={['Propose action', 'Admins approve', 'Quorum reached', 'Execute on-chain']}
          />
          </A>

          <A id="wf-gov-lifecycle">
          <SequenceFlow
            title="Governance proposal lifecycle"
            steps={[
              { label: 'Bootstrap', detail: 'Primary admin calls bootstrapOrganization() then bootstrapOrganizationAdmin() until quorum is reached.' },
              { label: 'Propose', detail: 'Any admin calls proposeGovernanceAction(orgId, actionType, payload, expiresAt). Auto-includes first approval.' },
              { label: 'Approve', detail: 'Other admins call approveGovernanceProposal(proposalId). Each approval increments the count.' },
              { label: 'Execute', detail: 'Once approvalCount reaches quorum, execute via executeGovernanceProposal() (direct) or from the proposer wallet (wallet-executor actions).' },
              { label: 'Revoke / Cancel', detail: 'Admins can revokeApproval() before execution. Proposer or primary admin can cancelGovernanceProposal().' },
            ]}
          />
          </A>

          <A id="wf-gov-permit">
          <Callout title="Permit boundary" tone="blue">
            <K>CoFHE permits</K> are <K>decryption-access</K> tools — they control who can view encrypted values.
            They are NOT governance signatures, transaction approvals, or replacements for M-of-N
            execution. Permit sharing may help multiple admins review encrypted payroll data, but
            <K>M-of-N execution</K> approval must still go through the governance contract.
          </Callout>
          </A>
        </div>
      ),
    },
    {
      id: 'wf-batch-payroll',
      group: 'Admin Portal',
      label: 'Batch payroll',
      eyebrow: 'Batch Payroll',
      title: 'Author, seal, and submit batch payroll rows safely',
      summary:
        'Batch payroll v1 is a browser-local authoring and retry layer over existing single-row contract calls. Governed workspaces are blocked from batch flows.',
      searchText:
        'batch payroll csv import browser local sealing salaries queue chunk retry row validation governed workspace planned headcount',
      content: (
        <div className="space-y-8">
          <FlowDiagram
            steps={['Add rows / Import CSV', 'Validate', 'Seal (encrypt salaries)', 'Submit queue', 'Verify manifest']}
          />

          <SequenceFlow
            title="Batch payroll flow"
            steps={[
              { label: 'Use non-governed workspace', detail: 'Governed workspaces intentionally block batch sealing and submission. Use the one-row governed issuance flow instead.' },
              { label: 'Add rows', detail: 'Import CSV locally or add manual rows. Expected CSV headers: employee, role, salary, memo (optional).' },
              { label: 'Validate', detail: 'Review validation messages for invalid addresses, unknown roles, missing salary, or malformed values.' },
              { label: 'Seal', detail: 'Encrypt salaries in the browser. After sealing, salary values and aggregate totals are masked in the UI.' },
              { label: 'Submit queue', detail: 'Each employee row opens its own wallet transaction. Confirmed rows show tx refs. Failed rows can be retried without resubmitting confirmed rows.' },
              { label: 'Verify manifest', detail: 'Backend manifest stores only org, run, employee, role slug/label, payment id, and tx hash — no salary amounts.' },
            ]}
          />

          <DataTable
            headers={['Boundary', 'Current behavior']}
            rows={[
              ['Not a multi-row contract call', 'Batch v1 submits one issueConfidentialPayrollToRun() transaction per row.'],
              ['Not a backend salary upload', 'CSV parsing and salary sealing happen in the browser. Backend manifests omit salary amounts.'],
              ['Not governed batch execution', 'Governed workspaces must use the one-row governed issuance proposal flow.'],
              ['Retryable by row', 'Confirmed rows are skipped on retry so the operator does not resubmit successful rows.'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'wf-employee',
      group: 'Employee Portal',
      label: 'Employee workflow',
      eyebrow: 'Employee Portal',
      title: 'Review, decrypt, claim, and finalize payroll as an employee',
      summary:
        'The employee portal is intentionally narrow. It focuses on privacy-mode setup, local decrypts, claim readiness, and payout completion.',
      searchText:
        'employee workflow review claim finalize payroll privacy mode local decrypt vesting wrapper finalization settlement request',
      content: (
        <div className="space-y-8">
          <FlowDiagram
            steps={['Connect wallet', 'Enable privacy mode', 'Load allocations', 'Decrypt locally', 'Claim or finalize']}
          />

          <SequenceFlow
            title="Employee flow"
            steps={[
              { label: 'Connect wallet', detail: 'Use the wallet whose address matches the payroll allocation metadata (employee field).' },
              { label: 'Enable privacy mode', detail: 'Initialize CoFHE and create or reuse the employee self permit via getOrCreateSelfPermit().' },
              { label: 'Load allocations', detail: 'Call getEmployeeAllocations(orgId, employee). Returns paymentIds, memoHashes, timestamps, and encrypted amount handles.' },
              { label: 'Decrypt locally', detail: 'Use decryptForView() on each amount handle. Plaintext stays in the browser — never sent to the backend.' },
              { label: 'Claim or finalize', detail: 'Claim direct payouts with claimPayrollWithSettlement(). For wrapper routes, request settlement then finalize with the decryption proof.' },
            ]}
          />

          <DataTable
            headers={['State', 'Meaning', 'Employee action']}
            rows={[
              ['Draft', 'The payroll run exists but has no allocations or funding yet.', 'None — wait for admin to issue allocations.'],
              ['Awaiting activation', 'Allocations exist but the run is not yet Active.', 'None — wait for admin to fund and activate the run.'],
              ['Available (instant)', 'The run is Active, the allocation is not vesting, and is not yet claimed.', 'Claim via claimPayrollWithSettlement().'],
              ['Vesting-locked', 'The allocation has a vesting end timestamp that has not yet passed.', 'Wait until the vesting end timestamp has passed.'],
              ['Pending finalize', 'A wrapper settlement request exists and the employee must complete the final step.', 'Call finalizePayrollSettlement() with the decryption proof.'],
              ['Claimed', 'The allocation has been successfully claimed and settled.', 'No further action needed.'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'wf-auditor',
      group: 'Auditor Portal',
      label: 'Auditor workflow',
      eyebrow: 'Auditor Portal',
      title: 'Import permits, review aggregates, and generate evidence receipts',
      summary:
        'The auditor portal is built around selective disclosure. It is not a shortcut into admin-level payroll visibility. Auditors see budget, committed, and available — never employee salary rows.',
      searchText:
        'auditor workflow permits import aggregate review selective disclosure verify publish receipts evidence recipient permit sharing',
      content: (
        <div className="space-y-8">
          <ArchDiagram
            title="Auditor disclosure architecture"
            boxes={[
              { id: 'admin', label: 'Admin', desc: 'Creates sharing permit' },
              { id: 'permit', label: 'Sharing Permit', desc: 'Aggregate-only scope' },
              { id: 'auditor', label: 'Auditor', desc: 'Imports and decrypts' },
              { id: 'chain', label: 'On-chain', desc: 'Verify / Publish receipts' },
            ]}
            connections={[
              { from: 'admin', to: 'permit', label: 'create + export' },
              { from: 'permit', to: 'auditor', label: 'import payload' },
              { from: 'auditor', to: 'chain', label: 'decryptForTx' },
            ]}
          />

          <SequenceFlow
            title="Auditor flow"
            steps={[
              { label: 'Connect auditor wallet', detail: 'Switch to the target network and connect the wallet designated as the permit recipient.' },
              { label: 'Import permit', detail: 'Paste the admin-exported sharing payload. Call importAuditorSharingPermit(payload) to create a recipient permit.' },
              { label: 'Select active permit', detail: 'Select the imported recipient permit as active. This determines which disclosure session is used for decrypts.' },
              { label: 'Decrypt aggregates', detail: 'Call getAuditorEncryptedSummaryHandles(orgId), then decryptForView() on each handle. Values: budget, committed, available.' },
              { label: 'Review summary', detail: 'Call getAuditorOrganizationSummary(orgId) for run counts, treasury posture, and organization insights — all aggregate.' },
              { label: 'Generate receipts', detail: 'Use verify (narrower default) or publish (for downstream systems) only when evidence needs to leave the browser.' },
            ]}
          />

          <CodeBlock title="Auditor permit flow" language="ts" code={auditorPermitExample} />

          <div className="grid gap-5 md:grid-cols-2">
            <Callout title="Verify receipt" tone="blue">
              Use <K>verify</K> as the narrower default. It records an <K>on-chain proof</K> of review via
              FHE.verifyDecryptResult() without making publication the default path. The
              AuditorAggregateDisclosureRecorded event is emitted with published=false.
            </Callout>
            <Callout title="Publish receipt" tone="orange">
              Use <K>publish</K> only when a downstream workflow explicitly needs the result materialized
              on-chain. It calls FHE.publishDecryptResult(), which makes the <K>cleartext value visible</K> in the event log. The event is emitted with published=true.
            </Callout>
          </div>
        </div>
      ),
    },
    {
      id: 'wf-compliance',
      group: 'Compliance',
      label: 'Tax compliance',
      eyebrow: 'Compliance',
      title: 'Build a Tier A aggregate compliance package',
      summary:
        'The tax/compliance route packages policy, treasury posture, and audit receipt metadata without becoming a tax filing or salary export.',
      searchText:
        'tax compliance tier a aggregate package reserve policy export csv json evidence receipts tax authority regulator',
      content: (
        <div className="space-y-8">
          <FlowDiagram
            steps={['Enter org id', 'Set reserve policy (bps)', 'Load package', 'Review safety notes', 'Export JSON / CSV']}
          />

          <SequenceFlow
            title="Compliance package flow"
            steps={[
              { label: 'Open /tax-authority', detail: 'After the backend has indexed the workspace you want to review.' },
              { label: 'Set parameters', detail: 'Enter the workspace label or org id and choose the aggregate tax reserve policy in basis points (default: 1500 = 15.00%).' },
              { label: 'Load package', detail: 'Verify the page shows estimated reserve, reserve basis, payout backlog, receipt counts, and route health.' },
              { label: 'Review safety notes', detail: 'The package is aggregate-first, not a tax filing, and not an external authority integration.' },
              { label: 'Export', detail: 'Download JSON for structured review or CSV for spreadsheet-style policy evidence.' },
            ]}
          />

          <DataTable
            headers={['Included in package', 'Excluded from package']}
            rows={[
              ['Organization summary and run/payment counts', 'Employee salary rows and employee-level plaintext amounts'],
              ['Treasury available/reserved posture and payout backlog', 'Real tax authority filing, remittance, or API submission'],
              ['Operator-selected aggregate reserve policy (bps)', 'Multi-jurisdiction tax logic or statutory calculations'],
              ['Auditor verify/publish receipt metadata', 'New disclosure paths that bypass auditor evidence receipts'],
              ['Route health and confidential settlement status', 'Raw employee allocation handles or individual payment details'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'wf-settlement',
      group: 'Settlement',
      label: 'Settlement modes',
      eyebrow: 'Settlement',
      title: 'Direct and wrapper-backed settlement follow different employee experiences',
      summary:
        'CipherRoll supports two payout shapes. The direct route releases tokens immediately. The wrapper route requires a request + finalize flow and the settlement amount becomes public during on-chain proof submission.',
      searchText:
        'settlement modes direct treasury wrapper backed settlement employee experience payout routes claim finalize unshield',
      content: (
        <div className="space-y-8">
          <SectionLabel tone="orange">Side-by-side comparison</SectionLabel>
          <DataTable
            headers={['Property', 'Direct settlement', 'Wrapper settlement (FHERC20)']}
            rows={[
              ['Adapter', 'MockSettlementTreasuryAdapter', 'MockFHERC20SettlementTreasuryAdapter'],
              ['supportsConfidentialSettlement', 'false', 'true'],
              ['Employee claim', 'claimPayrollWithSettlement() — single step', 'requestPayrollSettlement() then finalizePayrollSettlement() — two steps'],
              ['Payout timing', 'Immediate: tokens transfer on claim', 'Deferred: request creates pending unshield, finalize releases after decryption proof'],
              ['Privacy during settlement', 'Cleartext amount verified on-chain via FHE.verifyDecryptResult()', 'Confidential balance stays encrypted until request; amount becomes public when finalize proof is posted'],
              ['ERC20 transfer', 'Direct transfer from adapter to employee', 'Tokens released after claimUnshielded() inside finalize'],
              ['Route pinning', 'N/A', 'Finalize is pinned to the adapter that created the request — route changes cannot silently redirect'],
            ]}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-400">Direct settlement</p>
              <FlowDiagram
                steps={['Fund budget', 'Issue allocation', 'Fund run from treasury', 'Activate run', 'Employee claims with proof', 'Tokens transfer immediately']}
              />
            </div>
            <div className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-400">Wrapper settlement</p>
              <FlowDiagram
                steps={['Fund budget', 'Issue allocation', 'Fund run from treasury', 'Activate run', 'Employee requests settlement', 'Wait for decryption', 'Employee finalizes with proof']}
              />
            </div>
          </div>

          <CodeBlock title="Settlement code paths" language="ts" code={claimSettlementExample} />
        </div>
      ),
    },
  ],
  privacy: [
    {
      id: 'pv-boundary',
      group: 'Privacy Model',
      label: 'Privacy boundary',
      eyebrow: 'Privacy Model',
      title: 'What stays encrypted, what stays public, and what becomes public later',
      summary:
        'CipherRoll is private-by-design, not invisibility-by-claim. The product stays precise about what the host chain and settlement flows still expose.',
      searchText:
        'privacy boundary encrypted values public values wrapper finalization decryptfortx host chain disclosure inferable',
      content: (
        <div className="space-y-8">
          <SectionLabel tone="blue">What stays encrypted</SectionLabel>
          <div className="grid gap-5 md:grid-cols-3">
            <Callout title="Encrypted on-chain" tone="blue">
              <K>Budget</K>, <K>committed payroll</K>, <K>available runway</K>, <K>employee allocation amounts</K>, and
              <K>aggregate auditor handles</K> are stored as euint128 encrypted handles or confidential
              wrapper balances.
            </Callout>
            <Callout title="Public workflow metadata" tone="blue">
              <K>Wallet addresses</K>, <K>run states</K>, <K>timestamps</K>, <K>ids</K>, <K>logs</K>, <K>calldata</K>, and <K>funding windows</K>
              remain visible as part of the EVM execution model or because CipherRoll stores them
              explicitly.
            </Callout>
            <Callout title="Becomes public later" tone="orange">
              <K>Wrapper settlement values</K> move from confidential to public when a
              <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-cyan-300">decryptForTx</code>
              proof path is posted on-chain during finalization. The finalize flow verifies the
              plaintext + signature on-chain, so that amount is no longer only local browser data.
            </Callout>
          </div>

          <SectionLabel tone="orange">Classification inventory</SectionLabel>
          <DataTable
            headers={['Category', 'Examples', 'Why']}
            rows={[
              ['Encrypted on-chain', 'Organization budget, committed payroll, available runway, employee allocation amounts, aggregate disclosure handles, wrapper balances before request', 'Stored as euint128 handles; only decryptable through permit-backed decryptForView() or scoped decryptForTx().'],
              ['Public by EVM design', 'Transaction sender, recipient, calldata, logs, timestamps, gas, ERC20 transfer events, block numbers', 'Standard Arbitrum/EVM transparency. All transactions and events are publicly queryable.'],
              ['Public — CipherRoll stores it', 'orgId, metadataHash, admin address, treasury adapter, run ids, payment ids, memo hashes, run states, funding deadlines, allocation counts, settlement request metadata, payout amounts after settlement', 'Stored in contract structs or emitted in events. CipherRoll intentionally makes workflow metadata public.'],
              ['Inferable labels', 'Workspace ids from readable labels, route ids, run ids, memo hashes from predictable text', 'The frontend hashes labels with keccak256. If the input is guessable, the hash is reproducible. The UI now encourages high-entropy alternatives.'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'pv-cofhe',
      group: 'Privacy Model',
      label: 'CoFHE encryption model',
      eyebrow: 'CoFHE',
      title: 'How CipherRoll uses the @cofhe/sdk for encryption, viewing, and evidence',
      summary:
        'CipherRoll uses three distinct CoFHE operations — encryptInputs, decryptForView, and decryptForTx — each with a different privacy and on-chain impact.',
      searchText:
        'cofhe sdk encrypt inputs decrypt for view decrypt for tx encryption model permit fhe euint128 coprocessor wasm',
      content: (
        <div className="space-y-8">
          <SectionLabel tone="cyan">Three operations</SectionLabel>
          <DataTable
            headers={['Operation', 'Purpose', 'Privacy impact', 'Used by']}
            rows={[
              ['encryptInputs()', 'Encrypt a value client-side before submitting it as a transaction argument.', 'Value stays encrypted on-chain after submission. No plaintext appears in calldata.', 'Admin — depositBudget, issueConfidentialPayroll, issueVestingAllocation, fundPayrollRun.'],
              ['decryptForView()', 'Decrypt an on-chain euint128 handle for local browser display.', 'Plaintext stays in the browser. Nothing is recorded on-chain. This is the safest decrypt mode.', 'Admin — budget handles. Employee — allocation amounts. Auditor — aggregate handles.'],
              ['decryptForTx()', 'Prepare a threshold-signed decrypt result for on-chain submission.', 'The cleartext value and signature will be submitted on-chain, making the amount public in the transaction and event log.', 'Employee — settlement proof. Auditor — verify/publish receipts.'],
            ]}
          />

          <ArchDiagram
            title="CoFHE operation flow"
            boxes={[
              { id: 'browser', label: 'Browser', desc: 'encryptInputs / decryptForView / decryptForTx' },
              { id: 'cofhe', label: 'CoFHE Network', desc: 'Threshold decryption' },
              { id: 'contract', label: 'Smart Contract', desc: 'euint128 handles + FHE ops' },
            ]}
            connections={[
              { from: 'browser', to: 'contract', label: 'encrypted input' },
              { from: 'contract', to: 'browser', label: 'encrypted handle' },
              { from: 'browser', to: 'cofhe', label: 'decrypt request' },
              { from: 'cofhe', to: 'browser', label: 'plaintext + signature' },
            ]}
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <CodeBlock title="Encrypt for on-chain submission" language="ts" code={encryptExample} />
            <CodeBlock title="Decrypt for local viewing" language="ts" code={decryptViewExample} />
          </div>

          <CodeBlock title="Decrypt for on-chain proof" language="ts" code={decryptTxExample} />
        </div>
      ),
    },
    {
      id: 'pv-selective',
      group: 'Audit Model',
      label: 'Selective disclosure',
      eyebrow: 'Audit Model',
      title: 'Auditor review is a separate privacy mode from admin visibility',
      summary:
        'CipherRoll makes a clear distinction between local view-only review and evidence-oriented receipt generation. The auditor never sees employee salary rows.',
      searchText:
        'selective disclosure audit model decryptforview decryptfortx view only verify publish receipts aggregate only permit sharing recipient',
      content: (
        <div className="space-y-8">
          <ArchDiagram
            title="Selective disclosure flow"
            boxes={[
              { id: 'admin', label: 'Admin', desc: 'Creates sharing permit' },
              { id: 'permit', label: 'Sharing Permit', desc: 'Aggregate-only scope' },
              { id: 'auditor', label: 'Auditor', desc: 'Imports and decrypts' },
              { id: 'evidence', label: 'Evidence Mode', desc: 'Verify / Publish receipts' },
            ]}
            connections={[
              { from: 'admin', to: 'permit', label: 'create + export' },
              { from: 'permit', to: 'auditor', label: 'import payload' },
              { from: 'auditor', to: 'evidence', label: 'decryptForTx' },
            ]}
          />

          <DataTable
            headers={['Auditor CAN see', 'Auditor CANNOT see']}
            rows={[
              ['Organization budget handle (aggregate)', 'Individual employee allocation amounts'],
              ['Committed payroll handle (aggregate)', 'Employee salary rows or per-employee handles'],
              ['Available runway handle (aggregate)', 'Admin-only read surfaces or raw allocation getters'],
              ['Run counts by status (draft, funded, active, finalized)', 'Memo contents or payment details beyond aggregate counts'],
              ['Treasury posture (available, reserved, route health)', 'Settlement request details for specific employees'],
              ['Organization insights (total items, claimed, vesting, recipients)', 'Which specific employees received which amounts'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'pv-compliance',
      group: 'Audit Model',
      label: 'Compliance evidence',
      eyebrow: 'Compliance Evidence',
      title: 'Compliance reporting extends audit receipts — it does not bypass them',
      summary:
        'Wave 5 compliance uses backend packages and existing receipt metadata. It does not introduce a new plaintext disclosure shortcut.',
      searchText:
        'compliance evidence tax package audit receipts decryptfortx aggregate first regulator review verify publish',
      content: (
        <div className="space-y-8">
          <SectionLabel tone="blue">Disclosure escalation</SectionLabel>
          <FlowDiagram
            steps={['View mode (local only)', 'Receipt mode (on-chain evidence)', 'Compliance package (backend export)']}
          />

          <SectionLabel tone="orange">Mode comparison</SectionLabel>
          <DataTable
            headers={['Mode', 'Privacy impact', 'Data path']}
            rows={[
              ['View mode', 'Plaintext stays in the auditor browser. Nothing recorded on-chain.', 'Admin shares aggregate permit. Auditor decrypts locally via decryptForView().'],
              ['Receipt mode', 'Cleartext value and signature submitted on-chain. Amount visible in event log.', 'Auditor selects metric. decryptForTx() creates signed result. Verify or publish on-chain.'],
              ['Compliance package', 'Same aggregate boundary as the live API. No employee amounts.', 'Backend indexes receipt metadata. Tax route packages policy and evidence. Exports omit salary rows.'],
            ]}
          />

          <Callout title="Default disclosure posture" tone="orange">
            Regulator-facing review should stay <K>aggregate-first</K> unless there is a documented
            reason to disclose more. The tax route does not add any <K>employee-level disclosure</K>
            path. decryptForTx evidence in compliance context comes from existing auditor
            <K>verify/publish receipt</K> flows — not a separate bypass.
          </Callout>
        </div>
      ),
    },
    {
      id: 'pv-matrix',
      group: 'Privacy Matrix',
      label: 'Privacy matrix',
      eyebrow: 'Privacy Matrix',
      title: 'Complete inventory of what is encrypted, public, or inferable in the current product',
      summary:
        'This matrix describes the CipherRoll product as it exists in this repository. It is implementation-specific, not aspirational.',
      searchText:
        'privacy matrix encrypted public inferable values complete inventory boundary calldata events identifiers',
      content: (
        <div className="space-y-8">
          <DataTable
            headers={['Value', 'Classification', 'Explanation']}
            rows={[
              ['Organization budget handle', 'Encrypted on-chain', 'Stored as euint128. Decryptable through permit-backed decryptForView() or scoped decryptForTx().'],
              ['Committed payroll handle', 'Encrypted on-chain', 'Stored as euint128. Represents total issued payroll.'],
              ['Available runway handle', 'Encrypted on-chain', 'Stored as euint128. Budget minus committed.'],
              ['Employee allocation amounts', 'Encrypted on-chain', 'Each allocation stored as euint128. Only the designated employee can decrypt.'],
              ['Auditor aggregate handles', 'Encrypted on-chain', 'Budget/committed/available exposed through shared permit decrypt flows.'],
              ['Wrapper balances before request', 'Encrypted on-chain', 'Confidential balance stays encrypted until the unshield request is opened.'],
              ['Transaction sender/recipient/nonce/gas', 'Public by EVM design', 'Standard Arbitrum transparency.'],
              ['Contract calldata', 'Public by EVM design', 'Function arguments are public unless encrypted before submission via encryptInputs().'],
              ['Event logs and indexed topics', 'Public by EVM design', 'All emitted events are publicly queryable.'],
              ['ERC20 transfer events', 'Public by EVM design', 'Direct settlement and wrapper unshield release both touch public ERC20 state.'],
              ['Wrapper settlement amount after finalize', 'Public by EVM design', 'The finalize flow verifies plaintext + signature on-chain.'],
              ['orgId, admin, treasury adapter, route id', 'Public — stored explicitly', 'Stored in Organization struct. Route ids trimmed from auditor surface.'],
              ['paymentId, memoHash, employee, timestamps', 'Public — stored explicitly', 'Stored in PayrollAllocationMeta. Per-payment getter restricted to the employee.'],
              ['Run id, asset id, deadline, headcount, status', 'Public — stored explicitly', 'Stored in PayrollRun. Run-created event keeps funding window public.'],
              ['Organization insights (total, active, claimed, vesting, recipients)', 'Public — stored explicitly', 'Plain counters in OrganizationInsights.'],
              ['Settlement request metadata (requestId, assets, timestamp)', 'Public — stored explicitly', 'Stored in PayrollSettlementRequest. Detailed getter restricted to the employee.'],
              ['Workspace ids from readable labels', 'Inferable', 'Frontend computes keccak256(toUtf8Bytes(input)). Guessable inputs produce reproducible hashes.'],
              ['Route ids, run ids from predictable labels', 'Inferable', 'Frontend offers one-click high-entropy alternatives.'],
            ]}
          />

          <Callout title="Interpretation" tone="blue">
            <K>Hashed</K> does not mean <K>private</K>. If the unhashed source string is predictable, third
            parties may reproduce the same bytes32 label. The admin UI now generates <K>high-entropy</K>
            ids automatically for payment ids, workspace metadata hashes, blank memo fallbacks,
            and settlement asset ids.
          </Callout>
        </div>
      ),
    },
    {
      id: 'pv-best-practices',
      group: 'Best Practices',
      label: 'Best practices',
      eyebrow: 'Best Practices',
      title: 'Recommended practices for operators and reviewers',
      summary:
        'These recommendations come from the current implementation and the kinds of questions teams typically ask while reviewing the frontend.',
      searchText:
        'best practices operators reviewers ids wallets terminology stakeholder review docs process compliance',
      content: (
        <div className="grid gap-5 lg:grid-cols-2">
          <ChecklistCard
            title="Operator practices"
            items={[
              'Use separate wallets for admin, employee, and auditor scenarios during testing.',
              'Prefer high-entropy identifiers over readable labels when the UI allows it.',
              'Document which treasury route a demo or test is using because claim behavior differs.',
              'Refresh read models after writes instead of assuming projections update instantly.',
              'Use the compliance route for aggregate policy packages, not for tax filing claims.',
              'Keep governed workspaces on the one-row issuance path; use non-governed for batch.',
              'Review treasury exposure after every funding or claim event to catch route health changes.',
            ]}
          />
          <ChecklistCard
            title="Documentation practices"
            items={[
              'Keep terminology consistent: workspace, payroll run, recipient permit, verify receipt, publish receipt.',
              'Review privacy wording whenever settlement or audit-receipt behavior changes.',
              'Write for the user who needs to complete a task, not for the page that needs to look full.',
              'Call out whether an action is governed, single-admin, browser-local, or backend-indexed.',
              'Only add sections that match the actual CipherRoll surface.',
              'Distinguish decryptForView (local-only) from decryptForTx (on-chain evidence) explicitly.',
            ]}
          />
        </div>
      ),
    },
  ],
  architecture: [
    {
      id: 'arch-overview',
      group: 'System Design',
      label: 'Architecture overview',
      eyebrow: 'System Design',
      title: 'How the main pieces fit together',
      summary:
        'CipherRoll is a full-stack application: on-chain contracts for confidential payroll logic, a Next.js frontend for role-based portals, a Node.js backend for indexed read models, a shared SDK, and hosted persistence.',
      searchText:
        'architecture overview frontend contracts backend treasury adapters cofhe network system design full stack',
      content: (
        <div className="space-y-8">
          <SectionLabel tone="cyan">Component map</SectionLabel>
          <ArchDiagram
            title="System architecture"
            boxes={[
              { id: 'frontend', label: 'Frontend Portals', desc: 'Admin / Employee / Auditor / Docs / Tax' },
              { id: 'sdk', label: 'CipherRoll SDK', desc: 'Shared types + config' },
              { id: 'cofhe', label: 'CoFHE Client', desc: '@cofhe/sdk in browser' },
              { id: 'contracts', label: 'Smart Contracts', desc: 'Payroll + Governance + Auditor' },
              { id: 'adapters', label: 'Treasury Adapters', desc: 'Direct + Wrapper' },
              { id: 'backend', label: 'Backend Service', desc: 'Indexer + API + CipherBot' },
              { id: 'db', label: 'Supabase Postgres', desc: 'Indexed read models' },
            ]}
            connections={[
              { from: 'frontend', to: 'sdk', label: 'types + config' },
              { from: 'frontend', to: 'cofhe', label: 'encrypt / decrypt' },
              { from: 'cofhe', to: 'contracts', label: 'encrypted inputs' },
              { from: 'frontend', to: 'contracts', label: 'write txs' },
              { from: 'contracts', to: 'adapters', label: 'settlement ops' },
              { from: 'frontend', to: 'backend', label: 'read models' },
              { from: 'backend', to: 'db', label: 'persist + query' },
              { from: 'contracts', to: 'backend', label: 'events' },
            ]}
          />

          <SectionLabel tone="blue">Technology stack</SectionLabel>
          <DataTable
            headers={['Layer', 'Technology', 'Responsibility']}
            rows={[
              ['Smart contracts', 'Solidity 0.8.25 + FHE operations', 'Confidential payroll state, governance, auditor disclosure, treasury settlement.'],
              ['Frontend', 'Next.js + TypeScript + Tailwind', 'Role-based portals, wallet interactions, permit-backed local decrypts, product explanation.'],
              ['Backend', 'Node.js + TypeScript + Postgres', 'Event indexer, read models, reporting, exports, notifications, compliance packages.'],
              ['Shared SDK', 'TypeScript package', 'Runtime config, backend client, shared types, contract view mappers, compliance helpers.'],
              ['Database', 'Supabase Postgres', 'Indexed organizations, payroll runs, payments, receipts, notifications, events.'],
              ['CoFHE client', '@cofhe/sdk web', 'Browser-side encryption, permit management, local decrypt, threshold signature preparation.'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'arch-contracts',
      group: 'System Design',
      label: 'Contract layer',
      eyebrow: 'Contract Layer',
      title: 'How the three core contracts and two adapters work together',
      summary:
        'CipherRollPayroll holds all encrypted payroll state and treasury coordination. CipherRollGovernance adds M-of-N approval for sensitive actions. CipherRollAuditorDisclosure provides aggregate-only disclosure and receipt generation.',
      searchText:
        'contract layer payroll governance auditor disclosure treasury adapter relationship interaction architecture',
      content: (
        <div className="space-y-8">
          <ArchDiagram
            title="Contract interactions"
            boxes={[
              { id: 'payroll', label: 'CipherRollPayroll', desc: 'Encrypted state + settlement' },
              { id: 'governance', label: 'CipherRollGovernance', desc: 'M-of-N proposals + approvals' },
              { id: 'auditor', label: 'CipherRollAuditorDisclosure', desc: 'Aggregate receipts' },
              { id: 'direct', label: 'Direct Adapter', desc: 'Immediate token transfer' },
              { id: 'wrapper', label: 'Wrapper Adapter', desc: 'FHERC20 request/finalize' },
            ]}
            connections={[
              { from: 'payroll', to: 'governance', label: 'checks approval' },
              { from: 'payroll', to: 'direct', label: 'settlePayroll()' },
              { from: 'payroll', to: 'wrapper', label: 'request + finalize' },
              { from: 'auditor', to: 'payroll', label: 'reads aggregate handles' },
            ]}
          />

          <DataTable
            headers={['Contract', 'State ownership', 'Key access pattern']}
            rows={[
              ['CipherRollPayroll', 'Encrypted budget/committed/available, allocation amounts, payroll runs, settlement requests', 'Admin-only writes, employee-only allocation reads, auditor aggregate reads'],
              ['CipherRollGovernance', 'Admin set, quorum, proposals, approval state', 'Any admin can propose/approve; only payroll can consume wallet-executor approvals'],
              ['CipherRollAuditorDisclosure', 'No persistent state — reads from payroll on demand', 'Any caller can read auditor summary; receipt actions require decryptForTx proof'],
              ['Direct settlement adapter', 'Available/reserved treasury funds per org and run', 'Only payroll contract can call reserve/settle; anyone can deposit'],
              ['Wrapper settlement adapter', 'Available/reserved funds + pending unshield requests', 'Only payroll contract can call reserve/request/finalize; anyone can deposit'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'arch-treasury',
      group: 'System Design',
      label: 'Treasury architecture',
      eyebrow: 'Treasury',
      title: 'How treasury routes deliver real payouts to employees',
      summary:
        'CipherRoll uses pluggable treasury adapters so payroll value comes from actual token inventory rather than being imagined inside the payroll contract alone.',
      searchText:
        'treasury architecture adapter direct wrapper fherc20 settlement reserve inventory payout escrow',
      content: (
        <div className="space-y-8">
          <SequenceFlow
            title="Treasury funding and settlement"
            steps={[
              { label: 'Admin deposits funds', detail: 'Call depositPayrollFunds(orgId, amount) on the adapter. For wrapper: tokens are shielded into confidential FHERC20 balance.' },
              { label: 'Payroll reserves inventory', detail: 'When fundPayrollRunFromTreasury() is called, the payroll contract instructs the adapter to move funds from available to reserved.' },
              { label: 'Per-run tracking', detail: 'The adapter tracks reservedPayrollRunFunds alongside org-level reservedPayrollFunds so each run has a clear funding posture.' },
              { label: 'Employee claim triggers settlement', detail: 'Direct: settlePayroll() transfers tokens. Wrapper: requestPayrollSettlement() creates an unshield request, then finalizePayrollSettlement() claims it.' },
              { label: 'Route pinning safety', detail: 'Wrapper finalize verifies the request was created by the same adapter currently configured. Route changes cannot silently redirect pending finalizations.' },
            ]}
          />

          <DataTable
            headers={['ITreasuryAdapter method', 'Direct adapter', 'Wrapper adapter']}
            rows={[
              ['depositPayrollFunds()', 'Transfer ERC20 from sender to adapter, add to available.', 'Transfer ERC20, shield into confidential token, add to available.'],
              ['reservePayrollFunding()', 'Move from available to reserved (org + run).', 'Move from available to reserved (org + run).'],
              ['settlePayroll()', 'Transfer reserved tokens to employee.', 'Reverts — wrapper requires request/finalize.'],
              ['requestPayrollSettlement()', 'Reverts — direct uses settlePayroll.', 'Create pending unshield request, move from reserved to pending.'],
              ['finalizePayrollSettlement()', 'Reverts — direct uses settlePayroll.', 'Claim unshielded balance, deduct from reserved, release payout token.'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'arch-backend',
      group: 'System Design',
      label: 'Backend layer',
      eyebrow: 'Backend',
      title: 'How the indexer, read models, and API routes support the frontend',
      summary:
        'The backend is intentionally a read-model and operator-support layer. It does not replace browser-local decrypt flows and does not centralize employee salary plaintext.',
      searchText:
        'backend layer indexer read models api routes reporting exports notifications database persistence supabase',
      content: (
        <div className="space-y-8">
          <FlowDiagram
            steps={['Indexer polls chain', 'Decode events', 'Write to Postgres', 'API serves read models', 'Frontend consumes APIs']}
          />

          <DataTable
            headers={['Backend capability', 'Why the frontend uses it', 'Privacy boundary']}
            rows={[
              ['Health and status', 'Expose operational state without forcing contract-level inspection for every review.', 'No private data involved.'],
              ['Organization summaries', 'Help admins and auditors use aggregate-first reporting and export packages.', 'Summaries are aggregate-only; no employee salary rows.'],
              ['Treasury exposure', 'Show route health, reserved inventory, payout backlog, and run exposure.', 'Operational counts and reserve posture, not plaintext salary disclosure.'],
              ['Compliance packages', 'Provide Tier A tax reserve policy exports from aggregate state and receipt metadata.', 'Policy, treasury, and evidence sections only; no employee amounts.'],
              ['Notifications', 'Highlight pending claims, settlement issues, and receipt activity.', 'Workflow event metadata only.'],
              ['CipherBot query', 'Answer support questions with indexed context instead of static copy alone.', 'Read-only; never executes, funds, or discloses on behalf of the user.'],
              ['Exports', 'Package organization data as JSON or CSV for offline review.', 'Same aggregate boundary as the live API.'],
              ['Batch manifests', 'Store confirmed batch payroll metadata after submission.', 'Only org/run/employee/role/payment/tx — no salary amounts.'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'arch-sdk',
      group: 'System Design',
      label: 'SDK & shared types',
      eyebrow: 'SDK',
      title: 'How the shared SDK prevents frontend-backend drift',
      summary:
        'packages/cipherroll-sdk/ exists so that contract reads, backend client logic, runtime config, and product types stay consistent across Vercel frontend, Render backend, scripts, and docs.',
      searchText:
        'sdk shared types runtime config backend client contract views compliance drift prevention package',
      content: (
        <div className="space-y-8">
          <DataTable
            headers={['SDK module', 'Purpose', 'Used by']}
            rows={[
              ['runtime.ts', 'Chain config, contract addresses, label generation helpers (toBytes32Label, makeHighEntropyBytes32Label).', 'Frontend, backend, scripts.'],
              ['frontend-types.ts', 'TypeScript types for all contract structs: OrganizationView, PayrollRunView, PayrollAllocationMetaView, TreasuryAdapterConfig, etc.', 'Frontend, SDK contract-views.'],
              ['backend-types.ts', 'TypeScript types for backend API responses: OrganizationReportSummary, TreasuryExposureSummary, CompliancePackage, etc.', 'Backend, SDK backend-client.'],
              ['contract-views.ts', 'Mapper functions that normalize raw contract return values into typed views (mapOrganizationResult, mapPayrollRunResult, etc.).', 'Frontend cipherroll-client.'],
              ['backend-client.ts', 'CipherRollBackendClient class with typed methods for every API endpoint.', 'Frontend cipherroll-backend, backend internal.'],
              ['compliance.ts', 'Tax reserve policy helpers: normalizeComplianceTaxReserveBps(), calculateAggregateReserveAmount(), formatCompliancePolicyLabel().', 'Frontend tax-authority page, backend compliance routes.'],
              ['cipherbot.ts', 'CipherBot scope types, live context types, and answer types.', 'Frontend CipherBotWidget, backend cipherbot-assistant.'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'arch-hosted',
      group: 'System Design',
      label: 'Hosted stack',
      eyebrow: 'Deployment',
      title: 'Current deployment architecture',
      summary:
        'The hosted stack matters because the frontend now depends on backend summaries, notifications, exports, and support APIs to behave like the intended product.',
      searchText:
        'hosted stack deployment vercel render supabase postgres architecture production frontend backend database',
      content: (
        <div className="space-y-8">
          <DataTable
            headers={['Layer', 'Service', 'Role']}
            rows={[
              ['Frontend', 'Vercel', 'Next.js app serving admin, employee, auditor, docs, and tax compliance portals.'],
              ['Backend', 'Render', 'Node.js service running the indexer, API routes, and CipherBot query handler.'],
              ['Database', 'Supabase Postgres', 'Persistent indexed state for organizations, runs, payments, receipts, notifications, events, and manifests.'],
              ['Chain', 'Arbitrum Sepolia', 'Target network for all contract interactions and CoFHE coprocessor operations.'],
              ['FHE', 'Fhenix CoFHE', 'Coprocessor that handles encrypted operations (FHE.add, FHE.gte, FHE.select, verifyDecryptResult, publishDecryptResult).'],
            ]}
          />

          <Callout title="Production check" tone="orange">
            In the deployed frontend DevTools Network tab, verify that <K>CipherBot</K> hits
            /api/chat on Vercel, <K>backend reporting</K> requests hit the Render host, and no
            product data fetch is trying to use <K>localhost</K> or 127.0.0.1 in production.
          </Callout>
        </div>
      ),
    },
  ],
  contracts: [
    {
      id: 'ct-payroll',
      group: 'Core Contracts',
      label: 'CipherRollPayroll',
      eyebrow: 'CipherRollPayroll',
      title: 'Confidential payroll management — the central contract',
      summary:
        'CipherRollPayroll owns all encrypted organization budget state, payroll run lifecycle, employee allocation handles, and settlement coordination. All salary amounts are stored as euint128 handles rather than plaintext values.',
      searchText:
        'cipherroll payroll contract create organization fund budget issue allocation claim settlement run lifecycle euint128 encrypted',
      content: (
        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Key structs</h3>
            <DataTable
              headers={['Struct', 'Fields', 'Notes']}
              rows={[
                ['Organization', 'admin, treasuryAdapter, metadataHash, treasuryRouteId, reservedAdminSlots, reservedQuorum, createdAt, updatedAt, exists', 'Created via createOrganization(). Admin is msg.sender.'],
                ['PayrollRun', 'orgId, settlementAssetId, fundingDeadline, plannedHeadcount, allocationCount, claimedCount, createdAt, fundedAt, activatedAt, finalizedAt, status, exists', 'Status transitions: Draft to Funded to Active to Finalized.'],
                ['PayrollAllocationMeta', 'employee, paymentId, memoHash, createdAt, isVesting, vestingStart, vestingEnd, exists', 'The allocation amount is stored separately as an euint128 mapping.'],
                ['PayrollSettlementRequest', 'requestId, adapter, payoutAsset, confidentialAsset, requestedAt, exists', 'Created during wrapper requestPayrollSettlement(). Pinned to the adapter that created it.'],
                ['OrganizationInsights', 'totalPayrollItems, activePayrollItems, claimedPayrollItems, vestingPayrollItems, employeeRecipients, lastIssuedAt, lastClaimedAt', 'Plain counters — publicly readable.'],
              ]}
            />
          </div>

          <StateDiagram
            title="Payroll run state machine"
            states={[
              { name: 'Draft', color: 'gray' },
              { name: 'Funded', color: 'blue' },
              { name: 'Active', color: 'green' },
              { name: 'Finalized', color: 'cyan' },
            ]}
            transitions={[
              { from: 0, to: 1, label: 'fundPayrollRun' },
              { from: 1, to: 2, label: 'activatePayrollRun' },
              { from: 2, to: 3, label: 'all claims done' },
            ]}
          />

          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Write functions</h3>
            <DataTable
              headers={['Function', 'Access', 'FHE operations']}
              rows={[
                ['createOrganization(...)', 'Any caller', 'Initializes budget/committed/available as encrypted zero.'],
                ['configureOrganizationGovernanceExecutor(...)', 'Primary admin only', 'None.'],
                ['configureTreasury(...)', 'Governed operator', 'None.'],
                ['depositBudget(...)', 'Admin', 'FHE.add to budget and available; clear funding limit gates treasury-backed run funding.'],
                ['createPayrollRun(...)', 'Operational operator', 'None.'],
                ['fundPayrollRun(...)', 'Admin', 'FHE.gte(available, amount) then FHE.select then FHE.add(committed) / FHE.sub(available).'],
                ['fundPayrollRunFromTreasury(...)', 'Operational operator', 'Requires clear funding amount within deposited budget limit, then converts cleartext to euint128 and updates committed/available handles.'],
                ['activatePayrollRun(...)', 'Operational operator', 'None. Requires status == Funded.'],
                ['issueConfidentialPayroll(...)', 'Admin (governed if active)', 'FHE.gte/select for capacity check. FHE.add(committed), FHE.sub(available).'],
                ['issueConfidentialPayrollToRun(...)', 'Admin (governed if active)', 'FHE.asEuint128 for the granted amount. No capacity check — run-allocated.'],
                ['issueVestingAllocation(...)', 'Admin (governed if active)', 'Same FHE operations as issueConfidentialPayroll.'],
                ['issueVestingAllocationToRun(...)', 'Admin (governed if active)', 'Same as issueConfidentialPayrollToRun with vesting timestamps.'],
                ['claimPayroll(...)', 'Employee', 'None. Only works when no treasury adapter configured.'],
                ['claimPayrollWithSettlement(...)', 'Employee', 'FHE.verifyDecryptResult to validate the settlement proof.'],
                ['requestPayrollSettlement(...)', 'Employee', 'FHE.verifyDecryptResult. Calls adapter.requestPayrollSettlement().'],
                ['finalizePayrollSettlement(...)', 'Employee', 'Calls adapter.finalizePayrollSettlement(). Verifies adapter matches request.'],
              ]}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">View functions</h3>
            <DataTable
              headers={['Function', 'Access', 'Returns']}
              rows={[
                ['getOrganization(orgId)', 'Any caller', 'Organization struct.'],
                ['getOrganizationGovernanceExecutor(orgId)', 'Any caller', 'Address of the governance executor contract.'],
                ['getTreasuryAdapterDetails(orgId)', 'Any caller', 'adapter, routeId, adapterId, adapterName, supportsConfidentialSettlement, settlementAsset, confidentialSettlementAsset, available/reserved funds.'],
                ['getTreasuryPayrollRunFunding(orgId, runId)', 'Any caller', 'Same as above plus reservedPayrollRunFunds.'],
                ['getAdminBudgetHandles(orgId)', 'Admin only', 'euint128 budget, committed, available handles. Decrypt with decryptForView().'],
                ['getAuditorEncryptedSummaryHandles(orgId)', 'Any caller (org must exist)', 'euint128 budget, committed, available handles. Decrypt with shared permit.'],
                ['getEmployeeAllocations(orgId, employee)', 'Employee only (msg.sender == employee)', 'paymentIds[], memoHashes[], createdAts[], euint128[] amount handles.'],
                ['getPayrollAllocationMeta(paymentId)', 'Employee only', 'PayrollAllocationMeta struct.'],
                ['getPayrollRun(runId)', 'Any caller', 'PayrollRun struct.'],
                ['getOrganizationPayrollRunIds(orgId)', 'Any caller', 'bytes32[] of run ids.'],
                ['getPayrollRunForPayment(paymentId)', 'Any caller', 'bytes32 payroll run id.'],
                ['isPayrollClaimed(paymentId)', 'Any caller', 'bool.'],
                ['getPayrollSettlementRequest(paymentId)', 'Employee only', 'PayrollSettlementRequest struct.'],
                ['getOrganizationInsights(orgId)', 'Admin only', 'OrganizationInsights struct.'],
                ['getAuditorOrganizationInsights(orgId)', 'Any caller (org must exist)', 'OrganizationInsights struct.'],
              ]}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'ct-governance',
      group: 'Core Contracts',
      label: 'CipherRollGovernance',
      eyebrow: 'CipherRollGovernance',
      title: 'M-of-N governance for sensitive payroll actions',
      summary:
        'CipherRollGovernance implements the ICipherRollGovernanceExecutor interface. It manages admin sets, quorum thresholds, proposals, approvals, and execution. The payroll contract calls it before governed actions.',
      searchText:
        'cipherroll governance contract m of n proposal approval execution quorum admin bootstrap consume wallet executor',
      content: (
        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Governance action types</h3>
            <DataTable
              headers={['Action type', 'Enum value', 'Execution path']}
              rows={[
                ['ConfigureTreasury', '0', 'Direct execute — contract calls payroll.configureTreasury().'],
                ['CreatePayrollRun', '1', 'Direct execute — contract calls payroll.createPayrollRun().'],
                ['FundPayrollRun', '2', 'Wallet executor — proposer must call the payroll function from their wallet.'],
                ['FundPayrollRunFromTreasury', '3', 'Direct execute.'],
                ['ActivatePayrollRun', '4', 'Direct execute.'],
                ['IssueConfidentialPayroll', '5', 'Wallet executor — encrypted input requires the original proposer wallet.'],
                ['IssueConfidentialPayrollToRun', '6', 'Wallet executor.'],
                ['IssueVestingAllocation', '7', 'Wallet executor.'],
                ['IssueVestingAllocationToRun', '8', 'Wallet executor.'],
                ['AddAdmin', '9', 'Direct execute — contract adds admin to governance set.'],
                ['RemoveAdmin', '10', 'Direct execute — contract removes admin from governance set.'],
                ['UpdateQuorum', '11', 'Direct execute — contract updates the quorum threshold.'],
              ]}
            />
          </div>

          <StateDiagram
            title="Governance proposal lifecycle"
            states={[
              { name: 'Proposed', color: 'blue' },
              { name: 'Approved', color: 'green' },
              { name: 'Executed', color: 'cyan' },
              { name: 'Cancelled', color: 'gray' },
            ]}
            transitions={[
              { from: 0, to: 1, label: 'quorum reached' },
              { from: 1, to: 2, label: 'execute' },
              { from: 0, to: 3, label: 'cancel' },
            ]}
          />

          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Write functions</h3>
            <DataTable
              headers={['Function', 'Access', 'Effect']}
              rows={[
                ['bootstrapOrganization(orgId)', 'Primary admin (from payroll org)', 'Initializes governance with admin=1, quorum from org.'],
                ['bootstrapOrganizationAdmin(orgId, adminToAdd)', 'Primary admin, governance inactive', 'Adds admin before governance is active. Cannot exceed quorum.'],
                ['proposeGovernanceAction(orgId, actionType, payload, expiresAt)', 'Any org admin', 'Creates proposal. Auto-approves by proposer. Returns proposalId.'],
                ['approveGovernanceProposal(proposalId)', 'Any org admin (not yet approved)', 'Increments approval count.'],
                ['revokeGovernanceApproval(proposalId)', 'Admin who previously approved', 'Decrements approval count.'],
                ['cancelGovernanceProposal(proposalId)', 'Proposer or primary admin', 'Marks proposal as cancelled.'],
                ['executeGovernanceProposal(proposalId)', 'Any org admin', 'Direct-execute actions only. Requires approvalCount to reach quorum.'],
                ['consumeApprovedProposalExecution(key, actionType, payloadHash, caller)', 'Payroll contract only', 'Validates wallet-executor proposals. Called internally by payroll for governed issuance.'],
              ]}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">View functions</h3>
            <DataTable
              headers={['Function', 'Returns']}
              rows={[
                ['getOrganizationGovernance(orgId)', 'OrganizationGovernance struct.'],
                ['getOrganizationAdmins(orgId)', 'address[] of current admin set.'],
                ['getOrganizationGovernanceProposalIds(orgId)', 'bytes32[] of all proposal ids.'],
                ['getGovernanceProposal(proposalId)', 'GovernanceProposal struct.'],
                ['hasApprovedGovernanceProposal(proposalId, account)', 'bool.'],
                ['isOrganizationAdmin(orgId, account)', 'bool.'],
                ['isGovernanceActive(orgId)', 'bool — true when initialized, quorum greater than 1, and adminCount reaches quorum.'],
              ]}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'ct-auditor',
      group: 'Core Contracts',
      label: 'CipherRollAuditorDisclosure',
      eyebrow: 'CipherRollAuditorDisclosure',
      title: 'Aggregate-only auditor disclosure and receipt generation',
      summary:
        'CipherRollAuditorDisclosure reads aggregate handles from the payroll contract and provides verify/publish receipt flows for single and batch metrics. It never exposes employee-level data.',
      searchText:
        'cipherroll auditor disclosure contract aggregate metric verify publish receipt batch budget committed available',
      content: (
        <div className="space-y-8">
          <DataTable
            headers={['Metric', 'Enum value', 'Source handle']}
            rows={[
              ['Budget', '0', 'payrollCore.getAuditorEncryptedSummaryHandles(orgId) then budget'],
              ['Committed', '1', 'payrollCore.getAuditorEncryptedSummaryHandles(orgId) then committed'],
              ['Available', '2', 'payrollCore.getAuditorEncryptedSummaryHandles(orgId) then available'],
            ]}
          />

          <FlowDiagram
            steps={['decryptForTx on aggregate handle', 'Choose verify or publish', 'Submit receipt on-chain', 'Event emitted with cleartext']}
          />

          <DataTable
            headers={['Function', 'Access', 'Effect']}
            rows={[
              ['getAuditorEncryptedSummaryHandles(orgId)', 'Any caller', 'Returns euint128 budget, committed, available from payroll. Decrypt with shared permit.'],
              ['getAuditorOrganizationSummary(orgId)', 'Any caller', 'Returns AuditorOrganizationSummary with run counts, treasury posture, and insights.'],
              ['getAuditorAggregateHandle(orgId, metric)', 'Any caller', 'Returns the raw bytes32 handle for a single metric.'],
              ['verifyAuditorAggregateDisclosure(orgId, metric, cleartextValue, signature)', 'Any caller', 'Calls FHE.verifyDecryptResult(). Emits AuditorAggregateDisclosureRecorded with published=false.'],
              ['publishAuditorAggregateDisclosure(orgId, metric, cleartextValue, signature)', 'Any caller', 'Calls FHE.publishDecryptResult(). Emits event with published=true. Value becomes visible on-chain.'],
              ['verifyAuditorAggregateDisclosureBatch(orgId, metrics[], values[], signatures[])', 'Any caller', 'Verifies all metrics. Emits AuditorAggregateDisclosureBatchRecorded with batchHash.'],
              ['publishAuditorAggregateDisclosureBatch(orgId, metrics[], values[], signatures[])', 'Any caller', 'Publishes all metrics. Each value becomes visible on-chain.'],
            ]}
          />

          <StateDiagram
            title="Receipt mode branching"
            states={[
              { name: 'Decrypt handle', color: 'blue' },
              { name: 'Verify', color: 'green' },
              { name: 'Publish', color: 'orange' },
            ]}
            transitions={[
              { from: 0, to: 1, label: 'verifyDecryptResult' },
              { from: 0, to: 2, label: 'publishDecryptResult' },
            ]}
          />

          <Callout title="Batch scope" tone="orange">
            Batch receipts remain limited to <K>organization-level aggregate metrics</K> (budget,
            committed, available). They do not expose <K>employee-level</K> encrypted state. The batch
            hash is keccak256(abi.encode(metrics, cleartextValues, ctHashes)).
          </Callout>
        </div>
      ),
    },
    {
      id: 'ct-adapter',
      group: 'Core Contracts',
      label: 'ITreasuryAdapter',
      eyebrow: 'Treasury Adapter',
      title: 'Pluggable treasury interface for settlement coordination',
      summary:
        'Both the Direct and Wrapper adapters implement ITreasuryAdapter. The interface defines deposit, reserve, settle, request, and finalize methods. The payroll contract routes calls through whichever adapter is configured for the organization.',
      searchText:
        'treasury adapter interface deposit reserve settle request finalize settlement direct wrapper pluggable',
      content: (
        <div className="space-y-8">
          <SequenceFlow
            title="Adapter lifecycle"
            steps={[
              { label: 'Deposit funds', detail: 'Admin deposits ERC20 into the adapter. Wrapper adapter shields tokens into confidential FHERC20 balance.' },
              { label: 'Reserve for run', detail: 'Payroll contract instructs the adapter to move funds from available to reserved (org + run level).' },
              { label: 'Settle or request', detail: 'Direct adapter transfers tokens to employee immediately. Wrapper adapter creates a pending unshield request instead.' },
              { label: 'Finalize (wrapper only)', detail: 'Employee submits decryption proof. Wrapper adapter claims unshielded balance and releases payout token.' },
            ]}
          />

          <DataTable
            headers={['ITreasuryAdapter method', 'Direct adapter', 'Wrapper adapter']}
            rows={[
              ['adapterId()', 'Returns fixed bytes32', 'Returns fixed bytes32'],
              ['adapterName()', 'Mock Settlement Treasury', 'Mock FHERC20 Treasury'],
              ['supportsConfidentialSettlement()', 'false', 'true'],
              ['settlementAsset()', 'ERC20 payroll token', 'ERC20 payroll token'],
              ['confidentialSettlementAsset()', 'address(0)', 'FHERC20 wrapper token'],
              ['depositPayrollFunds(orgId, amount)', 'Transfer ERC20 from sender to adapter, add to available', 'Transfer ERC20, shield into confidential token, add to available'],
              ['reservePayrollFunding(orgId, runId, amount)', 'Move available to reserved', 'Move available to reserved'],
              ['settlePayroll(...)', 'Transfer reserved tokens to employee', 'Reverts — use request/finalize'],
              ['requestPayrollSettlement(...)', 'Reverts — use settlePayroll', 'Create pending unshield request'],
              ['finalizePayrollSettlement(...)', 'Reverts — use settlePayroll', 'Claim unshielded balance with proof, release payout token'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'ct-events',
      group: 'Reference',
      label: 'Events reference',
      eyebrow: 'Events',
      title: 'Complete event inventory across all contracts',
      summary:
        'All events emitted by CipherRoll contracts. Events are public by EVM design — the indexed topics and data fields are visible to any chain observer.',
      searchText:
        'events reference organization created budget deposited payroll issued claimed settled run created funded activated finalized governance proposal approved executed auditor disclosure recorded',
      content: (
        <div className="space-y-8">
          <DataTable
            headers={['Contract', 'Event', 'Indexed parameters']}
            rows={[
              ['Payroll', 'OrganizationCreated', 'orgId, admin'],
              ['Payroll', 'OrganizationGovernanceExecutorConfigured', 'orgId, governanceExecutor, configuredBy'],
              ['Payroll', 'TreasuryConfigured', 'orgId, admin'],
              ['Payroll', 'BudgetDeposited', 'orgId, admin (amount obscured: always 0)'],
              ['Payroll', 'ConfidentialPayrollIssued', 'orgId, paymentId, employee'],
              ['Payroll', 'PayrollClaimed', 'orgId, paymentId, employee'],
              ['Payroll', 'PayrollSettled', 'orgId, paymentId, employee (includes asset, amount)'],
              ['Payroll', 'PayrollSettlementRequested', 'orgId, paymentId, employee (includes payoutAsset, confidentialAsset, requestId)'],
              ['Payroll', 'PayrollRunCreated', 'orgId, payrollRunId (includes fundingDeadline)'],
              ['Payroll', 'PayrollRunFunded', 'orgId, payrollRunId, admin'],
              ['Payroll', 'PayrollRunTreasuryFunded', 'orgId, payrollRunId, admin (includes asset, amount)'],
              ['Payroll', 'PayrollRunActivated', 'orgId, payrollRunId, admin'],
              ['Payroll', 'PayrollRunFinalized', 'orgId, payrollRunId'],
              ['Governance', 'OrganizationGovernanceInitialized', 'orgId, primaryAdmin'],
              ['Governance', 'OrganizationAdminBootstrapped', 'orgId, admin, addedBy'],
              ['Governance', 'OrganizationAdminAdded', 'orgId, admin, executedBy'],
              ['Governance', 'OrganizationAdminRemoved', 'orgId, admin, executedBy'],
              ['Governance', 'OrganizationQuorumUpdated', 'orgId (includes previousQuorum, nextQuorum, executedBy)'],
              ['Governance', 'GovernanceProposalCreated', 'orgId, proposalId (includes actionType, proposer, payloadHash, expiresAt)'],
              ['Governance', 'GovernanceProposalApproved', 'orgId, proposalId, admin (includes approvalCount)'],
              ['Governance', 'GovernanceProposalRevoked', 'orgId, proposalId, admin (includes approvalCount)'],
              ['Governance', 'GovernanceProposalCancelled', 'orgId, proposalId, admin'],
              ['Governance', 'GovernanceProposalExecuted', 'orgId, proposalId (includes actionType, executor)'],
              ['Auditor', 'AuditorAggregateDisclosureRecorded', 'orgId, metric, auditor (includes cleartextValue, published)'],
              ['Auditor', 'AuditorAggregateDisclosureBatchRecorded', 'orgId, auditor, batchHash (includes published)'],
            ]}
          />

          <SectionLabel tone="orange">Revert and require messages</SectionLabel>
          <DataTable
            headers={['Contract', 'Revert message', 'Trigger condition']}
            rows={[
              ['Payroll', 'unknown org', 'orgId does not map to an existing organization.'],
              ['Payroll', 'not admin', 'Caller is not a recognized admin for the org.'],
              ['Payroll', 'primary admin only', 'Caller must be the org primary admin.'],
              ['Payroll', 'org exists', 'createOrganization called with an orgId that already exists.'],
              ['Payroll', 'admin slots required', 'reservedAdminSlots is zero on creation.'],
              ['Payroll', 'quorum required', 'reservedQuorum is zero on creation.'],
              ['Payroll', 'executor required', 'Governance executor address is zero.'],
              ['Payroll', 'adapter required', 'Treasury adapter address is zero.'],
              ['Payroll', 'payroll run missing', 'Run id does not exist.'],
              ['Payroll', 'payroll run exists', 'createPayrollRun called with an existing runId.'],
              ['Payroll', 'payroll run already active', 'Attempt to fund or issue to an already-Active run.'],
              ['Payroll', 'payroll run finalized', 'Attempt to modify a Finalized run.'],
              ['Payroll', 'payroll run not funded', 'activatePayrollRun called before funding.'],
              ['Payroll', 'payroll run not active', 'Employee claim on a run that is not Active.'],
              ['Payroll', 'payroll run has no allocations', 'Activate or fund a run with zero allocations.'],
              ['Payroll', 'payroll run full', 'Allocation count exceeds plannedHeadcount.'],
              ['Payroll', 'payroll run org mismatch', 'Run orgId does not match the provided orgId.'],
              ['Payroll', 'funding deadline required', 'Deadline is not in the future.'],
              ['Payroll', 'funding window closed', 'Current timestamp exceeds the run fundingDeadline.'],
              ['Payroll', 'treasury amount required', 'Cleartext treasury funding amount is zero.'],
              ['Payroll', 'treasury route missing', 'No adapter configured for the org.'],
              ['Payroll', 'treasury route requires funded asset', 'configureTreasury called before budget deposit.'],
              ['Payroll', 'employee required', 'Employee address is zero.'],
              ['Payroll', 'not employee', 'Caller does not match the allocation employee.'],
              ['Payroll', 'employee only', 'Read restricted to the allocated employee.'],
              ['Payroll', 'payment exists', 'Allocation already created for this paymentId.'],
              ['Payroll', 'payment missing', 'PaymentId does not exist.'],
              ['Payroll', 'already claimed', 'Employee tries to claim an already-claimed allocation.'],
              ['Payroll', 'settlement route changed', 'Finalize adapter differs from the request adapter.'],
              ['Payroll', 'settlement already pending', 'Duplicate settlement request for the same payment.'],
              ['Payroll', 'settlement proof required', 'Missing or invalid decryptForTx signature.'],
              ['Payroll', 'settlement request missing', 'No pending request for this paymentId.'],
              ['Payroll', 'settlement asset missing', 'Settlement asset address is zero.'],
              ['Payroll', 'settlement unavailable', 'Adapter reports insufficient funds.'],
              ['Payroll', 'invalid vesting', 'Vesting timestamps are invalid or zero.'],
              ['Payroll', 'vesting active', 'Claim attempted before vesting end timestamp.'],
              ['Payroll', 'wrapper settlement requires request/finalize', 'Direct settlePayroll called on wrapper adapter.'],
              ['Payroll', 'governance approval required', 'Governed action attempted without governance approval.'],
              ['Payroll', 'governance inactive', 'Governance not initialized or quorum not met.'],
              ['Payroll', 'governance org mismatch', 'Governance consumed for wrong org.'],
              ['Governance', 'org not initialized', 'Governance not bootstrapped for this org.'],
              ['Governance', 'already initialized', 'bootstrapOrganization called twice.'],
              ['Governance', 'org missing', 'Org does not exist in payroll.'],
              ['Governance', 'not admin', 'Caller is not in the governance admin set.'],
              ['Governance', 'primary admin only', 'Caller must be the org primary admin.'],
              ['Governance', 'payroll only', 'Only the payroll contract can call this function.'],
              ['Governance', 'payroll required', 'Payroll address is zero.'],
              ['Governance', 'governance active', 'Cannot bootstrap admins while governance is active.'],
              ['Governance', 'governance inactive', 'Governance must be active to propose/approve.'],
              ['Governance', 'payload required', 'Proposal payload is empty.'],
              ['Governance', 'payload mismatch', 'Consumed proposal payload does not match.'],
              ['Governance', 'action mismatch', 'Action type does not match the proposal.'],
              ['Governance', 'invalid expiration', 'ExpiresAt is not in the future.'],
              ['Governance', 'proposal missing', 'ProposalId does not exist.'],
              ['Governance', 'proposal executed', 'Proposal already executed.'],
              ['Governance', 'proposal cancelled', 'Proposal was cancelled.'],
              ['Governance', 'proposal expired', 'ExpiresAt has passed.'],
              ['Governance', 'already approved', 'Admin already approved this proposal.'],
              ['Governance', 'approval missing', 'Admin has not approved this proposal.'],
              ['Governance', 'no approvals', 'Approval count is zero on revoke.'],
              ['Governance', 'admin exists', 'Admin already in the set.'],
              ['Governance', 'admin missing', 'Admin not found in the set.'],
              ['Governance', 'admin required', 'Cannot remove the last admin.'],
              ['Governance', 'last admin', 'Cannot remove the final admin.'],
              ['Governance', 'quorum required', 'Quorum is zero.'],
              ['Governance', 'proposer must execute', 'Wallet-executor action must be executed by the proposer.'],
              ['Governance', 'direct execute action', 'Wallet-executor action cannot be direct-executed.'],
              ['Governance', 'unsupported governance action', 'Action type enum is out of range.'],
              ['Auditor', 'unknown org', 'OrgId does not exist.'],
              ['Auditor', 'core required', 'Payroll core address is zero.'],
              ['Auditor', 'unknown metric', 'Metric enum value is out of range (valid: 0, 1, 2).'],
              ['Auditor', 'batch empty', 'Metrics array is empty.'],
              ['Auditor', 'batch length', 'Metrics and values array lengths differ.'],
              ['Auditor', 'batch sig length', 'Metrics and signatures array lengths differ.'],
            ]}
          />
        </div>
      ),
    },
  ],
  api: [
    {
      id: 'api-endpoints',
      group: 'Backend API',
      label: 'REST endpoints',
      eyebrow: 'Backend API',
      title: 'Complete backend API surface',
      summary:
        'The CipherRoll backend exposes REST endpoints for health, status, read models, reporting, compliance, exports, notifications, batch manifests, and CipherBot queries.',
      searchText:
        'backend api endpoints rest health status organizations runs payments receipts notifications events treasury summary compliance export cipherbot',
      content: (
        <div className="space-y-8">
          <DataTable
            headers={['Method', 'Endpoint', 'Description']}
            rows={[
              ['GET', '/api/health', 'Basic health check. Returns ok, service, timestamp, chainId.'],
              ['GET', '/api/status', 'Indexer and runtime status: latest indexed/known block, object counts.'],
              ['GET', '/api/organizations', 'List organizations. Query: limit (default 100).'],
              ['GET', '/api/organizations/:orgId', 'Single organization record.'],
              ['GET', '/api/organizations/:orgId/runs', 'Payroll runs for org. Query: status, limit.'],
              ['GET', '/api/organizations/:orgId/payments', 'Payments for org. Query: limit, claimState, settlementState.'],
              ['GET', '/api/organizations/:orgId/batch-payroll-manifests', 'Batch manifests. Query: payrollRunId.'],
              ['GET', '/api/payroll-runs/:runId', 'Single payroll run record.'],
              ['GET', '/api/payments/:paymentId', 'Single payment record.'],
              ['GET', '/api/audit-receipts', 'Audit receipts. Query: orgId, limit, published, receiptKind.'],
              ['GET', '/api/events', 'Raw indexed events. Query: orgId, event, limit.'],
              ['GET', '/api/notifications', 'Workflow notifications. Query: orgId, limit, category, severity.'],
              ['GET', '/api/reports/organizations/:orgId/summary', 'Aggregate-first organization report summary.'],
              ['GET', '/api/reports/organizations/:orgId/treasury', 'Treasury exposure: route health, inventory, backlog, run exposure.'],
              ['GET', '/api/reports/organizations/:orgId/audit-package', 'Organization audit package.'],
              ['GET', '/api/reports/organizations/:orgId/export', 'Operator export. Query: format=json or csv.'],
              ['GET', '/api/compliance/organizations/:orgId/package', 'Tier A compliance package. Query: taxReserveBps.'],
              ['GET', '/api/compliance/organizations/:orgId/export', 'Compliance export. Query: format=json or csv, taxReserveBps.'],
              ['POST', '/api/batch-payroll-manifests', 'Create batch manifest entry. Body: orgId, payrollRunId, employee, roleSlug, roleLabel, paymentId, txHash.'],
              ['POST', '/api/cipherbot/query', 'CipherBot Q-and-A. Body: scope, question, liveContext.'],
              ['POST', '/api/admin/reindex', 'Force reindex. Body: resetToBlock. Requires Bearer admin token.'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'api-sdk',
      group: 'Backend API',
      label: 'SDK client',
      eyebrow: 'SDK Client',
      title: 'How to use the CipherRollBackendClient from the shared SDK',
      summary:
        'The SDK provides a typed CipherRollBackendClient class that wraps all backend endpoints. Both the frontend and backend import it from the same package to prevent drift.',
      searchText:
        'sdk backend client create cipherroll package typed methods fetch',
      content: (
        <div className="space-y-8">
          <CodeBlock title="Create a backend client" language="ts" code={backendClientExample} />

          <DataTable
            headers={['Client method', 'Backend endpoint', 'Returns']}
            rows={[
              ['getHealth()', 'GET /api/health', 'CipherRollBackendHealth'],
              ['getStatus()', 'GET /api/status', 'IndexerStatus'],
              ['getOrganizations(options?)', 'GET /api/organizations', 'OrganizationRecord[]'],
              ['getOrganization(orgId)', 'GET /api/organizations/:orgId', 'OrganizationRecord'],
              ['getOrganizationRuns(orgId, options?)', 'GET /api/organizations/:orgId/runs', 'PayrollRunRecord[]'],
              ['getOrganizationPayments(orgId, options?)', 'GET /api/organizations/:orgId/payments', 'PaymentRecord[]'],
              ['getPayrollRun(runId)', 'GET /api/payroll-runs/:runId', 'PayrollRunRecord'],
              ['getPayment(paymentId)', 'GET /api/payments/:paymentId', 'PaymentRecord'],
              ['getBatchPayrollManifests(orgId, runId?)', 'GET /api/organizations/:orgId/batch-payroll-manifests', 'BatchPayrollManifestRecord[]'],
              ['createBatchPayrollManifest(options)', 'POST /api/batch-payroll-manifests', 'BatchPayrollManifestRecord'],
              ['getAuditReceipts(options?)', 'GET /api/audit-receipts', 'AuditReceiptRecord[]'],
              ['getEvents(options?)', 'GET /api/events', 'RawEventRecord[]'],
              ['getNotifications(options?)', 'GET /api/notifications', 'NotificationRecord[]'],
              ['getOrganizationReportSummary(orgId)', 'GET /api/reports/organizations/:orgId/summary', 'OrganizationReportSummary'],
              ['getTreasuryExposureSummary(orgId)', 'GET /api/reports/organizations/:orgId/treasury', 'TreasuryExposureSummary'],
              ['getCompliancePackage(orgId, options?)', 'GET /api/compliance/organizations/:orgId/package', 'CompliancePackage'],
              ['getOrganizationAuditPackage(orgId)', 'GET /api/reports/organizations/:orgId/audit-package', 'OrganizationAuditPackage'],
              ['getOrganizationExportPackage(orgId)', 'GET /api/reports/organizations/:orgId/export', 'OrganizationExportPackage'],
              ['queryCipherBot(options)', 'POST /api/cipherbot/query', 'CipherBotAnswer'],
              ['reindex(options?)', 'POST /api/admin/reindex', '{ ok, status }'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'api-compliance',
      group: 'Backend API',
      label: 'Compliance SDK',
      eyebrow: 'Compliance',
      title: 'Compliance helpers in the shared SDK',
      summary:
        'The compliance module provides tax reserve policy normalization, aggregate reserve calculation, and policy label formatting — used by both the frontend tax page and backend compliance routes.',
      searchText:
        'compliance sdk tax reserve bps basis points aggregate calculate normalize format policy',
      content: (
        <div className="space-y-8">
          <CodeBlock title="Compliance package query" language="ts" code={complianceExample} />

          <DataTable
            headers={['Helper', 'Purpose', 'Details']}
            rows={[
              ['normalizeComplianceTaxReserveBps(value)', 'Clamp and parse a reserve basis-point input.', 'Default: 1500 (15.00%). Range: 0 to 5000.'],
              ['calculateAggregateReserveAmount(value, reserveBps)', 'Compute the aggregate reserve from a committed amount.', '(value times bps) divided by 10_000.'],
              ['formatCompliancePolicyLabel(reserveBps)', 'Format a human-readable policy label.', 'e.g. 15.00% aggregate reserve policy.'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'api-config',
      group: 'Configuration',
      label: 'Configuration',
      eyebrow: 'Configuration',
      title: 'Core runtime values and environment variables',
      summary:
        'These are the constants and environment variables reviewers and developers need first when checking docs, frontend behavior, or network alignment.',
      searchText:
        'configuration runtime values constants network chain id contract address backend base url default workspace environment variables',
      content: (
        <div className="space-y-8">
          <DataTable
            headers={['Item', 'Current value']}
            rows={[
              ['Target network', TARGET_CHAIN_NAME],
              ['Target chain id', String(TARGET_CHAIN_ID)],
              ['Default workspace seed', DEFAULT_ORG_ID],
              ['Payroll contract', CONTRACT_ADDRESS],
              ['Auditor disclosure contract', AUDITOR_DISCLOSURE_CONTRACT_ADDRESS],
              ['Governance contract', GOVERNANCE_CONTRACT_ADDRESS],
              ['Direct settlement adapter', DIRECT_SETTLEMENT_ADAPTER_ADDRESS],
              ['Wrapper settlement adapter', WRAPPER_SETTLEMENT_ADAPTER_ADDRESS],
              ['Backend base URL', BACKEND_BASE_URL || 'Configured at runtime'],
              ['Hosted storage', 'Supabase Postgres'],
            ]}
          />

          <DataTable
            headers={['Environment variable', 'Used by', 'Purpose']}
            rows={[
              ['ARBITRUM_SEPOLIA_RPC_URL', 'Backend', 'RPC endpoint for event indexing.'],
              ['NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS', 'Frontend + Backend', 'CipherRollPayroll address.'],
              ['NEXT_PUBLIC_CIPHERROLL_AUDITOR_DISCLOSURE_ADDRESS', 'Frontend + Backend', 'CipherRollAuditorDisclosure address.'],
              ['NEXT_PUBLIC_CIPHERROLL_GOVERNANCE_ADDRESS', 'Frontend + Backend', 'CipherRollGovernance address.'],
              ['NEXT_PUBLIC_CIPHERROLL_DIRECT_SETTLEMENT_ADAPTER', 'Frontend', 'Direct adapter address for admin treasury setup.'],
              ['NEXT_PUBLIC_CIPHERROLL_WRAPPER_SETTLEMENT_ADAPTER', 'Frontend', 'Wrapper adapter address for admin treasury setup.'],
              ['NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL', 'Frontend', 'Backend API host for read model queries.'],
              ['CIPHERROLL_DATABASE_URL', 'Backend', 'Postgres connection string.'],
              ['CIPHERROLL_BACKEND_ADMIN_TOKEN', 'Backend', 'Bearer token for admin-only endpoints (e.g. reindex).'],
              ['CIPHERROLL_BACKEND_PORT', 'Backend', 'Server port (default 4000).'],
              ['CIPHERROLL_INDEXER_POLL_INTERVAL_MS', 'Backend', 'Indexer poll interval (default 30000).'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'api-cofhe',
      group: 'Configuration',
      label: 'CoFHE client setup',
      eyebrow: 'CoFHE',
      title: 'How to initialize the CoFHE client and manage permits',
      summary:
        'The CoFHE client must be initialized after wallet connection. Self permits enable decryptForView. Sharing permits enable auditor aggregate reads. Recipient permits are imported by auditors.',
      searchText:
        'cofhe client initialization permit self sharing recipient encrypt decrypt init connect browser wasm warmup',
      content: (
        <div className="space-y-8">
          <CodeBlock title="CoFHE initialization" language="ts" code={cofheInitExample} />

          <DataTable
            headers={['Permit type', 'Who creates it', 'Purpose', 'SDK call']}
            rows={[
              ['Self permit', 'Any wallet (admin, employee, auditor)', 'Enables decryptForView() for encrypted handles owned by or allowed to the caller.', 'client.permits.getOrCreateSelfPermit()'],
              ['Sharing permit', 'Admin wallet', 'Grants a specific recipient the ability to decrypt aggregate handles via a shared permit.', 'client.permits.createSharing(...)'],
              ['Recipient permit', 'Auditor wallet (imported)', 'Created when the auditor imports the admin-exported sharing payload. Enables aggregate decryptForView.', 'client.permits.importShared(payload)'],
            ]}
          />

          <Callout title="WASM warmup" tone="blue">
            The first <K>CoFHE operation</K> in a browser session may take a few seconds while <K>WASM
            modules</K> initialize. The UI shows a progress indicator during this warmup. If chunk
            loading fails, the frontend automatically retries once with a page reload.
          </Callout>
        </div>
      ),
    },
  ],
  roadmap: [
    {
      id: 'rm-progress',
      group: 'Progress',
      label: 'Completed waves',
      eyebrow: 'Progress',
      title: 'What has been shipped so far',
      summary:
        'CipherRoll has progressed from a private payroll proof-of-concept through five waves into a complete operator-facing product with settlement, governance, batch payroll, compliance, and backend support.',
      searchText:
        'roadmap progress completed waves wave 1 2 3 4 5 shipped features settlement governance batch treasury compliance',
      content: (
        <div className="space-y-8">
          <FlowDiagram
            steps={['Wave 1: Core protocol', 'Wave 2: Settlement', 'Wave 3: Hardening', 'Wave 4: Backend + SDK', 'Wave 5: Governance + Compliance']}
          />

          <RoadmapWave
            wave="Wave 1"
            status="Completed"
            title="Core privacy payroll flow"
            points={[
              'Workspace creation, encrypted budget funding, and confidential payroll issuance.',
              'CoFHE coprocessor flow adopted for Arbitrum Sepolia target.',
              'Local decryptForView-based reads in admin and employee surfaces.',
            ]}
          />
          <RoadmapWave
            wave="Wave 2"
            status="Completed"
            title="Confidential settlement foundation"
            points={[
              'Real treasury-backed payroll funding and explicit payroll-run lifecycle management.',
              'Preferred wrapper-backed payout path for confidential settlement integrated.',
              'Aggregate-first auditor review and evidence receipt flows shipped.',
            ]}
          />
          <RoadmapWave
            wave="Wave 3"
            status="Completed"
            title="Submission hardening and operator support"
            points={[
              'Wrapper-finalization verification strengthened. Settlement regression coverage expanded.',
              'True host-chain privacy boundary clarified through product wording and privacy matrix.',
              'Identifier hardening and contextual support through CipherBot v1.',
            ]}
          />
          <RoadmapWave
            wave="Wave 4"
            status="Completed"
            title="Backend foundation and reporting"
            points={[
              'Backend service with indexed read models, health/status routes, reporting summaries, notifications, and export endpoints.',
              'Shared CipherRoll SDK for runtime config, backend client, and cross-surface types.',
              'Hosted deployment: Vercel frontend, Render backend, Supabase Postgres persistence.',
              'Retrieval-backed CipherBot for in-portal operator support.',
            ]}
          />
          <RoadmapWave
            wave="Wave 5"
            status="Completed"
            title="Governance, batch payroll, treasury hardening, and compliance"
            points={[
              'M-of-N governance for sensitive issuance, vesting, treasury changes, membership, and quorum updates.',
              'CipherBot quality pass: portal-aware Gemini rotation, indexed backend context, strict read-only behavior.',
              'Browser-local batch payroll: CSV import, row validation, salary sealing, retryable row transactions, safe backend manifests.',
              'Treasury exposure reporting: route health, available/reserved inventory, payout backlog, adapter-pinned finalization safety.',
              'Tier A aggregate compliance route: reserve policy, receipt metadata, JSON/CSV exports.',
            ]}
          />
        </div>
      ),
    },
    {
      id: 'rm-future',
      group: 'Progress',
      label: 'Future scope',
      eyebrow: 'Future',
      title: 'What remains intentionally deferred',
      summary:
        'After Wave 5, CipherRoll should avoid reopening risky scope unless it directly improves the verified product.',
      searchText:
        'future scope deferred integrations compliance networks tax filing action taking ai dark pool',
      content: (
        <div className="space-y-8">
          <RoadmapWave
            wave="Post Wave 5"
            status="Deferred"
            title="Ideas deliberately not included in the verified wave"
            points={[
              'Full tax automation, real tax authority integrations, and multi-jurisdiction statutory modeling.',
              'Action-taking AI assistants that could create, fund, approve, execute, claim, finalize, disclose, or publish on a user behalf.',
              'Large external webhook or chat integrations unless they directly support the verified payroll flow.',
              'New encrypted treasury abstractions, solvency-proof demos, or dark-pool patterns that reopen protocol risk.',
              'Multi-network rollout, enterprise auth/role server model, or broad compliance-network simulations.',
            ]}
          />
        </div>
      ),
    },
  ],
  troubleshooting: [
    {
      id: 'ts-faq',
      group: 'FAQ',
      label: 'Frequently asked questions',
      eyebrow: 'FAQ',
      title: 'Common questions the docs should answer directly',
      summary:
        'This section captures the questions most likely to come from engineers, operators, and reviewers of the current product.',
      searchText:
        'faq frequently asked questions wallet disabled no payroll rows auditor salary tax page publish receipts verify receipt common',
      content: (
        <div className="space-y-4">
          <FaqItem question="Why is the wallet connected but actions are disabled?">
            Check that the wallet is on <K>{TARGET_CHAIN_NAME}</K> (chain id <K>{String(TARGET_CHAIN_ID)}</K>) and that privacy mode / the relevant permit flow has been initialized via the CoFHE button.
          </FaqItem>
          <FaqItem question="Why does the employee not see any payroll rows?">
            Confirm the employee wallet address matches the allocation metadata, the workspace id is correct, and the payroll run has been activated. Unactivated runs block all claims.
          </FaqItem>
          <FaqItem question="Can the auditor see employee salary rows?">
            No. The auditor surface is <K>aggregate-only</K> by design. Auditors can decrypt budget, committed, and available — never individual allocation amounts.
          </FaqItem>
          <FaqItem question="Why does batch payroll still show multiple wallet popups?">
            Batch v1 intentionally submits one <K>issueConfidentialPayrollToRun()</K> transaction per row. Each row requires explicit wallet approval. This is not a multi-row on-chain transaction.
          </FaqItem>
          <FaqItem question="Which actions are governed?">
            <K>Payroll issuance</K>, <K>vesting issuance</K>, <K>treasury route changes</K>, <K>admin membership changes</K>, and <K>quorum updates</K> are governed. Create/fund/reserve/activate run remain single-admin operational actions.
          </FaqItem>
          <FaqItem question="What does treasury exposure mean?">
            An indexed operational summary of route health, available/reserved inventory, payout backlog, and run exposure. It is <K>NOT</K> a plaintext salary report.
          </FaqItem>
          <FaqItem question="Is the tax page a live compliance workflow?">
            It is a <K>Tier A aggregate compliance package</K> route. It is NOT a tax filing, external authority API, or employee salary export.
          </FaqItem>
          <FaqItem question="Should publish receipts be the default?">
            No. <K>Verify</K> is the narrower default. <K>Publish</K> should be reserved for explicit downstream needs because it makes the cleartext value visible on-chain.
          </FaqItem>
          <FaqItem question="What happens if the treasury route is changed while a wrapper settlement is pending?">
            The finalize call verifies that the adapter in the pending request matches the currently configured adapter. If they differ, the finalize reverts with <K>settlement route changed</K>.
          </FaqItem>
          <FaqItem question="Can CipherBot execute actions on my behalf?">
            No. CipherBot is <K>read-only</K>. It refuses any request to fund, activate, approve, execute, claim, finalize, or disclose payroll. Wallet and governance actions must remain explicit user transactions.
          </FaqItem>
          <FaqItem question="What is the difference between verify and publish receipts?">
            <K>Verify</K> calls FHE.verifyDecryptResult() and emits an event with published=false — it proves the auditor reviewed the value. <K>Publish</K> calls FHE.publishDecryptResult() and makes the cleartext value visible on-chain with published=true.
          </FaqItem>
        </div>
      ),
    },
    {
      id: 'ts-issues',
      group: 'Debug Guide',
      label: 'Common issues',
      eyebrow: 'Debug Guide',
      title: 'Known failure modes and how to resolve them',
      summary:
        'These are the issues most commonly encountered during local testing and deployment review.',
      searchText:
        'common issues debug resolve cofhe init wallet permit claim settlement funding backend indexer failure error',
      content: (
        <div className="space-y-8">
          <DataTable
            headers={['Symptom', 'Likely cause', 'Resolution']}
            rows={[
              ['CoFHE init hangs or shows chunk load error', 'WASM module failed to load in the current browser session.', 'The frontend auto-retries once. If it persists, restart the dev server and hard-refresh the page.'],
              ['Permit creation fails with "expired"', 'The self permit has passed its expiration timestamp.', 'The SDK auto-removes expired permits and creates fresh ones. Try the action again.'],
              ['claimPayroll reverts with "payroll run not active"', 'The payroll run has not been funded and activated yet.', 'Admin must fund the run then activate it before employees can claim.'],
              ['finalizePayrollSettlement reverts with "settlement route changed"', 'The treasury adapter was reconfigured after the settlement request was created.', 'The pending request is pinned to the original adapter. Resolve the route issue or create a new request under the current adapter.'],
              ['Budget decrypt returns null', 'The CoFHE client has not been initialized or the permit does not have access.', 'Ensure initCofhe() has been called and the active permit is valid for the connected wallet and chain.'],
              ['Backend returns 404 for reporting endpoints', 'The indexer has not processed events for the requested organization.', 'Wait for the indexer to catch up, or call POST /api/admin/reindex to force a sync.'],
              ['Batch payroll submit fails for a governed workspace', 'Batch v1 is intentionally blocked for governed workspaces.', 'Use the one-row governed issuance flow with proposeGovernanceAction() instead.'],
              ['Tax compliance page shows no data', 'The backend has not indexed the workspace or the org id was entered incorrectly.', 'Verify the workspace label or org id matches an indexed organization. Check backend status via GET /api/status.'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'ts-debug',
      group: 'Debug Guide',
      label: 'Debug toolkit',
      eyebrow: 'Debug Toolkit',
      title: 'Tools and techniques for diagnosing issues',
      summary:
        'Practical debugging approaches for frontend, backend, and contract-level issues.',
      searchText:
        'debug toolkit devtools network cipherbot headers backend health indexer contract verification',
      content: (
        <div className="space-y-8">
          <ChecklistCard
            title="Frontend debugging"
            items={[
              'Open DevTools Network tab and filter by /api/ to see backend requests and responses.',
              'Check CipherBot response headers: X-CipherBot-Mode, X-CipherBot-Model, X-CipherBot-Reason — these distinguish real model responses from missing-key states.',
              'Use the Console to inspect CoFHE client state and permit expiration.',
              'Verify NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL is not pointing to localhost in production deployments.',
            ]}
          />
          <ChecklistCard
            title="Backend debugging"
            items={[
              'curl http://127.0.0.1:4000/api/health — confirm the backend is running and reports ok: true.',
              'curl http://127.0.0.1:4000/api/status — check indexer progress (latestIndexedBlock vs latestKnownBlock).',
              'POST /api/admin/reindex with Bearer token to force a re-index from a specific block.',
              'Check Supabase Postgres for row counts in organizations, payroll_runs, payments tables.',
            ]}
          />
          <ChecklistCard
            title="Contract-level debugging"
            items={[
              'Use Arbiscan (sepolia.arbiscan.io) to read contract state directly and verify org/run/payment existence.',
              'Check the PayrollRun status field: 0=Draft, 1=Funded, 2=Active, 3=Finalized.',
              'Verify FHE.allow() was called for the relevant handles — without it, decryptForView will fail.',
              'Inspect events (ConfidentialPayrollIssued, PayrollRunFunded, etc.) to confirm on-chain activity.',
            ]}
          />
        </div>
      ),
    },
  ],
};

function K({ children }: { children: ReactNode }) {
  return <strong className="font-bold text-white">{children}</strong>;
}

function A({ id, children }: { id: string; children: ReactNode }) {
  return <div id={id} className="scroll-mt-28">{children}</div>;
}

function FaqItem({ question, children }: { question: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.03]"
      >
        <span className="text-sm font-semibold text-white">{question}</span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-white/[0.06] px-5 py-4 text-sm leading-7 text-gray-300">
          {children}
        </div>
      )}
    </div>
  );
}

function SectionLabel({
  children,
  tone = 'cyan',
}: {
  children: ReactNode;
  tone?: 'cyan' | 'orange' | 'blue' | 'green';
}) {
  const colors: Record<string, string> = {
    cyan: 'text-cyan-400',
    orange: 'text-orange-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
  };
  return (
    <p className={`text-[11px] font-black uppercase tracking-[0.22em] ${colors[tone] || colors.cyan}`}>
      {children}
    </p>
  );
}

function CodeBlock({
  title,
  code,
  language = 'text',
}: {
  title: string;
  code: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (typeof window === 'undefined' || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/40">
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.02] px-4 py-3">
        <span className="text-[11px] font-black uppercase tracking-[0.22em] text-white">
          {title}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">
            {language}
          </span>
          <button
            onClick={handleCopy}
            className="rounded-md px-2 py-1 text-[10px] font-medium text-gray-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-gray-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MetricCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-black/40">
        <Icon className="h-4 w-4 text-white" />
      </div>
      <h3 className="mb-2 text-base font-bold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-gray-400">{description}</p>
    </div>
  );
}

function Callout({
  title,
  children,
  tone = 'blue',
}: {
  title: string;
  children: ReactNode;
  tone?: 'orange' | 'blue';
}) {
  const borderColor = tone === 'orange' ? 'border-orange-500/20' : 'border-blue-500/20';
  const labelColor = tone === 'orange' ? 'text-orange-400' : 'text-blue-400';

  return (
    <div className={`rounded-2xl border ${borderColor} bg-white/[0.02] px-5 py-4`}>
      <p className={`mb-2 text-[11px] font-black uppercase tracking-[0.22em] ${labelColor}`}>
        {title}
      </p>
      <div className="text-sm leading-relaxed text-gray-300">{children}</div>
    </div>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.04] text-[11px] uppercase tracking-widest text-gray-500">
              {headers.map((header) => (
                <th key={header} className="px-6 py-4 font-black">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((row, rowIndex) => (
              <tr key={`${row[0]}-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${cellIndex}-${cell.slice(0, 24)}`}
                    className={`px-6 py-4 align-top leading-relaxed ${
                      cellIndex === 0 ? 'font-bold text-gray-300' : 'text-gray-400'
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChecklistCard({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <h3 className="mb-4 text-base font-bold text-white">{title}</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-white" />
            <p className="text-sm leading-7 text-gray-400">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepCard({ number, text }: { number: number; text: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-black/40 text-sm font-black text-white">
        {String(number).padStart(2, '0')}
      </div>
      <p className="text-sm leading-7 text-gray-400">{text}</p>
    </div>
  );
}

function SequenceFlow({
  title,
  steps,
}: {
  title: string;
  steps: Array<{ label: string; detail: string }>;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <h3 className="mb-5 text-base font-bold text-white">{title}</h3>
      <div className="space-y-0">
        {steps.map((step, index) => (
          <div key={step.label} className="relative">
            {index > 0 && (
              <div className="absolute left-[11px] top-0 h-4 w-px bg-white/[0.12]" />
            )}
            <div className="flex items-start gap-4 pb-5">
              <div className="flex flex-col items-center">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-white/[0.15] bg-black/60 text-[10px] font-black text-white">
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div className="mt-1 h-full w-px flex-1 bg-white/[0.08]" />
                )}
              </div>
              <div className="min-w-0 pb-1">
                <p className="text-sm font-semibold text-white">{step.label}</p>
                <p className="mt-1 text-sm leading-6 text-gray-400">{step.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowDiagram({ steps }: { steps: string[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex items-center gap-2 min-w-max py-1">
        {steps.map((step, index) => (
          <Fragment key={index}>
            <div className="flex-shrink-0 rounded-lg border border-cyan-500/25 bg-cyan-500/[0.08] px-4 py-2.5 text-sm font-semibold text-cyan-300 whitespace-nowrap">
              {step}
            </div>
            {index < steps.length - 1 && (
              <div className="flex flex-shrink-0 items-center text-cyan-500/40">
                <ArrowRight className="h-5 w-5" />
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function StateDiagram({
  title,
  states,
  transitions,
}: {
  title: string;
  states: Array<{ name: string; color: string }>;
  transitions: Array<{ from: number; to: number; label: string }>;
}) {
  const colorMap: Record<string, string> = {
    gray: 'border-gray-500/30 bg-gray-500/[0.08] text-gray-300',
    blue: 'border-blue-500/30 bg-blue-500/[0.08] text-blue-300',
    green: 'border-green-500/30 bg-green-500/[0.08] text-green-300',
    cyan: 'border-cyan-500/30 bg-cyan-500/[0.08] text-cyan-300',
    orange: 'border-orange-500/30 bg-orange-500/[0.08] text-orange-300',
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <h3 className="mb-5 text-base font-bold text-white">{title}</h3>
      <div className="flex flex-wrap items-center gap-3">
        {states.map((state, index) => (
          <Fragment key={state.name}>
            <div
              className={`rounded-lg border px-4 py-2.5 text-sm font-bold ${colorMap[state.color] || colorMap.gray}`}
            >
              {state.name}
            </div>
            {index < states.length - 1 && (
              <div className="flex flex-col items-center gap-0.5">
                <ArrowRight className="h-4 w-4 text-white/30" />
                <span className="text-[10px] text-white/40 max-w-[80px] text-center leading-tight">
                  {transitions[index]?.label || ''}
                </span>
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function ArchDiagram({
  title,
  boxes,
  connections,
}: {
  title: string;
  boxes: Array<{ id: string; label: string; desc: string }>;
  connections: Array<{ from: string; to: string; label: string }>;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <h3 className="mb-5 text-base font-bold text-white">{title}</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {boxes.map((box) => {
          const connected = connections.filter((c) => c.from === box.id || c.to === box.id);
          return (
            <div
              key={box.id}
              className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.05] p-4 space-y-2"
            >
              <p className="text-sm font-bold text-cyan-300">{box.label}</p>
              <p className="text-[12px] leading-5 text-gray-400">{box.desc}</p>
              {connected.length > 0 && (
                <div className="border-t border-white/[0.06] pt-2 space-y-1">
                  {connected.map((conn, ci) => (
                    <p key={ci} className="text-[11px] text-gray-500">
                      {conn.from === box.id ? (
                        <span>
                          <ArrowRight className="inline h-3 w-3 mr-1 text-cyan-500/40" />
                          {conn.label} <span className="text-gray-600">to {boxes.find((b) => b.id === conn.to)?.label}</span>
                        </span>
                      ) : (
                        <span>
                          <ArrowRight className="inline h-3 w-3 mr-1 rotate-180 text-blue-500/40" />
                          {conn.label} <span className="text-gray-600">from {boxes.find((b) => b.id === conn.from)?.label}</span>
                        </span>
                      )}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProcessDiagram({
  title,
  columns,
}: {
  title: string;
  columns: Array<{ title: string; items: string[] }>;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <h3 className="mb-5 text-base font-bold text-white">{title}</h3>
      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((column) => (
          <div key={column.title} className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">
            <p className="mb-4 text-[11px] font-black uppercase tracking-[0.22em] text-white">
              {column.title}
            </p>
            <div className="space-y-3">
              {column.items.map((item, index) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-white" />
                  <p className="text-sm leading-6 text-gray-400">
                    <span className="mr-2 font-semibold text-gray-200">{index + 1}.</span>
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoadmapWave({
  wave,
  status,
  title,
  points,
}: {
  wave: string;
  status: string;
  title: string;
  points: string[];
}) {
  const isCompleted = status === 'Completed';
  const isDeferred = status === 'Deferred';

  const borderColor = isCompleted
    ? 'border-green-500/20'
    : isDeferred
      ? 'border-gray-600/20'
      : 'border-white/[0.08]';
  const statusBg = isCompleted
    ? 'bg-green-500/15 text-green-300'
    : isDeferred
      ? 'bg-gray-500/10 text-gray-400'
      : 'bg-white/5 text-gray-300';
  const iconColor = isCompleted
    ? 'text-green-400'
    : isDeferred
      ? 'text-gray-600'
      : 'text-white';

  return (
    <div className={`rounded-2xl border ${borderColor} bg-white/[0.02] p-5`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-white/[0.08] bg-black/30 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-white">
          {wave}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${statusBg}`}
        >
          {status}
        </span>
      </div>

      <h3 className="mt-4 text-xl font-bold text-white">{title}</h3>
      <div className="mt-4 space-y-3">
        {points.map((point) => (
          <div key={point} className="flex items-start gap-3">
            <CheckCircle2 className={`mt-0.5 h-4 w-4 flex-shrink-0 ${iconColor}`} />
            <p className="text-sm leading-7 text-gray-400">{point}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionPager({
  previous,
  next,
  onSelect,
}: {
  previous?: DocsSection;
  next?: DocsSection;
  onSelect: (sectionId: string) => void;
}) {
  if (!previous && !next) return null;

  return (
    <div className="mt-10 grid gap-4 border-t border-white/[0.08] pt-6 md:grid-cols-2">
      <div>
        {previous ? (
          <button
            onClick={() => onSelect(previous.id)}
            className="flex w-full items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-left transition hover:border-white/[0.14] hover:bg-white/[0.04]"
          >
            <ArrowLeft className="mt-0.5 h-4 w-4 flex-shrink-0 text-white" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">
                Previous
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{previous.label}</p>
            </div>
          </button>
        ) : null}
      </div>

      <div>
        {next ? (
          <button
            onClick={() => onSelect(next.id)}
            className="flex w-full items-start justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-left transition hover:border-white/[0.14] hover:bg-white/[0.04]"
          >
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">
                Next
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{next.label}</p>
            </div>
            <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-white" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SearchModal({
  open,
  onOpenChange,
  query,
  setQuery,
  results,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  setQuery: (value: string) => void;
  results: SearchResult[];
  onSelect: (tabId: DocsTabId, sectionId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12vh] translate-y-0 border-white/[0.08] bg-[#090909]/98 p-0 text-white shadow-2xl sm:max-w-[980px]">
        <div className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#090909]/98 px-6 py-5">
          <DialogTitle className="sr-only">Search documentation</DialogTitle>
          <DialogDescription className="sr-only">
            Search CipherRoll docs sections and open the matching result.
          </DialogDescription>

          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 text-white" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search documentation..."
              className="w-full bg-transparent text-2xl text-white outline-none placeholder:text-gray-500"
            />
          </div>
        </div>

        <div className="max-h-[65vh] overflow-y-auto px-4 py-4">
          {!query.trim() ? (
            <div className="px-3 py-10 text-sm text-gray-500">
              Search by section title, workflow, contract function, API endpoint, privacy topic, or feature.
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-10 text-sm text-gray-500">No docs matched &quot;{query}&quot;.</div>
          ) : (
            <div className="space-y-2">
              {results.map((result) => (
                <button
                  key={`${result.tabId}-${result.section.id}`}
                  onClick={() => onSelect(result.tabId, result.section.id)}
                  className="block w-full rounded-2xl border border-transparent bg-white/[0.02] px-4 py-4 text-left transition hover:border-white/[0.08] hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white">
                        {result.tabLabel}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">{result.section.label}</p>
                      <p className="mt-2 line-clamp-2 max-w-[760px] text-sm leading-6 text-gray-400">
                        {result.section.summary}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-gray-500" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function scoreSection(query: string, section: DocsSection, tabLabel: string) {
  const haystack = `${tabLabel} ${section.group} ${section.label} ${section.title} ${section.summary} ${section.searchText}`.toLowerCase();
  const terms = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) return 0;

  let score = 0;

  for (const term of terms) {
    if (section.label.toLowerCase().includes(term)) score += 6;
    if (section.title.toLowerCase().includes(term)) score += 5;
    if (section.group.toLowerCase().includes(term)) score += 3;
    if (section.summary.toLowerCase().includes(term)) score += 2;
    if (haystack.includes(term)) score += 1;
  }

  return score;
}

const getTabForSection = (sectionId: string | null): DocsTabId | null => {
  if (!sectionId) return null;

  const matchingTab = docsTabs.find((tab) =>
    sectionContentByTab[tab.id].some((section) => section.id === sectionId),
  );

  return matchingTab?.id ?? null;
};

const resolveTabAndSection = (searchParams: URLSearchParams) => {
  const requestedTab = searchParams.get('tab');
  const requestedSection = searchParams.get('section');
  const fallbackTab = getTabForSection(requestedSection) ?? 'getting-started';
  const activeTab = docsTabs.some((tab) => tab.id === requestedTab)
    ? (requestedTab as DocsTabId)
    : fallbackTab;
  const sections = sectionContentByTab[activeTab];
  const activeSection = sections.some((section) => section.id === requestedSection)
    ? (requestedSection as string)
    : sections[0].id;

  return { activeTab, activeSection };
};

export default function DocsPage() {
  const initialState =
    typeof window === 'undefined'
      ? { activeTab: 'getting-started' as DocsTabId, activeSection: 'gs-overview' }
      : resolveTabAndSection(new URLSearchParams(window.location.search));

  const [activeTab, setActiveTab] = useState<DocsTabId>(initialState.activeTab);
  const [activeSection, setActiveSection] = useState(initialState.activeSection);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const contentTopRef = useRef<HTMLDivElement | null>(null);

  const activeSections = sectionContentByTab[activeTab];
  const selectedSection =
    activeSections.find((section) => section.id === activeSection) ?? activeSections[0];
  const currentIndex = activeSections.findIndex((section) => section.id === selectedSection.id);
  const previousSection = currentIndex > 0 ? activeSections[currentIndex - 1] : undefined;
  const nextSection =
    currentIndex >= 0 && currentIndex < activeSections.length - 1
      ? activeSections[currentIndex + 1]
      : undefined;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyLocationState = () => {
      const resolvedState = resolveTabAndSection(new URLSearchParams(window.location.search));
      setActiveTab(resolvedState.activeTab);
      setActiveSection(resolvedState.activeSection);
    };

    applyLocationState();
    window.addEventListener('popstate', applyLocationState);
    return () => window.removeEventListener('popstate', applyLocationState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === activeTab && params.get('section') === activeSection) {
      return;
    }

    params.set('tab', activeTab);
    params.set('section', activeSection);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', nextUrl);
  }, [activeTab, activeSection]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const groupedSections = useMemo(() => {
    return activeSections.reduce<Record<string, DocsSection[]>>((acc, section) => {
      acc[section.group] = acc[section.group] ?? [];
      acc[section.group].push(section);
      return acc;
    }, {});
  }, [activeSections]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [] as SearchResult[];

    return docsTabs
      .flatMap((tab) =>
        sectionContentByTab[tab.id].map((section) => ({
          tabId: tab.id,
          tabLabel: tab.label,
          section,
          score: scoreSection(searchQuery, section, tab.label),
        })),
      )
      .filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 12);
  }, [searchQuery]);

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
    requestAnimationFrame(() => {
      contentTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleTabChange = (tabId: DocsTabId) => {
    setActiveTab(tabId);
    setActiveSection(sectionContentByTab[tabId][0].id);
    requestAnimationFrame(() => {
      contentTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleSearchSelect = (tabId: DocsTabId, sectionId: string) => {
    setSearchOpen(false);
    setActiveTab(tabId);
    setActiveSection(sectionId);
    requestAnimationFrame(() => {
      contentTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <>
      <motion.div
        className="page-container relative min-h-screen bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div
          className="fixed inset-0 z-0 bg-[length:800px] bg-left bg-no-repeat bg-fixed opacity-35 md:bg-[length:1800px]"
          style={{ backgroundImage: "url('/assets/milad-fakurian-7Wx1dAuKqg-unsplash.jpg')" }}
        />
        <div className="fixed inset-0 z-0 bg-black/70 backdrop-blur-[2px]" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-20 pt-20 md:pt-24">
          <div className="border-b border-white/10 pb-7 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-white/80">
              <BookOpen className="h-3.5 w-3.5" />
              Documentation
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-5xl">
              CipherRoll Documentation
            </h1>

            <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-gray-400 md:text-base">
              Setup, workflows, privacy boundaries, architecture, contract reference, API reference,
              roadmap, and troubleshooting for the current CipherRoll product.
            </p>
          </div>

          <div className="mt-8 flex justify-center">
            <div className="flex w-full max-w-6xl flex-wrap items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-[#0b0b0c]/90 px-3 py-3 backdrop-blur-xl">
              {docsTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === activeTab;

                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-white text-black'
                        : 'text-gray-400 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}

              <button
                onClick={() => setSearchOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-5 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/[0.05] hover:text-white"
                aria-label="Search documentation"
              >
                <Search className="h-4 w-4" />
                <span>Search</span>
                <span className="rounded-md border border-white/[0.08] bg-black/40 px-1.5 py-0.5 text-[10px] text-gray-500">
                  ⌘K
                </span>
              </button>
            </div>
          </div>

          <div ref={contentTopRef} className="mt-10 grid items-start gap-10 lg:grid-cols-[260px_minmax(0,1fr)_180px]">
            <aside className="w-full lg:sticky lg:top-28 lg:w-[260px] lg:self-start">
              <GlassCard className="max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-white/[0.08] bg-black/30 p-5">
                {Object.entries(groupedSections).map(([groupName, groupSections]) => (
                  <div key={groupName} className="mb-6 last:mb-0">
                    <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">
                      {groupName}
                    </p>
                    <div className="space-y-1">
                      {groupSections.map((section) => {
                        const isActive = section.id === selectedSection.id;

                        return (
                          <button
                            key={section.id}
                            onClick={() => handleSectionChange(section.id)}
                            className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition-all ${
                              isActive
                                ? 'bg-white/[0.06] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                                : 'text-gray-500 hover:bg-white/[0.03] hover:text-gray-200'
                            }`}
                          >
                            {section.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </GlassCard>
            </aside>

            <main className="min-w-0 max-w-4xl">
              <SectionContent
                section={selectedSection}
                activeTab={activeTab}
                onSelectSection={handleSectionChange}
                previousSection={previousSection}
                nextSection={nextSection}
              />
            </main>

            <aside className="hidden lg:sticky lg:top-28 lg:self-start lg:block">
              {activeSections.length > 1 && (
                <GlassCard className="rounded-2xl border border-white/[0.08] bg-black/30 p-4">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">
                    On this page
                  </p>
                  <div className="space-y-1">
                    {activeSections.map((s) => {
                      const isActive = s.id === selectedSection.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => handleSectionChange(s.id)}
                          className={`block w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                            isActive
                              ? 'bg-white/[0.06] font-semibold text-white'
                              : 'text-gray-500 hover:bg-white/[0.03] hover:text-gray-300'
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </GlassCard>
              )}
            </aside>
          </div>
        </div>

        <CipherBotWidget
          scope="docs"
          headline="Your contextual guide for CipherRoll docs and product behavior."
          intro="Ask about local setup, payroll workflows, privacy boundaries, contract functions, API endpoints, governance, or auditor review. I will stay read-only and aligned with the current CipherRoll implementation."
        />
      </motion.div>

      <SearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        query={searchQuery}
        setQuery={setSearchQuery}
        results={searchResults}
        onSelect={handleSearchSelect}
      />
    </>
  );
}

function SectionContent({
  section,
  activeTab,
  onSelectSection,
  previousSection,
  nextSection,
}: {
  section: DocsSection;
  activeTab: DocsTabId;
  onSelectSection: (sectionId: string) => void;
  previousSection?: DocsSection;
  nextSection?: DocsSection;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (typeof window === 'undefined' || !navigator?.clipboard) return;

    try {
      const url = `${window.location.origin}${window.location.pathname}?tab=${activeTab}&section=${section.id}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore clipboard failures
    }
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={section.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="space-y-6"
      >
        <div className="flex items-start justify-between gap-6 border-b border-white/[0.08] pb-6">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.24em] text-white/80">
              {section.eyebrow}
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              {section.title}
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-gray-400 md:text-base">
              {section.summary}
            </p>
          </div>

          <div className="flex flex-shrink-0 flex-col items-end gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-md bg-white/[0.06] px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10"
              aria-label="Copy link to section"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>

        {section.content}

        <SectionPager previous={previousSection} next={nextSection} onSelect={onSelectSection} />
      </motion.div>
    </AnimatePresence>
  );
}
