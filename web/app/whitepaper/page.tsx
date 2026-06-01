import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, Eye, FileText, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'CipherRoll Whitepaper',
  description: 'Technical whitepaper for CipherRoll confidential payroll infrastructure.',
}

const highlights = [
  'Confidential payroll architecture built on Fhenix CoFHE.',
  'Clear privacy boundary, governance model, and settlement design.',
  'A single technical narrative for evaluators, partners, and infrastructure reviewers.',
]

export default function WhitepaperPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-6 pb-24 pt-28 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.12),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_22%)]" />

      <div className="relative mx-auto max-w-6xl">
        <section className="border-b border-white/10 pb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">
            <ShieldCheck className="h-3.5 w-3.5 text-cyan-200" />
            CipherRoll Whitepaper
          </div>

          <div className="mt-8 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-[42px] font-semibold tracking-[-0.04em] text-white md:text-[58px] lg:text-[72px] leading-[0.96]">
                Technical context for private payroll on public rails.
              </h1>

              <p className="mt-6 max-w-2xl text-[17px] leading-[1.9] text-[#b4b4bc]">
                The whitepaper presents CipherRoll as a serious infrastructure system: encrypted
                payroll state, governed execution, treasury-backed settlement, and audit-ready
                reporting, documented in one clean technical narrative.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link href="/whitepaper/live" className="inline-flex items-center gap-3 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-white/90">
                  Preview Whitepaper
                  <span className="rounded-full bg-black p-2 text-white">
                    <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.5]" />
                  </span>
                </Link>

                <Link href="/whitepaper/index.html" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.05]">
                  <FileText className="h-4 w-4" />
                  Open HTML
                </Link>

              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(12,12,12,0.95),rgba(17,25,29,0.82))] p-7 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
                Scope
              </p>
              <div className="mt-5 space-y-3">
                {highlights.map((item) => (
                  <div key={item} className="rounded-2xl border border-white/8 bg-black/30 px-4 py-4 text-sm leading-7 text-[#d4d4d8]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 py-12 md:grid-cols-3">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              Architecture
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
              System design
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#a1a1aa]">
              Review the encrypted state model, role-separated portals, settlement routes, and
              backend reporting surface as one integrated stack.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              Privacy
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
              Honest boundaries
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#a1a1aa]">
              The paper explains what remains encrypted, what stays observable on EVM rails, and
              how CipherRoll frames privacy without overclaiming.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              Review
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
              Evaluation flow
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#a1a1aa]">
              Read the paper first for the full system narrative, then move into product docs and
              live portals for implementation-level verification.
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#080808] p-8 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                Reading Options
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Choose the format that fits the review.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#a1a1aa] md:text-base">
                Use the embedded preview for quick evaluation, open the standalone HTML for a
                distraction-free reading experience, and keep the review flow consistent across the product surface.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/whitepaper/live" className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.05]">
                <Eye className="h-4 w-4" />
                Preview
              </Link>
              <Link href="/whitepaper/index.html" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.05]">
                <FileText className="h-4 w-4" />
                HTML
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
