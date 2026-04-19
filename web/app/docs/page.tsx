'use client';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Cpu, Lock, Map as MapIcon, Shield, Rocket, Terminal } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import {
  CONTRACT_ADDRESS,
  DEFAULT_ORG_ID,
  SUPPORTED_CHAIN_NAMES,
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
    status: "LIVE",
    tags: ["CoFHE Coprocessor", TARGET_CHAIN_NAME, "WASM Decryption", "EIP-712 Permits"],
    milestones: [
      <>Workspace creation, encrypted budget funding, and single-admin payroll issuance are implemented in the current contract and frontend.</>,
      <>CipherRoll now runs on the <span className="font-bold text-white">CoFHE Coprocessor</span> pattern for compatibility with <span className="font-bold text-white">{SUPPORTED_CHAIN_NAMES}</span>.</>,
      <>Implemented <span className="font-bold text-white">client-side decryptForView()</span> via `@cofhe/sdk` so employee and admin plaintext stays in the browser.</>,
      <>Current encrypted state, handles, and tests align with the official CoFHE <span className="font-bold text-white">TaskManager</span> workflow.</>,
      <>The production build, compile step, and automated contract tests all pass from the root baseline command.</>
    ],
    callout: <>This is the verified product surface today: admin operations, employee reads, and the docs needed to run the flow end to end.</>,
    isCurrent: true
  },
  {
    id: "wave2",
    wave: "Phase 2: Technical Execution & Governance Overhaul",
    description: <>Aggressive upgrade maximizing CoFHE alignment, privacy execution, and governance decentralization across <span className="font-bold text-white">{SUPPORTED_CHAIN_NAMES}</span>.</>,
    status: "ACTIVE",
    tags: ["SDK Migration", "M-of-N Admins", "Shared Permits", "ReineiraOS"],
    milestones: [
      <>Standardize explicitly on <span className="font-bold text-white">@cofhe/sdk</span> builder APIs: `encryptInputs`, `decryptForView`, and `decryptForTx`.</>,
      <>Queue encrypted budget allocations via <span className="font-bold text-white">M-of-N threshold approval</span> payloads.</>,
      <>Design auditor disclosure flows around explicit aggregate reads rather than claiming a live auditor portal too early.</>,
      <>Integrate <span className="font-bold text-white">@reineira-os/sdk</span> resolving on-chain verifications using the FHE Auditor findings.</>
    ],
    callout: <>Uncompromising focus on technical execution and true zero-leakage privacy.</>,
    isCurrent: false
  },
  {
    id: "wave3",
    wave: "Phase 3: Total Compliance Integration",
    description: <>Broadening CipherRoll into a fuller compliance and settlement layer once the core payroll workflow is complete.</>,
    status: "FUTURE",
    tags: ["Tax Authority Flows", "Advanced Analytics", "Fiat On-Ramps", "Compliance"],
    milestones: [
      <>Automated <span className="font-bold text-white">tax provisioning</span> with explicit government-role access controls once those compliance workflows are implemented for real.</>,
      <>Expanding <span className="font-bold text-white">aggregate analytics</span> to include richer organization-level reporting while preserving PII privacy.</>,
      <>Automated <span className="font-bold text-white">Fiat On-Ramps</span> allowing organizations to seamlessly convert corporate fiat into encrypted stablecoins.</>
    ],
    callout: <>Driving the final vision for autonomous, private corporate operations.</>,
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
          Explore the current CipherRoll product, architecture, and roadmap. The shipped app today centers on encrypted payroll operations for admins and employees on {SUPPORTED_CHAIN_NAMES}.
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
                          CipherRoll currently ships a focused payroll flow rather than a full compliance suite. Admins can create workspaces, fund encrypted budget state, create payroll runs, upload allocations, activate claimability, and track claim state. Employees can fetch allocation handles and decrypt them locally after signing a permit.
                        </p>
                        <p className="text-[#c9c9d0]">
                          The current runtime uses the official <span className="font-bold text-white">CoFHE (Coprocessor for Fully Homomorphic Encryption)</span> stack on <span className="font-bold text-white">{TARGET_CHAIN_NAME}</span>. Contract arithmetic runs over ciphertext handles while plaintext stays local to authorized wallets.
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                        <h3 className="text-white font-bold text-lg mb-3">What does not ship yet</h3>
                        <p className="text-[#c9c9d0] mb-4">
                          Auditor selective-disclosure, tax authority workflows, automated withholding, multi-admin execution gating, and broader settlement rails are still roadmap work.
                        </p>
                        <p className="text-[#c9c9d0]">
                          Those future roles have status pages in the app so the current boundary stays explicit. The live product surface is admin, employee, and docs only.
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
                          The app currently tracks encrypted payroll allocations inside CipherRoll and can now settle them through a treasury-backed payout path. If a workspace uses the FHERC20 wrapper route, payroll first moves through a confidential wrapper balance, then the employee finishes an <span className="font-bold text-white">unshield + claim</span> step to release the underlying payout token on-chain.
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
                          Our frontend prompts the wallet to uniquely sign an `EIP-712` view permit, then runs `client.decryptForView(...)` for local reads. Phase 2 selective disclosures will extend the same flow with `client.decryptForTx(...)`.
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:col-span-2">
                        <h3 className="text-white font-bold text-lg mb-3">Current Contract Boundary</h3>
                        <p className="text-[#c9c9d0] mb-4">
                          The current contract and frontend focus on workspace metadata, encrypted budget summaries, payroll-run lifecycle state, encrypted payroll issuance, vesting, and employee claim state. They do not yet include live settlement assets, cross-chain bridges, or government-role workflows.
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
                      This timeline separates the currently shipped payroll flow from the later compliance and settlement work so the product boundary stays explicit.
                    </p>
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
# Frontend uses @cofhe/sdk for local encryption and decryptForView():
NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS=0x8227...</pre>
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
    </div>
  );
}
