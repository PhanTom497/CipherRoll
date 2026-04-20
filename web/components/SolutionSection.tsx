'use client';

import { Coins, Eye, FileCheck2, KeyRound, Lock, Shield, Wallet } from "lucide-react";
import { TARGET_CHAIN_NAME } from "@/lib/cipherroll-config";

const solutionBodyTone = "text-[#8f8f97]";

function FeatureCard({
  icon: Icon,
  title,
  desc,
  accentLine,
  glow,
  className = ""
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  accentLine: string;
  glow: string;
  className?: string;
}) {
  return (
    <div className={`relative group ${className}`}>
      <div className={`absolute -inset-[1px] rounded-[28px] opacity-100 blur-sm ${glow}`} />
      <div className="relative h-full rounded-[28px] border border-white/10 bg-[#090909]/84 p-7 backdrop-blur-sm overflow-hidden">
        <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${accentLine} to-transparent`} />
        <div className="mb-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
          <Icon className="h-6 w-6 text-white/85" />
        </div>
        <h3 className="mb-3 text-[22px] font-semibold tracking-[-0.03em] text-white">{title}</h3>
        <p className={`max-w-[32rem] text-[14px] leading-[1.75] ${solutionBodyTone}`}>{desc}</p>
      </div>
    </div>
  );
}

const solutionCards = [
  {
    icon: Wallet,
    title: "Treasury-Backed Settlement",
    desc:
      "CipherRoll no longer stops at encrypted bookkeeping. Payroll runs can reserve real treasury inventory and settle into a live payout path instead of ending as contract-local metadata.",
    accentLine: "via-emerald-300/45",
    glow: "bg-emerald-500/10"
  },
  {
    icon: Lock,
    title: "Local Salary Decrypts",
    desc:
      "Employees decrypt their own payroll data in the browser after signing a permit. Salary plaintext does not need to pass through the app server or the host chain.",
    accentLine: "via-cyan-300/45",
    glow: "bg-cyan-500/10"
  },
  {
    icon: Eye,
    title: "Aggregate-Only Audit Review",
    desc:
      "Auditors import a recipient permit and review shared organization summaries like budget, commitments, runway, and treasury status without unlocking employee salary rows.",
    accentLine: "via-violet-300/45",
    glow: "bg-violet-500/10"
  },
  {
    icon: FileCheck2,
    title: "Provable Audit Receipts",
    desc:
      "When view-only review is not enough, CipherRoll can turn selected aggregate disclosures into verifiable or published on-chain audit receipts for defensible evidence.",
    accentLine: "via-amber-300/45",
    glow: "bg-amber-500/10"
  }
];

export default function SolutionSection() {
  return (
    <section className="relative overflow-hidden bg-black px-6 py-28 md:px-12 lg:px-24">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 h-[42vh] w-[88vw] -translate-x-1/2 rounded-full bg-white/[0.02] blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.02] [background-image:radial-gradient(#ffffff_0.7px,transparent_0.7px)] [background-size:14px_14px]" />
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none overflow-hidden">
        <span className="whitespace-nowrap text-[22vw] font-black tracking-tighter leading-none text-white/[0.015]">
          CIPHERROLL
        </span>
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-20 text-center">
          <div className="mb-7 flex justify-center">
            <div className="inline-flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/40">
              <span className="h-px w-10 bg-white/15" />
              The Solution
              <span className="h-px w-10 bg-white/15" />
            </div>
          </div>

          <div className="relative mx-auto inline-block max-w-full overflow-visible px-3 md:px-5">
            <h2 className="text-[32px] font-semibold leading-[1.08] tracking-[-0.04em] text-white md:text-[44px] lg:text-[56px]">
              What is{" "}
              <span className="inline-block bg-gradient-to-r from-white via-zinc-300 to-white/70 bg-clip-text pr-1 text-transparent italic md:pr-1.5">
                CipherRoll
              </span>
              <span className="inline-block bg-gradient-to-r from-white via-zinc-300 to-white/70 bg-clip-text pr-1 text-transparent italic md:pr-1.5">
                ?
              </span>
            </h2>
            <svg
              aria-hidden="true"
              viewBox="0 0 320 38"
              className="pointer-events-none absolute -bottom-5 right-2 h-6 w-[220px] opacity-80 md:right-3 md:w-[260px]"
            >
              <path
                d="M6 24 C62 8, 122 8, 178 20 S270 30, 314 14"
                fill="none"
                stroke="rgba(255,255,255,0.36)"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <p className={`mx-auto mt-6 max-w-3xl text-[16px] leading-[1.85] md:text-[19px] ${solutionBodyTone}`}>
            CipherRoll is a confidential payroll system built on the official CoFHE stack for{" "}
            {TARGET_CHAIN_NAME}. It keeps payroll budgets, commitments, allocations, and audit summaries encrypted while still giving teams a real settlement path, employee self-claim flow, and compliance-safe disclosure surface.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
          <div className="relative group lg:col-span-4">
            <div className="absolute -inset-[1px] rounded-[28px] blur-sm bg-white/10" />
            <div className="relative h-full overflow-hidden rounded-[28px] border border-white/12 bg-[#090909]/84 p-8 md:p-10 backdrop-blur-sm">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/[0.04] blur-3xl" />
            <div className="flex flex-col gap-8 md:flex-row md:items-start">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-white/12 bg-white/[0.04]">
                <Shield className="h-7 w-7 text-white/90" />
              </div>
                <div>
                  <h3 className="mb-4 text-[26px] font-semibold tracking-[-0.03em] text-white md:text-[30px]">
                    FHE-native payroll operations, not public salary rails
                  </h3>
                  <p className={`max-w-3xl text-[15px] leading-[1.85] md:text-[16px] ${solutionBodyTone}`}>
                    Admins create workspaces, fund encrypted budget state, define explicit payroll runs,
                    upload confidential allocations, reserve treasury funds, activate claims, and let employees
                    complete payout from their own wallet. On {TARGET_CHAIN_NAME}, the contract performs arithmetic
                    over ciphertext handles while the sensitive integers stay hidden from host operators.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <FeatureCard
            icon={Coins}
            title="FHERC20 Wrapper Payouts"
            desc="CipherRoll’s preferred settlement path uses a treasury-backed FHERC20 wrapper route so payroll can remain confidential through request, finalize, and payout instead of falling back to plain transfers too early."
            accentLine="via-white/35"
            glow="bg-white/6"
            className="lg:col-span-2"
          />

          {solutionCards.map((card) => (
            <FeatureCard
              key={card.title}
              icon={card.icon}
              title={card.title}
              desc={card.desc}
              accentLine={card.accentLine}
              glow={card.glow}
              className="lg:col-span-3"
            />
          ))}

          <div className="relative group lg:col-span-6">
            <div className="absolute -inset-[1px] rounded-[28px] blur-sm bg-cyan-500/8" />
            <div className="relative overflow-hidden rounded-[28px] border border-cyan-400/12 bg-[#090909]/84 p-8 md:p-10 backdrop-blur-sm">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />
              <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-cyan-300/16 bg-cyan-300/6">
                    <KeyRound className="h-7 w-7 text-cyan-200" />
                  </div>
                  <div>
                    <h3 className="mb-4 text-[24px] font-semibold tracking-[-0.03em] text-white md:text-[30px]">
                      Private by default, selective by design
                    </h3>
                    <p className={`max-w-3xl text-[15px] leading-[1.82] ${solutionBodyTone}`}>
                      CipherRoll does not promise a fake “everything is hidden” story. Salary amounts, budget summaries,
                      runway, and aggregate disclosures stay encrypted. Wallet addresses, workflow states, deadlines,
                      and settlement transactions remain public. When teams need audit evidence, CipherRoll upgrades
                      shared aggregate values from simple viewing into verifiable receipts without exposing employee-level payroll history.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:w-[320px]">
                  {[
                    { label: "Encrypted state", value: "Budget + payroll handles" },
                    { label: "Claim flow", value: "Employee wallet finalizes" },
                    { label: "Audit path", value: "Permit-based summaries" },
                    { label: "Evidence", value: "Verify / publish receipts" }
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-white/34">{item.label}</div>
                      <div className={`mt-2 text-[13px] leading-[1.5] ${solutionBodyTone}`}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
