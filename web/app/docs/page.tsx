'use client';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Cpu, Lock, Map as MapIcon, Shield, Rocket, Terminal } from "lucide-react";
import CipherBotWidget from "@/components/CipherBotWidget";
import GlassCard from "@/components/GlassCard";
import {
  CONTRACT_ADDRESS,
  DEFAULT_ORG_ID,
  TARGET_CHAIN_NAME
} from "@/lib/cipherroll-config";

const tabs = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "architecture", label: "Architecture", icon: Cpu },
  { id: "roadmap", label: "Roadmap & Progress", icon: MapIcon },
  { id: "setup", label: "Local Setup", icon: Terminal }
];

const timelinePhases = [
  {
    id: "wave1",
    wave: "Phase 1: Core Privacy Protocol",
    description: <>The currently shipped admin and employee payroll flow running on the <span className="font-bold text-white">CoFHE coprocessor</span> stack for <span className="font-bold text-white">{TARGET_CHAIN_NAME}</span>.</>,
    status: "COMPLETE",
    tags: ["CoFHE Coprocessor", TARGET_CHAIN_NAME, "WASM Decryption", "EIP-712 Permits"],
    milestones: [
      <>Workspace creation, encrypted budget funding, and single-admin payroll issuance are implemented in the current contract and frontend.</>,
      <>CipherRoll now runs on the <span className="font-bold text-white">CoFHE Coprocessor</span> pattern for compatibility with <span className="font-bold text-white">{TARGET_CHAIN_NAME}</span>.</>,
      <>Implemented <span className="font-bold text-white">client-side decryptForView()</span> via `@cofhe/sdk` so employee and admin plaintext stays in the browser.</>,
      <>Current encrypted state, handles, and tests align with the official CoFHE <span className="font-bold text-white">TaskManager</span> workflow.</>,
      <>The production build, compile step, and automated contract tests all pass from the root baseline command.</>
    ],
    callout: <>This foundation established the private-by-default payroll model: encrypted values on-chain, wallet-local decrypts in the browser, and a working admin plus employee surface.</>,
    isCurrent: false
  },
  {
    id: "wave2",
    wave: "Phase 2: Confidential Settlement Foundation",
    description: <>Phase 2 established the real confidential payroll core: treasury-backed settlement, FHERC20 wrapper payouts, aggregate-first auditor review, and verifiable audit receipts on <span className="font-bold text-white">{TARGET_CHAIN_NAME}</span>.</>,
    status: "COMPLETE",
    tags: ["Treasury Settlement", "FHERC20 Wrapper", "Auditor Portal", "Audit Receipts"],
    milestones: [
      <>Standardized end to end on <span className="font-bold text-white">@cofhe/sdk</span> builder APIs including `encryptInputs`, `decryptForView`, and `decryptForTx`.</>,
      <>Shipped a real treasury-backed payroll lifecycle with explicit create, fund, activate, claim, and finalize steps.</>,
      <>Integrated the preferred <span className="font-bold text-white">FHERC20 wrapper</span> settlement path so employees can request payout confidentially, then finalize through an on-chain proof flow with an explicit disclosure tradeoff.</>,
      <>Delivered an aggregate-first auditor portal with shared permits, single-metric evidence receipts, and batched compliance receipts.</>
    ],
    callout: <>This is the completed confidential settlement layer: real payroll payout infrastructure plus selective-disclosure audit evidence.</>,
    isCurrent: false
  },
  {
    id: "wave3",
    wave: "Phase 3: Hardening & Operator Support",
    description: <>The current submission snapshot layers hardening and operator support on top of the Phase 2 core: truthful privacy boundaries, reduced avoidable leakage, safer identifiers, stronger wrapper verification, and a lightweight in-product CipherBot across docs, admin, and auditor surfaces.</>,
    status: "ACTIVE",
    tags: ["Submission Hardening", "Privacy Matrix", "CipherBot", "Operator Support"],
    milestones: [
      <>Patched the wrapper-finalize path so the final unshield release no longer accepts proof-shaped payloads without on-chain verification.</>,
      <>Locked the wrapper settlement path with permanent regression tests covering wrong plaintext, mismatched request id, replay attempts, and missing pending-request cases.</>,
      <>Published a clear <span className="font-bold text-white">privacy matrix</span>, corrected misleading disclosure language, trimmed convenience-only leakage, and reduced unnecessary identifier inference where practical.</>,
      <>Shipped a lightweight <span className="font-bold text-white">CipherBot</span> across docs, admin, and auditor portals for product-specific onboarding, explanation, and operator support.</>,
      <>Deferred larger platform work such as SDK extraction, operator exports, backend/indexing, and deeper compliance surfaces to later waves so the current submission stays stable and truthful.</>
    ],
    callout: <>This is the current submission-ready layer: not a new backend platform yet, but a materially more truthful, stable, and operator-friendly CipherRoll.</>,
    isCurrent: true
  },
  {
    id: "wave4",
    wave: "Phase 4: Backend Foundation & Product Data Plane",
    description: <>Phase 4 is where CipherRoll grows beyond a contracts-plus-frontend submission into a more complete application platform with read models, backend APIs, reporting infrastructure, and a real retrieval-backed assistant.</>,
    status: "PLANNED",
    tags: ["Backend", "Indexer", "Reporting APIs", "Real CipherBot"],
    milestones: [
      <>Stand up the first real backend service with health checks, structured config, and authenticated API routes where appropriate.</>,
      <>Add event ingestion and normalized read models so organizations, runs, claims, finalizations, and receipts can be queried cleanly.</>,
      <>Move heavier exports and reporting into backend-safe APIs instead of asking the browser to reconstruct everything ad hoc.</>,
      <>Expand <span className="font-bold text-white">CipherBot</span> into a real retrieval-backed assistant that can answer free-form product questions from indexed docs and portal-aware guidance.</>
    ],
    callout: <>This is the next serious product layer: better data plumbing, better reporting, and a more capable support surface without centralizing sensitive decrypt paths.</>,
    isCurrent: false
  },
  {
    id: "wave5",
    wave: "Phase 5: Advanced Operations, Governance & Compliance Expansion",
    description: <>Later waves are reserved for heavier execution boundaries such as real on-chain governance, deeper integrations, notification surfaces, tax workflows, and larger compliance or ecosystem expansion.</>,
    status: "FUTURE",
    tags: ["Governance", "Integrations", "Notifications", "Tax Workflows"],
    milestones: [
      <>Turn reserved quorum metadata into real on-chain multi-admin governance and controlled execution gating.</>,
      <>Add backend-powered integrations, notifications, and cleaner external API boundaries for enterprise workflows.</>,
      <>Expand the tax-authority roadmap into real encrypted tax provisioning, regulator-specific disclosure, and policy-driven reporting.</>,
      <>Revisit larger assistant and communication surfaces only after backend and governance boundaries are mature enough to support them safely.</>
    ],
    callout: <>These items are intentionally deferred. They matter, but they are not part of the current submission snapshot and should not be presented as already shipped capability.</>,
    isCurrent: false
  }
];

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative min-h-screen text-white bg-black selection:bg-white/30 overflow-hidden font-sans">
      <div
        className="fixed inset-0 z-0 bg-[length:800px] md:bg-[length:1800px] bg-left bg-no-repeat bg-fixed opacity-40"
        style={{ backgroundImage: "url('/assets/milad-fakurian-7W3X1dAuKqg-unsplash.jpg')" }}
      />
      <div className="fixed inset-0 z-0 bg-black/60 backdrop-blur-[2px]" />

      <main className="relative z-10 pt-32 pb-24 px-6 w-full flex flex-col items-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
          CipherRoll <span className="text-[#06b6d4]">Documentation</span>
        </h1>
        <p className="text-[#a1a1aa] text-lg max-w-3xl mx-auto text-center leading-relaxed">
          Explore the current CipherRoll product, architecture, and roadmap. The shipped app today centers on encrypted payroll operations, treasury-backed settlement, and selective-disclosure auditing on {TARGET_CHAIN_NAME}.
        </p>

        <div className="flex justify-center w-full mb-16">
          <div className="flex items-center gap-2 bg-[#0a0a0a]/80 border border-white/10 rounded-full p-2 backdrop-blur-xl overflow-x-auto max-w-full shadow-2xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeTab === tab.id
                    ? "bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full max-w-5xl mx-auto min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-10"
            >
              {activeTab === "overview" && (
                <>
                  <GlassCard className="p-10 border-white/5 bg-[#0a0a0a] rounded-3xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#06b6d4]/10 border border-[#06b6d4]/20 text-[#06b6d4] text-xs font-bold tracking-widest uppercase mb-6">
                      The Platform
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-6">
                      Current Product Scope
                    </h2>
                    <div className="grid md:grid-cols-2 gap-6 text-sm leading-relaxed">
                      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                        <h3 className="text-white font-bold text-lg mb-3">What ships today</h3>
                        <p className="text-[#c9c9d0] mb-4">
                          CipherRoll currently ships a focused payroll flow rather than a full compliance suite. Admins can create workspaces, fund encrypted budget state, create payroll runs, upload allocations, activate claimability, and drive treasury-backed settlement. Employees can fetch allocation handles, decrypt them locally after signing a permit, and complete payout from their own wallet.
                        </p>
                        <p className="text-[#c9c9d0]">
                          The current runtime uses the official <span className="font-bold text-white">CoFHE (Coprocessor for Fully Homomorphic Encryption)</span> stack on <span className="font-bold text-white">{TARGET_CHAIN_NAME}</span>. Contract arithmetic runs over ciphertext handles while plaintext stays local to authorized wallets.
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                        <h3 className="text-white font-bold text-lg mb-3">What does not ship yet</h3>
                        <p className="text-[#c9c9d0] mb-4">
                          Tax authority workflows, automated withholding, multi-admin execution gating, and broader compliance automation are still roadmap work.
                        </p>
                        <p className="text-[#c9c9d0]">
                          The tax route remains a status page so the current boundary stays explicit. The live product surface today includes admin, employee, auditor, and docs.
                        </p>
                      </div>
                    </div>
                  </GlassCard>

                  <div className="grid md:grid-cols-3 gap-6">
                    {[
                      {
                        icon: Shield,
                        title: "Homomorphic Budgeting",
                        text: "Budget, committed payroll, and available runway stay encrypted while the contract performs native arithmetic over ciphertext handles."
                      },
                      {
                        icon: Rocket,
                        title: "EVM Wallet Flow",
                        text: "The current app works with standard injected wallets for admin actions, employee reads, and permit-backed local decryption."
                      },
                      {
                        icon: Terminal,
                        title: "SDK E2E Integration",
                        text: "The current @cofhe/sdk plus cofhe-contracts stack binds encrypted inputs and local decrypt flows directly to the web interface."
                      }
                    ].map((item) => (
                      <GlassCard key={item.title} className="p-6 border-white/5 bg-[#0a0a0a] rounded-3xl">
                        <item.icon className="w-6 h-6 text-cyan-300 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                        <p className="text-sm text-[#a1a1aa] leading-relaxed">{item.text}</p>
                      </GlassCard>
                    ))}
                  </div>

                  <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
                    <h3 className="text-2xl font-bold text-white mb-4">Privacy Boundary Today</h3>
                    <div className="grid md:grid-cols-3 gap-4 text-sm leading-relaxed">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/55 font-bold mb-3">Private</p>
                        <p className="text-[#c9c9d0]">
                          Budget, committed payroll, available runway, and each employee allocation amount stay encrypted on-chain and are only decrypted locally by wallets with the right permit.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/55 font-bold mb-3">Public</p>
                        <p className="text-[#c9c9d0]">
                          Workspace ids, admin and employee wallet addresses, payment ids, memo hashes, vesting windows, payroll-run status, funding deadlines, and claim/finalization transactions remain visible on the host chain.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/55 font-bold mb-3">Settlement</p>
                        <p className="text-[#c9c9d0]">
                          The app currently tracks encrypted payroll allocations inside CipherRoll and can now settle them through a treasury-backed payout path. If a workspace uses the FHERC20 wrapper route, payroll first moves through a confidential wrapper balance, then the employee finishes an <span className="font-bold text-white">request + finalize + unshield</span> flow. The balance stays confidential before wrapper-request decryption, but the on-chain finalize proof can reveal the amount before the last token-release step completes.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:col-span-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/55 font-bold mb-3">Auditor selective disclosure</p>
                        <p className="text-[#c9c9d0]">
                          CipherRoll now ships an aggregate-first auditor portal. Admins create a current <span className="font-bold text-white">@cofhe/sdk</span> sharing permit for a named recipient, export the non-sensitive payload, and the auditor imports it as a recipient permit. That permit decrypts only the aggregate budget / committed / available handles and public compliance-safe summary fields exposed by the contract. It does <span className="font-bold text-white">not</span> unlock employee salary rows, employee allocation handles, or unnecessary PII.
                        </p>
                        <p className="mt-4 text-[#c9c9d0]">
                          When an audit needs defensible evidence instead of a view-only disclosure, CipherRoll can now take one shared aggregate metric at a time, or a selected batch of shared aggregate metrics, through <span className="font-bold text-white">decryptForTx</span> and into either an on-chain verify receipt or a published decrypt result. Verify is the narrower default; publish is reserved for cases where downstream contracts need the result directly.
                        </p>
                        <p className="mt-4 text-[#c9c9d0]">
                          In plain language: <span className="font-bold text-white">view-only review</span> keeps the decrypted aggregate values local to the auditor browser, while <span className="font-bold text-white">receipt mode</span> records evidence on-chain for the selected metric or batch.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:col-span-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/55 font-bold mb-3">Current privacy matrix</p>
                        <div className="space-y-3 text-[#c9c9d0]">
                          <p>
                            <span className="font-bold text-white">Encrypted on-chain:</span> budget handles, committed/available summary handles, employee allocation amounts, auditor aggregate handles, and wrapper balances before wrapper-request decryption.
                          </p>
                          <p>
                            <span className="font-bold text-white">Public by Arbitrum / EVM design:</span> transaction calldata, logs, wallet addresses, timestamps, ERC20 transfers, and wrapper settlement amounts once the <span className="font-bold text-white">decryptForTx</span> finalize proof is posted on-chain.
                          </p>
                          <p>
                            <span className="font-bold text-white">Public because CipherRoll stores or emits them:</span> workspace metadata hashes, treasury route ids, payment ids, memo hashes, payroll-run metadata, lifecycle counters, settlement request metadata, and settlement events.
                          </p>
                          <p>
                            <span className="font-bold text-white">Inferable because the current frontend hashes predictable strings:</span> many `bytes32` labels such as workspace ids, payroll-run ids, route ids, and readable memo labels can still be guessed if operators keep mnemonic names, even though the admin flow now prefers higher-entropy generation where practical.
                          </p>
                          <p>
                            The full matrix is published in <span className="font-bold text-white">docs/PRIVACY_MATRIX.md</span> in the repository.
                          </p>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </>
              )}

              {activeTab === "architecture" && (
                <>
                  <GlassCard className="p-10 border-white/5 bg-[#0a0a0a] rounded-3xl">
                    <h2 className="text-3xl font-black text-white mb-6">System Architecture</h2>
                    <div className="grid md:grid-cols-2 gap-6 text-sm leading-relaxed">
                      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                        <h3 className="text-white font-bold text-lg mb-3">InEuint128 Smart Contract Mechanics</h3>
                        <p className="text-[#c9c9d0] mb-4">
                          The `CipherRollPayroll.sol` protocol handles complete organizational lifecycles. Utilizing `@fhenixprotocol/cofhe-contracts`, the contract securely parses <span className="font-bold text-white">InEuint128</span> calldata structures mapping precisely to <span className="font-bold text-white">(uint256 ctHash, uint8 securityZone, uint8 utype, bytes signature)</span>.
                        </p>
                        <p className="text-[#c9c9d0]">
                          {`This is generated by the user's browser, enabling deeply restricted variables like `}<span className="font-bold text-white">_encryptedAvailable[orgId]</span> {`to be calculated automatically and securely on the host node without triggering stack limits.`}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                        <h3 className="text-white font-bold text-lg mb-3">Restricted `FHE.allow()` Methodology</h3>
                        <p className="text-[#c9c9d0] mb-4">
                          Operating the CoFHE Coprocessor natively restricts access to computed memory references. By default, not even the caller can deduce the underlying returned FHE variable. 
                        </p>
                        <p className="text-[#c9c9d0]">
                          {`CipherRoll establishes explicit visibility logic by attaching `}<span className="font-bold text-white">FHE.allowThis(newAvailable)</span> {`ensuring the internal contract mapping can manipulate it, whilst concurrently firing `}<span className="font-bold text-white">FHE.allow(newAvailable, msg.sender)</span> {`to explicitly grant the organization's administration wallet the sole key capability for offline decryption.`}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:col-span-2">
                        <h3 className="text-white font-bold text-lg mb-3">Client-Side WASM Decryption (@cofhe/sdk)</h3>
                        <p className="text-[#c9c9d0] mb-4">
                          Previous attempts at confidentially processing zero-knowledge functions suffered severely because off-chain proxies routed decrypted outputs. CipherRoll utilizes standard `ethers.js` connected to the current `@cofhe/sdk` client via `createCofheClient(...)`. 
                        </p>
                        <p className="text-[#c9c9d0]">
                          Our frontend prompts the wallet to uniquely sign an `EIP-712` view permit, then runs `client.decryptForView(...)` for local reads. Auditor evidence flows now extend the same model with `client.decryptForTx(...)`.
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:col-span-2">
                        <h3 className="text-white font-bold text-lg mb-3">Current Contract Boundary</h3>
                        <p className="text-[#c9c9d0] mb-4">
                          The current contract and frontend focus on workspace metadata, encrypted budget summaries, payroll-run lifecycle state, encrypted payroll issuance, vesting, employee claim state, treasury-backed settlement, and auditor-safe aggregate disclosures. They do not include cross-chain bridges, tax authority workflows, or multi-admin governance yet.
                        </p>
                        <p className="text-[#c9c9d0]">
                          That narrower boundary is intentional for now: it keeps the shipped behavior aligned with what can be demonstrated, tested, and verified in the current repository.
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:col-span-2">
                        <h3 className="text-white font-bold text-lg mb-3">Selective Disclosure Rules</h3>
                        <p className="text-[#c9c9d0] mb-4">
                          Auditor sharing does not bypass CipherRoll&apos;s contract ACLs. The current shared-permit model only works for the aggregate handles intentionally exposed by the auditor getters, and only because the data owner already granted on-chain <span className="font-bold text-white">FHE.allow(...)</span> access to those handles.
                        </p>
                        <p className="text-[#c9c9d0] mb-4">
                          View-only review and provable receipts are intentionally separate. A recipient permit can power both <span className="font-bold text-white">decryptForView(...)</span> for local review and <span className="font-bold text-white">decryptForTx(...)</span> for on-chain evidence, but CipherRoll keeps the provable path narrow to one selected aggregate metric at a time or a selected batch of those same aggregate metrics.
                        </p>
                        <p className="text-[#c9c9d0] mb-4">
                          Verify mode proves that a disclosed value matches the shared encrypted handle and emits a narrow receipt. Publish mode goes further by making that decrypt result available on-chain for downstream contract consumers.
                        </p>
                        <p className="text-[#c9c9d0]">
                          Permit removal in the admin or auditor browser should be read honestly as a local revoke aid. It helps stop future local decrypts in that wallet/browser session, but it is not a universal remote invalidation of every previously imported permit copy.
                        </p>
                      </div>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-10 border-white/5 bg-[#0a0a0a] rounded-3xl">
                    <h3 className="text-2xl font-bold text-white mb-4">Current Network Parameters</h3>
                    <div className="space-y-4 text-sm">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/55 font-bold mb-2">{TARGET_CHAIN_NAME} Contract</p>
                        <p className="font-mono text-white break-all">{CONTRACT_ADDRESS || "NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS"}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/55 font-bold mb-2">Default Context ID</p>
                        <p className="font-mono text-white">{DEFAULT_ORG_ID}</p>
                      </div>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-10 border-white/5 bg-[#0a0a0a] rounded-3xl">
                    <h3 className="text-2xl font-bold text-white mb-6">FHE Security & Privacy Enforcement</h3>
                    <div className="space-y-6 text-sm text-[#d0d0d6]">
                       <div className="flex gap-4">
                          <div className="h-10 w-10 shrink-0 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                             <Shield className="w-5 h-5 text-cyan-400" />
                          </div>
                          <div>
                             <h4 className="text-white font-bold mb-1">EIP-712 Permit Scoping</h4>
                             <p className="leading-relaxed">{`Access to encrypted state is protected by cryptographically secure permits. Unlike public blockchains where 'anyone can read', our FHE variables require a signature that is verified inside the `}<span className="font-bold text-white">CoFHE TaskManager</span>. This prevents metadata leakage and unauthorized handle scraping via open RPCs.</p>
                          </div>
                       </div>
                       <div className="flex gap-4">
                          <div className="h-10 w-10 shrink-0 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                             <Lock className="w-5 h-5 text-cyan-400" />
                          </div>
                          <div>
                             <h4 className="text-white font-bold mb-1">Mathematically Guaranteed Privacy</h4>
                             <p className="leading-relaxed">{`Because CipherRoll operates over encrypted integers (`}<span className="font-bold text-white">euints</span>{`), the network nodes performing the math (addition, subtraction, selection) never witness the actual dollars. This `}<span className="font-bold text-white">{`"Blind Computation"`}</span> {`ensures that even a malicious validator cannot see your organization's financial strength.`}</p>
                          </div>
                       </div>
                    </div>
                  </GlassCard>
                </>
              )}

              {activeTab === "roadmap" && (
                <div className="max-w-4xl mx-auto py-10 relative">
                  <div className="text-left md:text-center mb-24 relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-xs font-bold tracking-widest uppercase mb-6">
                      Roadmap
                    </div>
                    <h2 className="text-5xl md:text-6xl font-black tracking-tight text-white mb-6">
                      Development <br className="hidden md:block"/>
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Timeline</span>
                    </h2>
                    <p className="text-[#a1a1aa] text-lg max-w-2xl md:mx-auto">
                      This timeline now separates what CipherRoll has already shipped, what was hardened for the current submission, and what is intentionally deferred to future waves so the product boundary stays explicit.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4 mb-14">
                    {[
                      {
                        label: "Completed Layers",
                        value: "Phase 1 + 2",
                        text: "Private payroll core plus real settlement and audit evidence are already shipped."
                      },
                      {
                        label: "Current Focus",
                        value: "Phase 3",
                        text: "Hardening, truthful privacy boundaries, reduced leakage, and operator support."
                      },
                      {
                        label: "Submission State",
                        value: "Ready",
                        text: "Compile, tests, and production web build are green for the current snapshot."
                      },
                      {
                        label: "Deferred Work",
                        value: "Phase 4 + 5",
                        text: "Backend, indexing, exports, tax workflows, and deeper governance stay in later waves."
                      }
                    ].map((item) => (
                      <GlassCard key={item.label} className="rounded-3xl border-white/8 bg-[#0a0a0a] p-5">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-white/45 font-bold mb-3">{item.label}</p>
                        <p className="text-2xl font-black tracking-tight text-white mb-2">{item.value}</p>
                        <p className="text-sm leading-relaxed text-[#a1a1aa]">{item.text}</p>
                      </GlassCard>
                    ))}
                  </div>

                  <div className="h-px w-full bg-white/8 mb-16" />

                  <div className="absolute left-[24px] md:left-1/2 top-[22rem] bottom-4 w-[2px] bg-gradient-to-b from-cyan-400/50 via-cyan-400/20 to-transparent md:-translate-x-1/2"></div>

                  <div className="space-y-20">
                    {timelinePhases.map((phase, index) => {
                      const isEven = index % 2 === 0;
                      return (
                        <div key={phase.id} className="relative flex items-start md:items-center w-full">
                          <div className={`absolute left-[19px] md:left-1/2 w-3 h-3 rounded-full md:-translate-x-[5.5px] mt-8 md:mt-0 z-10 border-[3px] border-black ${
                            phase.isCurrent ? "bg-cyan-400 ring-4 ring-cyan-400/30" : "bg-white/20 ring-2 ring-white/10"
                          }`}></div>

                          <div className={`flex w-full md:w-[calc(50%-2rem)] flex-col pl-16 md:pl-0 ${isEven ? "md:mr-auto md:items-end md:text-right" : "md:ml-auto md:items-start md:text-left"}`}>
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase mb-4 w-max ${
                              phase.isCurrent ? "bg-cyan-500/20 text-cyan-400" : "bg-white/10 text-white/70"
                            }`}>
                              {phase.isCurrent ? "•" : "✓"} {phase.status}
                            </div>

                            <h3 className={`text-2xl md:text-3xl font-bold text-white mb-3 ${phase.isCurrent ? "text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70" : ""}`}>
                              {phase.wave}
                            </h3>

                            <p className="text-[#a1a1aa] text-sm md:text-base leading-relaxed mb-4 max-w-md">
                              {phase.description}
                            </p>

                            <div className={`flex flex-wrap gap-2 mb-4 ${isEven ? "md:justify-end" : "md:justify-start"}`}>
                              {phase.tags.map(tag => (
                                <span key={tag} className="px-3 py-1 bg-black/50 border border-white/5 rounded-full text-xs text-white/50">
                                  {tag}
                                </span>
                              ))}
                            </div>

                            <div className="grid gap-2 w-full max-w-md">
                              {phase.milestones.map((milestone, idx) => (
                                <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-3.5 text-sm text-[#d0d0d6] leading-relaxed">
                                  {milestone}
                                </div>
                              ))}
                            </div>

                            <div className="mt-4 w-full max-w-md rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-50 leading-relaxed">
                              {phase.callout}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === "setup" && (
                <>
                  <GlassCard className="p-10 border-white/5 bg-[#0a0a0a] rounded-3xl">
                    <h2 className="text-3xl font-black text-white mb-6">Local setup</h2>
                    <div className="space-y-6 text-sm text-[#d0d0d6]">
                      <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/55 font-bold mb-3">1. Install dependencies</p>
                        <pre className="overflow-x-auto text-white font-mono text-xs">npm install
cd web && npm install</pre>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/55 font-bold mb-3">2. Configure Environment</p>
                        <pre className="overflow-x-auto text-white font-mono text-xs">cp .env.example .env
# Essential for CoFHE interactions:
ARBITRUM_SEPOLIA_RPC_URL=your_rpc_here
DEPLOYER_PRIVATE_KEY=your_key_here
# Frontend uses @cofhe/sdk for local encryption and decrypt flows:
NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS=0xAeCaDDa189f35EfB69C2dCc37688030A9Af58DC3
NEXT_PUBLIC_CIPHERROLL_AUDITOR_DISCLOSURE_ADDRESS=0x328Fe7B46ddf38888978C3f6CDC49233810ccE49
NEXT_PUBLIC_CIPHERROLL_DIRECT_SETTLEMENT_ADAPTER=0x4d0EbdE132402145D464089Fd7bE7362dec6f428
NEXT_PUBLIC_CIPHERROLL_WRAPPER_SETTLEMENT_ADAPTER=0x892DEaAaf13fb4a5a57288bB6089565c3cdB95e0
NEXT_PUBLIC_DEFAULT_ORG_ID=cipherroll-default-org
NEXT_PUBLIC_CIPHERROLL_TARGET_CHAIN=arb-sepolia</pre>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/55 font-bold mb-3">3. Deploy and run</p>
                        <pre className="overflow-x-auto text-white font-mono text-xs">npm run baseline
npm run deploy:arb-sepolia
cd web && npm run dev</pre>
                      </div>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-10 border-white/5 bg-[#0a0a0a] rounded-3xl">
                    <h3 className="text-2xl font-bold text-white mb-4">Platform Demonstration Path</h3>
                    <div className="grid gap-3 text-sm">
                      {[
                        "Provision the organization configuration in /admin.",
                        "Fund the encrypted budget state.",
                        "Allocate one confidential payroll issuance.",
                        "Authenticate the employee wallet and execute native permits.",
                        "Refresh /employee to reliably verify accurate, homomorphically decrypted values."
                      ].map((step) => (
                        <div key={step} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[#d0d0d6]">
                          {step}
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <CipherBotWidget
        scope="docs"
        headline="Your contextual guide for CipherRoll documentation."
        intro="I can help explain the current CipherRoll docs, payroll flow, wrapper settlement steps, auditor permit behavior, disclosure boundaries, and common operator mistakes. What are you looking for?"
      />
    </div>
  );
}
