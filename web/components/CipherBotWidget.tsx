'use client'

import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, MessageCircle, SendHorizonal, Sparkles, X } from 'lucide-react'
import {
  getCipherBotGreeting,
  getCipherBotStarterQuestions,
  type CipherBotAnswer,
  type CipherBotLiveContext,
  type CipherBotScope
} from '@/lib/cipherbot'

type CipherBotWidgetProps = {
  scope: CipherBotScope
  headline: string
  intro: string
  organizationId?: string
  liveContext?: Omit<CipherBotLiveContext, 'organizationId'>
}

type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  content: string
  citations?: CipherBotAnswer['citations']
  suggestions?: string[]
}

function makeMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function CipherBotWidget({
  scope,
  headline,
  intro,
  organizationId,
  liveContext
}: CipherBotWidgetProps) {
  const starterQuestions = useMemo(() => getCipherBotStarterQuestions(scope), [scope])
  const [isOpen, setIsOpen] = useState(scope === 'docs')
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null)
  const [hasStreamedText, setHasStreamedText] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeMessageId('assistant'),
      role: 'assistant',
      content: getCipherBotGreeting(scope),
      suggestions: starterQuestions
    }
  ])
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const showStarterQuestions = messages.length === 1 && !isThinking
  const starterPrompts = starterQuestions.slice(0, 4)

  function appendToAssistantMessage(messageId: string, chunk: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              content: `${message.content}${chunk}`
            }
          : message
      )
    )
  }

  function replaceAssistantMessage(messageId: string, content: string, suggestions?: string[]) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              content,
              suggestions
            }
          : message
      )
    )
  }

  async function submitQuestion(questionText: string) {
    const question = questionText.trim()
    if (!question || isThinking) return

    setMessages((current) => [
      ...current,
      {
        id: makeMessageId('user'),
        role: 'user',
        content: question
      }
    ])
    setInput('')
    setIsThinking(true)
    let assistantMessageId: string | null = null

    try {
      const nextAssistantMessageId = makeMessageId('assistant')
      assistantMessageId = nextAssistantMessageId
      setActiveAssistantId(nextAssistantMessageId)
      setHasStreamedText(false)
      setMessages((current) => [
        ...current,
        {
          id: nextAssistantMessageId,
          role: 'assistant',
          content: ''
        }
      ])

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scope,
          message: question,
          liveContext:
            organizationId || liveContext
              ? {
                  organizationId,
                  ...liveContext
                }
              : undefined
        })
      })

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(
          typeof payload.error === 'string'
            ? payload.error
            : 'CipherBot could not stream a response right now.'
        )
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        if (chunk) {
          setHasStreamedText(true)
          appendToAssistantMessage(assistantMessageId, chunk)
          requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({
              top: scrollRef.current.scrollHeight,
              behavior: 'smooth'
            })
          })
        }
      }

      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth'
        })
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CipherBot could not answer right now.'
      if (assistantMessageId) {
        replaceAssistantMessage(
          assistantMessageId,
          `I could not load the full product answer right now.\n\nPlease try that question again in a moment.\n\nError detail: ${message}`,
          starterQuestions
        )
      }
    } finally {
      setIsThinking(false)
      setActiveAssistantId(null)
      setHasStreamedText(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="fixed bottom-4 right-4 z-[1100] flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/12 bg-white text-black shadow-[0_12px_28px_rgba(255,255,255,0.08)] transition-transform hover:scale-[1.02] md:bottom-5 md:right-5"
        aria-label={isOpen ? 'Close CipherBot' : 'Open CipherBot'}
      >
        <MessageCircle className="h-[18px] w-[18px]" />
      </button>

      {isOpen ? (
        <div className="fixed bottom-[4.1rem] right-3 z-[1090] w-[min(calc(100vw-1.5rem),23rem)] overflow-hidden rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,#07070c_0%,#05050a_100%)] shadow-[0_24px_60px_rgba(0,0,0,0.55)] md:bottom-[4.5rem] md:right-5">
          <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="rounded-[18px] border border-white/12 bg-white p-2.5 text-black shadow-[0_10px_24px_rgba(255,255,255,0.08)]">
                <Bot className="h-[18px] w-[18px]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[1.05rem] font-bold tracking-tight text-white">CipherBot</h2>
                  <Sparkles className="h-3.5 w-3.5 text-white/65" />
                </div>
                <p className="mt-1 max-w-[250px] text-[12px] leading-5 text-white/58">{headline}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-2 text-white/55 transition-colors hover:bg-white/8 hover:text-white"
              aria-label="Close CipherBot"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex h-[min(30rem,calc(100vh-6.5rem))] flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                {showStarterQuestions ? (
                  <motion.div
                    key="starter"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
                    className="h-full overflow-y-auto overscroll-contain px-5 py-4"
                  >
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.05] px-4 py-3.5 text-[13px] leading-6 text-white/78">
                      {intro}
                    </div>
                    <p className="mb-3 mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                      Suggested Actions
                    </p>
                    <div className="grid gap-2 grid-cols-2">
                      {starterPrompts.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => void submitQuestion(suggestion)}
                          className="min-h-[4.5rem] rounded-[18px] border border-white/10 bg-white/[0.04] px-3.5 py-3 text-left text-[12px] font-semibold leading-5 text-white/88 transition hover:bg-white/[0.08]"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="conversation"
                    ref={scrollRef}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="h-full overflow-y-auto overscroll-contain px-5 py-4 space-y-4"
                  >
                    {messages.map((message) => {
                      const hidePendingAssistantBubble =
                        message.id === activeAssistantId &&
                        message.role === 'assistant' &&
                        !message.content &&
                        isThinking &&
                        !hasStreamedText

                      if (hidePendingAssistantBubble) {
                        return null
                      }

                      return (
                        <div
                          key={message.id}
                          className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
                        >
                          <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                            {message.role === 'user' ? 'You' : 'CipherBot'}
                          </p>
                          <div
                            className={`max-w-[90%] rounded-[22px] px-4 py-3.5 text-[14px] leading-7 ${
                              message.role === 'user'
                                ? 'rounded-br-sm bg-white text-black shadow-[0_8px_20px_rgba(255,255,255,0.05)]'
                                : 'rounded-bl-sm border border-white/10 bg-white/[0.05] text-white/86'
                            }`}
                          >
                            <div className="whitespace-pre-wrap">{message.content || '\u00A0'}</div>
                            {message.citations?.length ? (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {message.citations.map((citation) => (
                                  <span
                                    key={citation.id}
                                    className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/45"
                                  >
                                    {citation.sourceLabel}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}

                    {isThinking && !hasStreamedText ? (
                      <div className="flex flex-col items-start">
                        <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                          CipherBot
                        </p>
                        <div className="flex items-center gap-1.5 rounded-[22px] rounded-bl-sm border border-white/10 bg-white/[0.05] px-4 py-3.5 text-[13px] text-white/72">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/55 [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/55 [animation-delay:160ms]" />
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/55 [animation-delay:320ms]" />
                        </div>
                      </div>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="border-t border-white/10 px-5 py-4">
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void submitQuestion(input)
                }}
              >
                <div className="flex items-center gap-2 rounded-[20px] border border-white/10 bg-[#0c0c12] px-3.5 py-3 focus-within:border-white/20">
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask a product question about CipherRoll..."
                    className="flex-1 bg-transparent text-[14px] text-white placeholder:text-white/32 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isThinking}
                    className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white/85 text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Send message"
                  >
                    <SendHorizonal className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
