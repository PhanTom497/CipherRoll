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
    eyebrow: "Platform",
    badge: "Wave 4",
    title: "CipherRoll now ships a real application layer on top of the confidential payroll core",
    body:
      "Wave 4 moved CipherRoll beyond a contracts-first demo into a fuller product stack. The live build now combines the confidential payroll flow with a backend service, indexed read models, support APIs, and richer operator surfaces instead of relying only on direct contract inspection.",
    icon: Wallet,
    accent: "from-emerald-300/18 via-emerald-300/8 to-transparent"
  },
  {
    id: "02",
    eyebrow: "Backend",
    badge: "Deployed",
    title: "Reporting, exports, notifications, and operational status now come from a live indexed backend",
    body:
      "Admins and auditors no longer need to piece together every state transition from raw chain activity. CipherRoll now serves health, status, organization summaries, run and payment views, recent workflow notifications, and export packages through backend APIs designed for the frontend portals.",
    icon: ShieldCheck,
    accent: "from-cyan-300/18 via-cyan-300/8 to-transparent"
  },
  {
    id: "03",
    eyebrow: "Infrastructure",
    badge: "Supabase",
    title: "The hosted stack now persists backend state through Supabase-backed Postgres instead of local-only storage",
    body:
      "CipherRoll now has a deployment path that matches the product surface you demo in the browser. Indexed events, summaries, and notifications can survive restarts through the hosted database layer, while the frontend continues to run separately on Vercel and query the backend over stable APIs.",
    icon: Lock,
    accent: "from-white/14 via-white/5 to-transparent"
  },
  {
    id: "04",
    eyebrow: "Shared SDK",
    badge: "Unified",
    title: "Frontend and backend now share one runtime and query layer instead of drifting across duplicated helpers",
    body:
      "Wave 4 introduced a reusable CipherRoll SDK for runtime config, backend clients, and shared product types. That keeps deployment values, route construction, and cross-surface product assumptions much more consistent across docs, frontend, and backend services.",
    icon: Eye,
    accent: "from-violet-300/18 via-violet-300/8 to-transparent"
  },
  {
    id: "05",
    eyebrow: "Support",
    badge: "Expanded",
    title: "CipherBot and the operator experience now sit inside a more complete product workflow",
    body:
      "CipherBot, docs, release notes, and operator guidance now work alongside the backend-assisted product flows rather than beside them. The result is a more coherent review experience for workspace setup, funding order, settlement troubleshooting, receipt review, and deployment understanding.",
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

  const currentMonthLabel = useMemo(() => "MAY 2026", []);

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
                  Wave 4
                </span>
                <span>{currentMonthLabel}</span>
                <span>Platform Update</span>
              </div>

              <div className="mb-7 md:mb-9">
                <div className="bg-gradient-to-r from-white via-zinc-300 to-white/75 bg-clip-text text-[38px] font-semibold italic tracking-[-0.05em] text-transparent md:text-[50px]">
                  CipherRoll
                </div>
                <div className="mt-1 text-[20px] font-medium tracking-[-0.04em] text-white/46 md:text-[30px]">
                  Wave 4 Platform Update
                </div>
              </div>

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
