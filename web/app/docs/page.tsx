'use client';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Cpu, Lock, Map as MapIcon, Shield, Rocket, Terminal } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { CONTRACT_ADDRESS, DEFAULT_ORG_ID } from "@/lib/cipherroll-config";

const tabs = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "architecture", label: "Architecture", icon: Cpu },
  { id: "roadmap", label: "Roadmap & Progress", icon: MapIcon },
  { id: "setup", label: "Local Setup", icon: Terminal }
];

const timelinePhases = [
  {
    id: "wave1",
    wave: "Wave 1: Buildathon Submission (Live)",
    description: "Our comprehensive submission featuring the complete <span className=\"font-bold text-white\">Fhenix CoFHE Coprocessor</span> architecture live on <span className=\"font-bold text-white\">Ethereum Sepolia</span>.",
    status: "SUBMITTED",
    tags: ["CoFHE Coprocessor", "Ethereum Sepolia", "WASM Client Decryption", "EIP-712 Permits"],
    milestones: [
      "Complete migration to `@fhenixprotocol/cofhe-contracts` (v0.1.3+) replacing legacy permissioned bases.",
      "Transition from Nitrogen-native FHE precompiles to the <span className=\"font-bold text-white\">CoFHE Coprocessor</span> pattern for public L1 (Sepolia) compatibility.",
      "Implemented <span className=\"font-bold text-white\">client-side unsealing</span> via `cofhejs.unseal()` to ensure plaintext never leaves the browser.",
      "Resolved critical ABI tuple mismatches for `InEuint128` to align with the official Fhenix <span className=\"font-bold text-white\">TaskManager</span> specification.",
      "Successfully deployed verified logic at 0x8227...8046 on Ethereum Sepolia."
    ],
    callout: "The current buildathon submission: Modernized for seamless <span className=\"font-bold text-white\">EVM equivalence</span> and true E2E privacy.",
    isCurrent: true
  },
  {
    id: "wave2",
    wave: "Wave 2: Governance & Compliance",
    description: "Hardening access control and introducing multi-sig organizational management for enterprise-scale payroll.",
    status: "PLANNED",
    tags: ["M-of-N Admins", "Selective Disclosure", "Auditor Sharing", "Real Permits"],
    milestones: [
      "Introduce <span className=\"font-bold text-white\">M-of-N threshold admin approvals</span> for critical workspace mutations.",
      "Add admin-gated <span className=\"font-bold text-white\">auditor permit sharing</span> for regulatory compliance without PII exposure.",
      "Hardened workspace metadata encryption with client-side salt derivation."
    ],
    callout: "Enhancing the core protocol with institutional-grade security controls.",
    isCurrent: false
  },
  {
    id: "wave3",
    wave: "Wave 3: Settlement & Recurring Flows",
    description: "Broadening CipherRoll into a cross-chain settlement engine with recurring encrypted payroll streams.",
    status: "FUTURE",
    tags: ["Pull Claims", "Vesting", "Privara Settlement", "Tax Vaults"],
    milestones: [
      "Launch pull-based payroll claims and <span className=\"font-bold text-white\">recurring encrypted vesting streams</span>.",
      "Automated tax provisioning via designated route identifiers.",
      "Connect the treasury adapter directly to <span className=\"font-bold text-white\">Privara / ReineiraOS</span> settlement layers."
    ],
    callout: "Driving the final vision for autonomous, private treasury operations.",
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
          Explore the product, architecture, and roadmap behind CipherRoll—the industry standard for encrypted, FHE-native payroll management on Fhenix.
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
                      Pioneering On-Chain Data Privacy
                    </h2>
                    <div className="grid md:grid-cols-2 gap-6 text-sm leading-relaxed">
                      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                        <h3 className="text-white font-bold text-lg mb-3">Enterprise-Grade Confidentiality via CoFHE</h3>
                        <p className="text-[#c9c9d0] mb-4">
                          {`CipherRoll operates on a paradigm shift in on-chain privacy. Instead of tracking balances in plaintext or relying on disjointed off-chain provers dictating Zero-Knowledge Snark payloads, CipherRoll utilizes Fhenix's latest `}<span className="font-bold text-white">CoFHE (Coprocessor for Fully Homomorphic Encryption)</span> architecture directly on the public <span className="font-bold text-white">Ethereum Sepolia</span> network.
                        </p>
                        <p className="text-[#c9c9d0]">
                          Administrators provision workspaces and execute highly sensitive payroll disbursements encrypted entirely client-side using a browser <span className="font-bold text-white">WASM payload (cofhejs)</span>. The Sepolia EVM network nodes compute additions and subtractions natively over these ciphertexts but never gain the ability to decrypt the underlying integer amounts.
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                        <h3 className="text-white font-bold text-lg mb-3">Eliminating the Wallet Sync Dilemma</h3>
                        <p className="text-[#c9c9d0] mb-4">
                          {`Legacy privacy networks forced users to "sync" their wallets, downloading thousands of cryptographic nodes essentially to maintain private UTXOs. CipherRoll fundamentally replaces this obsolete UX.`}
                        </p>
                        <p className="text-[#c9c9d0]">
                          Because we run on an EVM, the protocol utilizes <span className="font-bold text-white">synchronized global FHE state</span> managed safely in Smart Contract storage slots. The Employee simply connects their standard EVM wallet (e.g., MetaMask), hits a standard view function mapping to an <span className="font-bold text-white">euint128</span> state variable, and runs <span className="font-bold text-white">cofhejs.unseal()</span> to locally decrypt exactly what they are legally permitted to view. No syncing required.
                        </p>
                      </div>
                    </div>
                  </GlassCard>

                  <div className="grid md:grid-cols-3 gap-6">
                    {[
                      {
                        icon: Shield,
                        title: "Homomorphic Budgeting",
                        text: "Core treasury metrics (total budget, encumbrances) endure arithmetic state updates (e.g., FHE.add) natively. No secondary ZK verifier contract is required to mutate state."
                      },
                      {
                        icon: Rocket,
                        title: "EVM Composability",
                        text: "By adhering to standard Solidity interfaces (IERC20 modifiers, structured events), CipherRoll seamlessly pipelines into broader DeFi settlement tools and cross-chain messaging formats."
                      },
                      {
                        icon: Terminal,
                        title: "WASM SDK E2E Integration",
                        text: "Through the use of the new cofhe-contracts plugin, developers bind cryptographic sealing directly to Web UI click events for zero friction."
                      }
                    ].map((item) => (
                      <GlassCard key={item.title} className="p-6 border-white/5 bg-[#0a0a0a] rounded-3xl">
                        <item.icon className="w-6 h-6 text-cyan-300 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                        <p className="text-sm text-[#a1a1aa] leading-relaxed">{item.text}</p>
                      </GlassCard>
                    ))}
                  </div>
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
                        <h3 className="text-white font-bold text-lg mb-3">Client-Side WASM Decryption (cofhejs)</h3>
                        <p className="text-[#c9c9d0] mb-4">
                          Previous attempts at confidentially processing zero-knowledge functions suffered severely because off-chain proxies routed decrypted outputs. CipherRoll utilizes standard `ethers.js` connected to an internal WebAssembly worker `cofhejs.initializeWithEthers(...)`. 
                        </p>
                        <p className="text-[#c9c9d0]">
                          Our frontend prompts the wallet to uniquely sign an `EIP-712` view permit. The encrypted handle is downloaded and fully unsealed directly inside your browser cache.
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:col-span-2">
                        <h3 className="text-white font-bold text-lg mb-3">Treasury Component Bridge</h3>
                        <p className="text-[#c9c9d0] mb-4">
                          CipherRoll constructs robust adapter boundaries mapped via explicit on-chain route identifiers. This allows the payroll logic to remain agnostic of the underlying settlement token or bridge provider. 
                        </p>
                        <p className="text-[#c9c9d0]">
                          In our latest iteration, the `Wave1TreasuryAdapter` (0x01AE...b7D7) serves as the secure interface for eventual Privara-based stablecoin liquidations, ensuring that even as funds move to L2s, the entitlement records remain homomorphically protected.
                        </p>
                      </div>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-10 border-white/5 bg-[#0a0a0a] rounded-3xl">
                    <h3 className="text-2xl font-bold text-white mb-4">Current Network Parameters</h3>
                    <div className="space-y-4 text-sm">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/55 font-bold mb-2">Sepolia Hub Address</p>
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
                             <p className="leading-relaxed">{`Access to encrypted state is protected by cryptographically secure permits. Unlike public blockchains where 'anyone can read', our FHE variables require a signature that is verified inside the `}<span className="font-bold text-white">Fhenix TaskManager</span>. This prevents metadata leakage and unauthorized handle scraping via open RPCs.</p>
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
                      The buildathon submission is Wave 1. This timeline shows what is live now, what we will harden in Wave 2, and where CipherRoll grows into a broader payroll and treasury product in Wave 3.
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
                              {phase.milestones.map((milestone) => (
                                <div key={milestone} className="rounded-2xl border border-white/10 bg-white/5 p-3.5 text-sm text-[#d0d0d6] leading-relaxed">
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
ETHEREUM_SEPOLIA_RPC_URL=your_rpc_here
DEPLOYER_PRIVATE_KEY=your_key_here
# Frontend needs these to handle encryption/unsealing:
NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS=0x8227...
NEXT_PUBLIC_FHENIX_ENVIRONMENT=TESTNET</pre>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/55 font-bold mb-3">3. Deploy and run</p>
                        <pre className="overflow-x-auto text-white font-mono text-xs">npm run compile
npm run deploy:sepolia
cd web && npm run dev</pre>
                      </div>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-10 border-white/5 bg-[#0a0a0a] rounded-3xl">
                    <h3 className="text-2xl font-bold text-white mb-4">Platform Demonstration Path</h3>
                    <div className="grid gap-3 text-sm">
                      {[
                        "Provision the organization configuration in /admin.",
                        "Initialize the secure treasury adapter boundary.",
                        "Fund the encrypted budget vault.",
                        "Allocate one confidential payroll issuance.",
                        "Authenticate the employee wallet and execute native permits.",
                        "Refresh /employee to reliably verify accurate, homomorphically unsealed values."
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
