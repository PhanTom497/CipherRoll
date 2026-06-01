import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Download, ExternalLink, FileText } from 'lucide-react'

export const metadata: Metadata = {
  title: 'CipherRoll Whitepaper Preview',
  description: 'Embedded preview shell for the CipherRoll whitepaper HTML export.',
}

export default function WhitepaperLivePage() {
  return (
    <main className="min-h-screen bg-black px-4 pb-6 pt-24 text-white md:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-4 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
              Whitepaper Preview
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Read the whitepaper in a focused browser view
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[#a1a1aa]">
              This page embeds the current HTML version of the CipherRoll whitepaper for direct
              review inside the product surface.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/whitepaper" className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.05]">
              <ArrowLeft className="h-4 w-4" />
              Overview
            </Link>
            <Link href="/whitepaper/index.html" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.05]">
              <ExternalLink className="h-4 w-4" />
              Open HTML
            </Link>
            <Link href="/whitepaper/whitepaper.pdf" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 px-4 py-2.5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/10">
              <Download className="h-4 w-4" />
              PDF
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#050505] shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4 text-sm text-white/60">
            <FileText className="h-4 w-4" />
            CipherRoll Whitepaper
          </div>

          <iframe
            title="CipherRoll whitepaper HTML preview"
            src="/whitepaper/index.html"
            className="h-[calc(100vh-14rem)] min-h-[720px] w-full bg-white"
          />
        </div>
      </div>
    </main>
  )
}
