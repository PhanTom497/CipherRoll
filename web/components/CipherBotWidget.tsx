'use client'

import { useMemo, useState } from 'react'
import { Bot, Sparkles, X } from 'lucide-react'
import {
  type CipherBotKnowledgeEntry,
  type CipherBotScope,
  getCipherBotEntries
} from '@/lib/cipherbot'

type CipherBotWidgetProps = {
  scope: CipherBotScope
  headline: string
  intro: string
}

export default function CipherBotWidget({
  scope,
  headline,
  intro
}: CipherBotWidgetProps) {
  const entries = useMemo(() => getCipherBotEntries(scope), [scope])
  const [isOpen, setIsOpen] = useState(scope === 'docs')
  const [activeEntryId, setActiveEntryId] = useState(entries[0]?.id ?? '')

  const activeEntry =
    entries.find((entry) => entry.id === activeEntryId) ??
    entries[0] ??
    (null as CipherBotKnowledgeEntry | null)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="fixed bottom-5 right-5 z-[1100] flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/15 bg-white text-black shadow-[0_18px_48px_rgba(255,255,255,0.12)] transition-transform hover:scale-[1.02] md:bottom-6 md:right-6 md:h-[68px] md:w-[68px]"
        aria-label={isOpen ? 'Close CipherBot' : 'Open CipherBot'}
      >
        <Bot className="h-7 w-7" />
      </button>

      {isOpen ? (
        <div className="fixed bottom-24 right-4 z-[1090] w-[calc(100vw-1.5rem)] max-w-[380px] overflow-hidden rounded-[28px] border border-white/10 bg-[#09090f] shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl md:bottom-28 md:right-6 md:w-[380px]">
          <div className="flex items-start justify-between border-b border-white/10 px-4 py-4 md:px-5">
            <div className="flex items-start gap-3">
              <div className="rounded-[18px] border border-white/12 bg-white/95 p-3 text-black shadow-[0_10px_28px_rgba(255,255,255,0.12)]">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">CipherBot</h2>
                  <Sparkles className="h-3.5 w-3.5 text-white/75" />
                </div>
                <p className="mt-1 max-w-[230px] text-sm leading-6 text-white/60">{headline}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-2 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close CipherBot"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[min(68vh,700px)] overflow-y-auto">
            <div className="border-b border-white/10 px-4 py-4 md:px-5">
              <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-white/82">
                {intro}
              </div>
            </div>

            {activeEntry ? (
              <div className="border-b border-white/10 px-4 py-5 md:px-5">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">
                  Selected Answer
                </p>
                <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 text-white/86">
                  <h3 className="text-lg font-semibold leading-8 text-white">{activeEntry.question}</h3>
                  <p className="mt-3 text-sm leading-7">{activeEntry.body}</p>
                  <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">
                    {activeEntry.sourceLabel}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="px-4 py-5 md:px-5">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">
                Suggested Actions
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {entries.map((entry) => {
                  const isActive = entry.id === activeEntry?.id
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setActiveEntryId(entry.id)}
                      className={`rounded-[24px] border px-4 py-4 text-left text-base font-semibold leading-7 transition ${
                        isActive
                          ? 'border-white bg-white/10 text-white'
                          : 'border-white/10 bg-white/5 text-white/85 hover:bg-white/10'
                      }`}
                    >
                      {entry.question}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
