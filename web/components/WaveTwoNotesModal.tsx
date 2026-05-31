'use client';

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Eye,
  FileCheck2,
  Lock,
  ShieldCheck,
  Wallet
} from "lucide-react";

const STORAGE_KEY = "cipherroll-submission-notes-dismissed";

const notes = [
  {
    id: "01",
    eyebrow: "Product",
    badge: "Wave 5",
    title: "Full-stack confidential payroll from workspace creation to employee payout",
    body:
      "CipherRoll ships encrypted on-chain payroll state, real treasury-backed settlement, M-of-N governed execution, browser-local batch payroll, aggregate-only audit review with verifiable receipts, Tier A compliance exports, backend-assisted reporting, and an in-product copilot. This is the final verified build on the current roadmap.",
    icon: Wallet,
    accent: "from-emerald-300/18 via-emerald-300/8 to-transparent"
  },
  {
    id: "02",
    eyebrow: "Governance",
    badge: "M-of-N",
    title: "Sensitive actions require multi-admin approval without blocking operations",
    body:
      "Payroll issuance, vesting issuance, treasury route changes, governance membership, and quorum updates route through M-of-N governance proposals. Operational actions like creating runs, funding runs, reserving treasury funds, and activating claims remain single-admin so the day-to-day workflow stays frictionless.",
    icon: ShieldCheck,
    accent: "from-cyan-300/18 via-cyan-300/8 to-transparent"
  },
  {
    id: "03",
    eyebrow: "Batch Payroll",
    badge: "Sealed",
    title: "Browser-local batch authoring with sealed salaries and retryable submission",
    body:
      "Import CSV rows locally, validate employee addresses and role assignments, review before encryption, then seal salaries in the browser using CoFHE. Each row submits as one explicit wallet transaction. Backend manifests store org id, run id, employee address, role, and tx hash\u2014never salary amounts. Governed workspaces see a warning and cannot seal batch rows.",
    icon: Lock,
    accent: "from-white/14 via-white/5 to-transparent"
  },
  {
    id: "04",
    eyebrow: "Treasury",
    badge: "Exposure",
    title: "Route health, payout backlog, and reserve posture without salary disclosure",
    body:
      "The backend and admin portal surface route health, available and reserved treasury inventory, payout backlog, funded and active run exposure, and adapter-pinned wrapper finalization safety. Wrapper settlement requests are pinned to the adapter that created them so route changes cannot silently finalize against a different path. These are operational signals, not plaintext salary reports.",
    icon: Eye,
    accent: "from-violet-300/18 via-violet-300/8 to-transparent"
  },
  {
    id: "05",
    eyebrow: "Compliance",
    badge: "Tier A",
    title: "Aggregate compliance packages with reserve policy and receipt evidence",
    body:
      "The compliance route produces aggregate-first packages with an explicit tax reserve basis-point policy, treasury posture summary, and receipt metadata, exportable as JSON or CSV. This is not a tax filing, not an external authority integration, and not an employee salary export. Regulator-facing review remains aggregate-first.",
    icon: FileCheck2,
    accent: "from-amber-300/18 via-amber-300/8 to-transparent"
  }
];

export default function WaveTwoNotesModal() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY) === "true";
      setOpen(!dismissed);
    } catch {
      setOpen(true);
    }
  }, []);

  const currentMonthLabel = useMemo(() => "JUN 2026", []);

  if (!mounted) return null;

  const remindLater = () => setOpen(false);

  const dismissForever = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // no-op if storage is unavailable
    }
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/76 px-4 py-10 md:py-12"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="relative mt-16 flex max-h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[#070707] shadow-[0_24px_120px_rgba(0,0,0,0.62)] md:mt-20"
          >
            <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:28px_28px]" />

            <div className="relative flex-1 overflow-y-auto px-5 pb-8 pt-6 md:px-8 md:pb-10 md:pt-7">
              <div className="mb-6 flex flex-wrap items-center gap-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/34 md:mb-8">
                <span className="rounded-full border border-[#d6af79]/28 bg-[#d6af79]/10 px-4 py-1.5 text-[#d6af79]">
                  Wave 5
                </span>
                <span>{currentMonthLabel}</span>
                <span>Final Submission</span>
              </div>

              <div className="mb-4 md:mb-5">
                <div className="bg-gradient-to-r from-white via-zinc-300 to-white/75 bg-clip-text text-[38px] font-semibold italic tracking-[-0.05em] text-transparent md:text-[50px]">
                  CipherRoll
                </div>
                <div className="mt-1 text-[20px] font-medium tracking-[-0.04em] text-white/46 md:text-[30px]">
                  Final Submission
                </div>
              </div>

              <p className="mb-6 max-w-3xl text-[13px] leading-[1.8] text-white/36 md:mb-7 md:text-[14px]">
                The items below represent the Wave 5 scope only. Earlier waves established the encrypted payroll core, real settlement paths, auditor selective disclosure, submission hardening, and the backend platform layer. See the docs roadmap for the full progression.
              </p>

              <div className="space-y-4 md:space-y-5">
                {notes.map((note) => {
                  const Icon = note.icon;

                  return (
                    <div
                      key={note.id}
                      className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#0c0c0c] p-4 md:p-5"
                    >
                      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${note.accent}`} />

                      <div className="relative flex gap-4 md:gap-5">
                        <div className="hidden w-12 shrink-0 flex-col items-center md:flex">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                            <Icon className="h-5 w-5 text-white/88" />
                          </div>
                          <div className="mt-2 text-[10px] font-semibold tracking-[0.22em] text-white/26">
                            {note.id}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] md:hidden">
                              <Icon className="h-4.5 w-4.5 text-white/88" />
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/34">
                              {note.eyebrow}
                            </span>
                            <span className="rounded-full border border-[#d6af79]/24 bg-[#d6af79]/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#d6af79]">
                              {note.badge}
                            </span>
                          </div>

                          <h3 className="max-w-3xl text-[18px] font-semibold tracking-[-0.03em] text-white md:text-[24px]">
                            {note.title}
                          </h3>
                          <p className="mt-3 max-w-3xl text-[13px] leading-[1.75] text-[#8f8f97] md:text-[14px]">
                            {note.body}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative flex items-center justify-between gap-4 border-t border-white/8 bg-[#060606] px-5 py-4 md:px-8">
              <button
                type="button"
                onClick={remindLater}
                className="text-[13px] font-medium text-white/38 transition-colors hover:text-white/62"
              >
                Remind me later
              </button>

              <button
                type="button"
                onClick={dismissForever}
                className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[#ff9d39] via-[#ff8c2a] to-[#ff9d39] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_40px_rgba(255,145,45,0.28)] transition-transform hover:scale-[1.01]"
              >
                <Check className="h-4 w-4" />
                Got it, don&apos;t show again
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
