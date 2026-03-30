'use client';

import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";
import GlassCard from "./GlassCard";
import NetworkStatus from "./NetworkStatus";

export default function CipherRollComingSoon({
  badge,
  title,
  description,
  wave,
  focus
}: {
  badge: string;
  title: string;
  description: string;
  wave: string;
  focus: string[];
}) {
  return (
    <main className="min-h-screen relative z-10 font-sans text-gray-100 bg-black selection:bg-white/20 pt-32">
      <div
        className="fixed inset-0 z-0 bg-[length:800px] md:bg-[length:1800px] bg-left bg-no-repeat bg-fixed opacity-40"
        style={{ backgroundImage: "url('/assets/milad-fakurian-7W3X1dAuKqg-unsplash.jpg')" }}
      />
      <div className="fixed inset-0 z-0 bg-black/60 backdrop-blur-[2px]" />

      <div className="w-full max-w-6xl mx-auto px-6 pb-20 relative z-10">
        <div className="mb-12 border-b border-white/5 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 text-cyan-300 text-xs font-bold tracking-widest uppercase mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            {badge}
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-2">
            {title}
          </h1>
          <p className="text-[#a1a1aa] text-lg max-w-3xl">{description}</p>
        </div>

        <NetworkStatus />

        <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-8">
          <GlassCard className="p-8 bg-[#0a0a0a] border-white/5 rounded-3xl">
            <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.22em] text-white/60 mb-6">
              <CalendarDays className="w-4 h-4" />
              {wave}
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Planned scope</h2>
            <div className="space-y-4">
              {focus.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <ArrowRight className="w-4 h-4 mt-1 text-cyan-300 shrink-0" />
                  <p className="text-sm text-[#c9c9d0] leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-8 bg-[#0a0a0a] border-white/5 rounded-3xl">
            <h2 className="text-2xl font-bold text-white mb-4">Wave 1 status</h2>
            <p className="text-[#a1a1aa] leading-relaxed mb-6">
              CipherRoll Wave 1 prioritizes confidential budget management,
              single-admin payroll issuance, employee permit-based reads, and a
              buildathon-ready documentation experience. This portal is being
              staged for a later wave so the MVP stays focused and credible.
            </p>
            <div className="grid gap-3">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-200 font-bold mb-2">
                  Live now
                </p>
                <p className="text-sm text-emerald-50">
                  Admin and employee confidential payroll flow, EVM wallet
                  connection, and Wave 1 docs.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/70 font-bold mb-2">
                  Next up
                </p>
                <p className="text-sm text-[#d9d9de]">
                  Selective disclosure, multi-admin approvals, and treasury
                  settlement expansion.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </main>
  );
}
