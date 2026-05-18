'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
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
  Wallet,
} from 'lucide-react';
import CipherBotWidget from '@/components/CipherBotWidget';
import GlassCard from '@/components/GlassCard';
import {
  AUDITOR_DISCLOSURE_CONTRACT_ADDRESS,
  BACKEND_BASE_URL,
  CONTRACT_ADDRESS,
  DEFAULT_ORG_ID,
  TARGET_CHAIN_ID,
  TARGET_CHAIN_NAME,
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
  | 'roadmap'
  | 'reference';

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
  { id: 'roadmap', label: 'Roadmap & Progress', icon: Sparkles },
  { id: 'reference', label: 'Reference', icon: FileCode2 },
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
NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL=${BACKEND_BASE_URL || '<backend-url>'}
CIPHERROLL_DATABASE_URL=<supabase-session-pooler-url>
CIPHERROLL_BACKEND_ADMIN_TOKEN=<admin-token>`;

const backendExample = `fetch(\`\${process.env.NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL}/api/reports/organizations/\${orgId}/summary\`)
  .then((response) => response.json())
  .then((summary) => {
    console.log(summary.runCounts);
    console.log(summary.pendingFinalizations);
  });`;

const sectionContentByTab: Record<DocsTabId, DocsSection[]> = {
  'getting-started': [
    {
      id: 'gs-overview',
      group: 'Introduction',
      label: 'Overview',
      eyebrow: 'Overview',
      title: 'CipherRoll documentation',
      summary:
        'CipherRoll is a confidential payroll application built on Fhenix CoFHE for Arbitrum Sepolia. These docs focus on the shipped frontend and hosted stack: setup, payroll operations, employee claims, auditor review, backend-assisted reporting, and deployment.',
      searchText:
        'overview cipherroll docs confidential payroll frontend docs arbirtrum sepolia fhenix cofhe admin employee auditor backend reporting',
      content: (
        <div className="space-y-8">
          <p className="text-sm leading-7 text-gray-300">
            CipherRoll keeps salary-sensitive values encrypted on-chain while still supporting a
            practical payroll workflow. Admins can create a workspace, fund encrypted budget,
            create payroll runs, reserve settlement inventory, activate claims, and export
            aggregate-only auditor access. Employees can review allocations locally and complete
            claims from their own wallet. Auditors can review aggregate values and generate
            evidence receipts when needed. The current stack also includes a backend service for
            indexed summaries, notifications, exports, and support APIs, with hosted persistence
            designed for real deployment rather than localhost-only review.
          </p>

          <div className="grid gap-5 md:grid-cols-3">
            <MetricCard
              icon={Lock}
              title="Confidential values"
              description="Budget, committed payroll, available runway, and employee allocation amounts stay encrypted at rest."
            />
            <MetricCard
              icon={Wallet}
              title="Role-based portals"
              description="The web app currently ships admin, employee, auditor, tax status, and docs routes."
            />
            <MetricCard
              icon={FileKey2}
              title="Selective disclosure"
              description="Auditor review is aggregate-only by design and separate from admin visibility."
            />
          </div>
        </div>
      ),
    },
    {
      id: 'gs-prerequisites',
      group: 'Introduction',
      label: 'Prerequisites',
      eyebrow: 'Before You Start',
      title: 'What you need before testing the frontend',
      summary:
        'Use the right network, role wallets, and local services so the frontend behaves like the shipped product.',
      searchText:
        'prerequisites requirements wallets network backend local services target chain employee admin auditor role wallets',
      content: (
        <div className="space-y-8">
          <DataTable
            headers={['Requirement', 'Why it matters', 'Notes']}
            rows={[
              [
                'Arbitrum Sepolia access',
                'CipherRoll is currently designed and documented only for this target network.',
                `Use chain id ${TARGET_CHAIN_ID} and test with separate admin, employee, and auditor wallets.`,
              ],
              [
                'Backend service',
                'The admin and auditor surfaces rely on indexed read models, exports, notifications, and support endpoints.',
                'Run the backend for a complete local review loop.',
              ],
              [
                'Database connection',
                'The hosted backend now persists indexed state in Postgres rather than relying only on a local file.',
                'For deployment, use the Supabase session-pooler connection string.',
              ],
              [
                'Browser-based CoFHE flow',
                'Employee and auditor experiences depend on permit-backed local decrypt operations.',
                'Expect wallet prompts, local permit storage, and role-specific sessions.',
              ],
              [
                'Accurate scope expectations',
                'The tax page is not a live regulator workflow and backend indexing does not replace local privacy.',
                'Keep this boundary explicit in demos and reviews.',
              ],
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
        'Start the backend first, then the web app, so reporting, exports, notifications, and support flows are available during frontend review.',
      searchText:
        'local setup install backend web app run commands environment variables frontend backend development',
      content: (
        <div className="space-y-8">
          <div className="grid gap-5 lg:grid-cols-2">
            <CodeBlock title="Repo root" language="bash" code={rootCommands} />
            <CodeBlock title="Web app" language="bash" code={webCommands} />
          </div>

          <CodeBlock title="Environment example" language="env" code={envExample} />
        </div>
      ),
    },
    {
      id: 'gs-first-review',
      group: 'Local Setup',
      label: 'First review loop',
      eyebrow: 'Walkthrough',
      title: 'A practical first-pass review',
      summary:
        'Review the docs page first, then move through admin, employee, and auditor in the same order the product uses them.',
      searchText:
        'first review loop docs admin employee auditor walkthrough first pass testing order review flow',
      content: (
        <div className="grid gap-4 md:grid-cols-2">
          {[
            'Open /docs and confirm the deployment constants match your environment.',
            'Open /admin and verify wallet connection, CoFHE initialization, and workspace loading.',
            'Open /employee and test privacy-mode setup plus payroll loading for the correct wallet.',
            'Open /auditor and validate permit import, aggregate review, and receipt mode.',
          ].map((step, index) => (
            <StepCard key={step} number={index + 1} text={step} />
          ))}
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
      title: 'Run a payroll cycle from workspace setup to claim activation',
      summary:
        'The admin portal is the operational center for workspace setup, encrypted budget funding, payroll-run management, treasury routing, and auditor sharing.',
      searchText:
        'admin workflow workspace setup budget funding payroll run treasury route activation auditor sharing operator portal',
      content: (
        <div className="space-y-8">
          <StepStack
            title="Admin flow"
            steps={[
              'Initialize CoFHE before attempting encrypted budget or payroll actions.',
              'Create the workspace that will hold payroll state and reporting context.',
              'Fund encrypted budget instead of treating payroll as a public balance.',
              'Create a payroll run and issue confidential allocations.',
              'Reserve treasury funds through the configured settlement route.',
              'Activate claimability only after funding succeeds.',
              'Export an auditor sharing payload when aggregate review is required.',
            ]}
          />

          <Callout title="Operational note" tone="orange">
            Use high-entropy workspace ids, route ids, run ids, and memo defaults whenever the UI
            allows it. Many identifiers remain public or inferable even when values stay encrypted.
          </Callout>
        </div>
      ),
    },
    {
      id: 'wf-employee',
      group: 'Employee Portal',
      label: 'Employee workflow',
      eyebrow: 'Employee Portal',
      title: 'Review, claim, and finalize payroll as an employee',
      summary:
        'The employee portal is intentionally narrow. It focuses on privacy-mode setup, local decrypts, claim readiness, and payout completion.',
      searchText:
        'employee workflow review claim finalize payroll privacy mode local decrypt vesting wrapper finalization',
      content: (
        <div className="space-y-8">
          <div className="grid gap-5 lg:grid-cols-2">
            <GlossaryCard
              title="Employee flow"
              items={[
                ['Connect wallet', 'Use the wallet that matches the payroll allocation metadata.'],
                ['Enable privacy mode', 'Initialize CoFHE and create or reuse the employee self permit.'],
                ['Refresh payroll', 'Load allocation metadata and decrypt the amount locally.'],
                ['Claim or finalize', 'Claim direct payouts or complete wrapper finalization when a settlement request exists.'],
              ]}
            />
            <GlossaryCard
              title="Common states"
              items={[
                ['Draft or awaiting activation', 'The run exists but is not claimable yet.'],
                ['Available', 'The allocation is ready for immediate claim.'],
                ['Vesting', 'The allocation exists but is still time-locked.'],
                ['Finalize payout', 'The wrapper-backed request exists and the employee must complete the final step.'],
              ]}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'wf-auditor',
      group: 'Auditor Portal',
      label: 'Auditor workflow',
      eyebrow: 'Auditor Portal',
      title: 'Import permits and review aggregate-only disclosures',
      summary:
        'The auditor portal is built around selective disclosure. It is not a shortcut into admin-level payroll visibility.',
      searchText:
        'auditor workflow permits import aggregate review selective disclosure verify publish receipts evidence',
      content: (
        <div className="space-y-8">
          <StepStack
            title="Auditor flow"
            steps={[
              'Connect the auditor wallet and switch to the target network.',
              'Import the admin-exported recipient payload.',
              'Select the active recipient permit for the current wallet and chain.',
              'Decrypt aggregate budget, committed payroll, and available runway locally.',
              'Use verify or publish receipt mode only when evidence needs to leave the browser.',
            ]}
          />

          <div className="grid gap-5 md:grid-cols-2">
            <Callout title="Verify receipt" tone="blue">
              Use verify as the narrower default when you need an on-chain proof of review without
              making publication the default path.
            </Callout>
            <Callout title="Publish receipt" tone="orange">
              Use publish only when a downstream workflow explicitly needs that result materialized
              on-chain.
            </Callout>
          </div>
        </div>
      ),
    },
    {
      id: 'wf-settlement',
      group: 'Settlement',
      label: 'Settlement modes',
      eyebrow: 'Settlement',
      title: 'Direct and wrapper-backed settlement are different user experiences',
      summary:
        'CipherRoll currently supports two payout shapes. The frontend should explain not only the technical difference, but also how the employee experience changes.',
      searchText:
        'settlement modes direct treasury wrapper backed settlement employee experience payout routes',
      content: (
        <div className="space-y-8">
          <DataTable
            headers={['Mode', 'When it fits', 'Frontend implication']}
            rows={[
              [
                'Direct treasury route',
                'Use it when you want a simpler payout path and do not need deeper confidentiality during the payout step.',
                'Employees claim without the extra wrapper finalization step.',
              ],
              [
                'Wrapper-backed route',
                'Use it when you want payroll to stay confidential deeper into settlement before final proof publication.',
                'Employees may need a request + finalize flow, and the docs should explain that tradeoff clearly.',
              ],
            ]}
          />

          <ProcessDiagram
            title="Payroll lifecycle"
            columns={[
              {
                title: 'Admin',
                items: ['Initialize CoFHE', 'Create workspace', 'Fund encrypted budget', 'Create payroll run'],
              },
              {
                title: 'Treasury',
                items: ['Reserve settlement inventory', 'Fund payroll run', 'Prepare payout route'],
              },
              {
                title: 'Employee',
                items: ['Claim allocation', 'Finalize wrapper payout when needed', 'Receive settlement token'],
              },
            ]}
          />
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
        'CipherRoll is private-by-design, not invisibility-by-claim. The frontend should stay precise about what the host chain and settlement flows still expose.',
      searchText:
        'privacy boundary encrypted values public values wrapper finalization decryptfortx host chain disclosure',
      content: (
        <div className="space-y-8">
          <div className="grid gap-5 md:grid-cols-3">
            <Callout title="Encrypted on-chain" tone="blue">
              Budget, committed payroll, available runway, employee allocation amounts, and
              aggregate auditor handles are stored as encrypted values or confidential balances.
            </Callout>
            <Callout title="Public workflow metadata" tone="blue">
              Wallet addresses, run states, timestamps, ids, logs, calldata, and funding windows
              remain visible as part of the EVM execution model or because CipherRoll stores them
              explicitly.
            </Callout>
            <Callout title="Becomes public later" tone="orange">
              Wrapper settlement values can move from confidential to public when a
              <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5 text-[12px]">
                decryptForTx
              </code>
              proof path is posted on-chain during finalization.
            </Callout>
          </div>

          <DataTable
            headers={['Category', 'Examples']}
            rows={[
              [
                'Encrypted values',
                'Organization budget handle, committed payroll handle, available runway handle, employee allocation amounts, wrapper balances before request decryption.',
              ],
              [
                'Public by EVM design',
                'Transaction sender, recipient, calldata, logs, timestamps, gas use, and ERC20 transfer results.',
              ],
              [
                'Public because CipherRoll stores it',
                'Workspace ids, payroll-run ids, payment ids, memo hashes, funding deadlines, run counts, and settlement request metadata.',
              ],
              [
                'Inferable labels',
                'Readable or mnemonic ids can still be guessed if operators use predictable input strings.',
              ],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'pv-audit',
      group: 'Audit Model',
      label: 'Selective disclosure',
      eyebrow: 'Audit Model',
      title: 'Auditor review is a separate privacy mode',
      summary:
        'The current implementation makes a clear distinction between local view-only review and evidence-oriented receipt generation.',
      searchText:
        'selective disclosure audit model decryptforview decryptfortx view only verify publish receipts aggregate only',
      content: (
        <div className="space-y-8">
          <ProcessDiagram
            title="Selective disclosure flow"
            columns={[
              {
                title: 'Admin',
                items: ['Create auditor sharing permit', 'Export non-sensitive payload'],
              },
              {
                title: 'Auditor',
                items: ['Import payload', 'Decrypt aggregate values locally', 'Review budget, committed, available'],
              },
              {
                title: 'Evidence mode',
                items: ['Use verify for narrow proofs', 'Use publish only when downstream systems need the result'],
              },
            ]}
          />
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
        'best practices operators reviewers ids wallets terminology stakeholder review docs process',
      content: (
        <div className="grid gap-5 lg:grid-cols-2">
          <ChecklistCard
            title="Operator practices"
            items={[
              'Use separate wallets for admin, employee, and auditor scenarios during testing.',
              'Prefer high-entropy identifiers over readable labels when the UI allows it.',
              'Document which treasury route a demo or test is using because claim behavior differs.',
              'Refresh read models after writes instead of assuming projections update instantly.',
            ]}
          />
          <ChecklistCard
            title="Content practices"
            items={[
              'Keep terminology consistent: workspace, payroll run, recipient permit, verify receipt, publish receipt.',
              'Review privacy wording whenever settlement or audit-receipt behavior changes.',
              'Write for the user who needs to complete a task, not for the page that needs to look full.',
              'Only add sections that match the actual CipherRoll surface.',
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
        'CipherRoll is no longer a contracts-only demo. The current release includes frontend portals, settlement routes, backend read models, and support tooling.',
      searchText:
        'architecture overview frontend contracts backend treasury adapters cofhe network system design',
      content: (
        <div className="space-y-8">
          <ProcessDiagram
            title="System overview"
            columns={[
              {
                title: 'Frontend portals',
                items: ['Admin portal', 'Employee portal', 'Auditor portal', 'Docs and tax status pages'],
              },
              {
                title: 'Core contracts',
                items: ['CipherRollPayroll', 'CipherRollAuditorDisclosure', 'Treasury adapters'],
              },
              {
                title: 'Support layer',
                items: ['@cofhe/sdk', 'Backend read models', 'Reports, exports, notifications, CipherBot'],
              },
            ]}
          />
        </div>
      ),
    },
    {
      id: 'arch-frontend',
      group: 'System Design',
      label: 'Frontend responsibilities',
      eyebrow: 'Frontend',
      title: 'What the web app is responsible for',
      summary:
        'The frontend handles role-based workflows, wallet interactions, permit-backed local decrypts, and product explanation. It does not replace the privacy model with a central service.',
      searchText:
        'frontend responsibilities web app wallets permits decrypt reporting docs product explanation',
      content: (
        <div className="space-y-8">
          <ChecklistCard
            title="Frontend responsibilities"
            items={[
              'Connect injected EVM wallets for admins, employees, and auditors.',
              'Initialize CoFHE and manage local permit-backed decrypt workflows.',
              'Drive workspace, payroll, claim, and evidence flows through the current contracts.',
              'Consume backend read models for reports, notifications, and exports where appropriate.',
              'Explain the product and privacy boundary through docs and contextual guidance.',
            ]}
          />
        </div>
      ),
    },
    {
      id: 'arch-backend',
      group: 'System Design',
      label: 'Backend integration',
      eyebrow: 'Backend',
      title: 'How the frontend uses backend reporting and support APIs',
      summary:
        'The backend gives the frontend stable status, reporting, notification, export, and support APIs without centralizing payroll plaintext.',
      searchText:
        'backend integration status reporting notifications exports support apis read models query example',
      content: (
        <div className="space-y-8">
          <CodeBlock title="Backend query example" language="ts" code={backendExample} />

          <DataTable
            headers={['Backend capability', 'Why the frontend uses it']}
            rows={[
              ['Status and health', 'Expose operational state without forcing contract-level inspection for every review.'],
              ['Organization summaries', 'Help admins and auditors use aggregate-first reporting and export packages.'],
              ['Notifications', 'Highlight pending claims, settlement issues, and receipt activity.'],
              ['Supabase-backed persistence', 'Keep indexed workflow state and read models durable across hosted restarts.'],
              ['CipherBot query endpoint', 'Answer support-oriented questions with indexed context instead of static copy alone.'],
            ]}
          />
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
        'CipherRoll has progressed from a private payroll proof-of-concept into a fuller product surface with settlement, auditing, backend indexing, and support tooling.',
      searchText:
        'roadmap progress completed waves wave 1 wave 2 wave 3 wave 4 shipped features completed',
      content: (
        <div className="space-y-8">
          <RoadmapWave
            wave="Wave 1"
            status="Completed"
            title="Core privacy payroll flow"
            points={[
              'Established workspace creation, encrypted budget funding, and confidential payroll issuance.',
              'Adopted the CoFHE coprocessor flow for the current Arbitrum Sepolia target.',
              'Brought local decryptForView-based reads into the admin and employee surfaces.',
            ]}
          />
          <RoadmapWave
            wave="Wave 2"
            status="Completed"
            title="Confidential settlement foundation"
            points={[
              'Added real treasury-backed payroll funding and explicit payroll-run lifecycle management.',
              'Integrated the preferred wrapper-backed payout path for confidential settlement.',
              'Shipped aggregate-first auditor review and evidence receipt flows.',
            ]}
          />
          <RoadmapWave
            wave="Wave 3"
            status="Completed"
            title="Submission hardening and operator support"
            points={[
              'Strengthened wrapper-finalization verification and settlement regression coverage.',
              'Clarified the true host-chain privacy boundary through product wording and privacy guidance.',
              'Improved identifier handling and added contextual support through CipherBot.',
            ]}
          />
          <RoadmapWave
            wave="Wave 4"
            status="Completed"
            title="Backend foundation and reporting"
            points={[
              'Introduced a real backend service with indexed read models, health and status routes, reporting summaries, notifications, and export endpoints.',
              'Moved shared runtime config, backend clients, and cross-surface types into a reusable CipherRoll SDK.',
              'Added a hosted deployment path with Vercel frontend delivery, Render backend hosting, and Supabase-backed Postgres persistence.',
              'Extended support from static guidance into retrieval-backed product assistance and in-portal operator help.',
            ]}
          />
        </div>
      ),
    },
    {
      id: 'rm-future',
      group: 'Progress',
      label: 'Future wave',
      eyebrow: 'Future',
      title: 'What Wave 5 is intended to focus on',
      summary:
        'The next wave is planned for broader product maturity rather than the core flows already shipped in Waves 1 through 4.',
      searchText:
        'wave 5 future plans governance integrations compliance notifications future roadmap',
      content: (
        <div className="space-y-8">
          <RoadmapWave
            wave="Wave 5"
            status="Planned"
            title="Advanced operations, governance, and compliance expansion"
            points={[
              'Stronger multi-admin governance and execution boundaries where the product needs them.',
              'Broader operational integrations, notification depth, and workflow polish around existing payroll surfaces.',
              'More developed tax or compliance-facing capabilities once those routes become real product features.',
            ]}
          />
        </div>
      ),
    },
  ],
  reference: [
    {
      id: 'ref-config',
      group: 'Reference',
      label: 'Configuration',
      eyebrow: 'Reference',
      title: 'Core runtime values',
      summary:
        'These are the constants reviewers and developers usually need first when checking docs, frontend behavior, or network alignment.',
      searchText:
        'configuration runtime values constants network chain id contract address backend base url default workspace',
      content: (
        <div className="space-y-8">
          <DataTable
            headers={['Item', 'Current value']}
            rows={[
              ['Target network', TARGET_CHAIN_NAME],
              ['Target chain id', `${TARGET_CHAIN_ID}`],
              ['Default workspace seed', DEFAULT_ORG_ID],
              ['Payroll contract', CONTRACT_ADDRESS],
              ['Auditor disclosure contract', AUDITOR_DISCLOSURE_CONTRACT_ADDRESS],
              ['Backend base URL', BACKEND_BASE_URL || 'Configured at runtime'],
              ['Hosted storage', 'Supabase Postgres'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'ref-routes',
      group: 'Reference',
      label: 'Routes and endpoints',
      eyebrow: 'Reference',
      title: 'Frontend routes and backend endpoints',
      summary:
        'This section saves teams from reading the source every time they need the route map or the main backend surface.',
      searchText:
        'routes endpoints frontend routes backend endpoints admin employee auditor docs tax authority api health status export',
      content: (
        <div className="space-y-8">
          <DataTable
            headers={['Frontend route', 'Purpose']}
            rows={[
              ['/admin', 'Workspace, budget, payroll, treasury, reporting, and auditor-sharing workflow.'],
              ['/employee', 'Local payroll review, claim, and wrapper-finalization workflow.'],
              ['/auditor', 'Recipient permit import, aggregate review, and evidence receipt workflow.'],
              ['/docs', 'Product documentation and support-oriented context.'],
              ['/tax-authority', 'Status-only page for a future workflow, not a live tax portal today.'],
            ]}
          />

          <DataTable
            headers={['Backend endpoint', 'Purpose']}
            rows={[
              ['GET /api/health', 'Basic health check for the backend service.'],
              ['GET /api/status', 'Indexer and runtime status.'],
              ['GET /api/organizations/:orgId/runs', 'Run-level read model.'],
              ['GET /api/reports/organizations/:orgId/summary', 'Aggregate-first organization summary.'],
              ['GET /api/reports/organizations/:orgId/export', 'Operator export packaging.'],
              ['POST /api/cipherbot/query', 'Support-oriented product Q&A surface.'],
            ]}
          />

          <DataTable
            headers={['Repo doc', 'Purpose']}
            rows={[
              ['docs/ARCHITECTURE.md', 'Backend, frontend, contracts, and service boundaries.'],
              ['docs/ROADMAP.md', 'Wave-by-wave product progression and planned next work.'],
              ['docs/FRONTEND_MANUAL_QA.md', 'Frontend validation checklist for the shipped product surfaces.'],
              ['docs/TESTING.md', 'Manual and integration-oriented validation guidance.'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'ref-troubleshooting',
      group: 'Support',
      label: 'Troubleshooting and FAQ',
      eyebrow: 'Support',
      title: 'Common questions the docs should answer directly',
      summary:
        'This section captures the questions most likely to come from engineers, operators, and reviewers of the current frontend.',
      searchText:
        'troubleshooting faq wallet disabled no payroll rows auditor salary rows tax page publish receipts verify receipt common questions',
      content: (
        <div className="space-y-8">
          <DataTable
            headers={['Question or symptom', 'Recommended answer']}
            rows={[
              [
                'Why is the wallet connected but actions are disabled?',
                `Check that the wallet is on ${TARGET_CHAIN_NAME} and that privacy mode or the relevant permit flow has been initialized.`,
              ],
              [
                'Why does the employee not see any payroll rows?',
                'Confirm the employee wallet, workspace id, and run activation status before treating it as a deeper bug.',
              ],
              [
                'Can the auditor see salary rows?',
                'No. The current auditor surface is aggregate-only by design.',
              ],
              [
                'Is the tax page a live compliance workflow?',
                'No. It is currently a status page that signals roadmap scope, not a shipped regulator portal.',
              ],
              [
                'Should publish receipts be the default?',
                'No. Verify is the narrower default. Publish should be reserved for explicit downstream needs.',
              ],
            ]}
          />
        </div>
      ),
    },
  ],
};

function CodeBlock({
  title,
  code,
  language = 'text',
}: {
  title: string;
  code: string;
  language?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/40">
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.02] px-4 py-3">
        <span className="text-[11px] font-black uppercase tracking-[0.22em] text-white">
          {title}
        </span>
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">
          {language}
        </span>
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
  const toneStyles = {
    orange: 'text-white',
    blue: 'text-white',
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4">
      <p className={`mb-2 text-[11px] font-black uppercase tracking-[0.22em] ${toneStyles[tone]}`}>
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

function GlossaryCard({
  title,
  items,
}: {
  title: string;
  items: Array<[string, string]>;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <h3 className="mb-4 text-base font-bold text-white">{title}</h3>
      <div className="space-y-4">
        {items.map(([label, description]) => (
          <div key={label}>
            <p className="text-sm font-semibold text-gray-200">{label}</p>
            <p className="mt-1 text-sm leading-7 text-gray-400">{description}</p>
          </div>
        ))}
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

function StepStack({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <h3 className="mb-4 text-base font-bold text-white">{title}</h3>
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={step} className="flex items-start gap-3">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-black/40 text-[11px] font-black text-white">
              {index + 1}
            </div>
            <p className="text-sm leading-7 text-gray-400">{step}</p>
          </div>
        ))}
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

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-white/[0.08] bg-black/30 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-white">
          {wave}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${
            isCompleted
              ? 'bg-white/10 text-white'
              : 'bg-white/5 text-gray-300'
          }`}
        >
          {status}
        </span>
      </div>

      <h3 className="mt-4 text-xl font-bold text-white">{title}</h3>
      <div className="mt-4 space-y-3">
        {points.map((point) => (
          <div key={point} className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-white" />
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
              Search by section title, workflow, route, privacy topic, or feature.
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
          style={{ backgroundImage: "url('/assets/milad-fakurian-7W3X1dAuKqg-unsplash.jpg')" }}
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
              Setup, workflows, privacy boundaries, architecture, progress, and reference material
              for the current CipherRoll product.
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

          <div ref={contentTopRef} className="mt-10 grid items-start gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="w-full lg:sticky lg:top-28 lg:w-[260px] lg:self-start">
              <GlassCard className="rounded-2xl border border-white/[0.08] bg-black/30 p-5">
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
          </div>
        </div>

        <CipherBotWidget
          scope="docs"
          headline="Your contextual guide for CipherRoll docs and product behavior."
          intro="Ask about local setup, payroll workflows, privacy boundaries, backend endpoints, or auditor review. I will keep the answer aligned with the current CipherRoll implementation."
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
              className="inline-flex items-center gap-2 rounded-md bg-white/6 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10"
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
