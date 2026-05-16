import { google } from '@ai-sdk/google'
import { streamText } from 'ai'
import { NextResponse } from 'next/server'
import { getRelevantCipherBotDocChunks } from '@/lib/server/cipherbot-docs'

type ChatBody = {
  message?: string
  scope?: 'docs' | 'admin' | 'auditor' | 'employee'
  liveContext?: Record<string, unknown>
}

function makePrompt(message: string, scope: string, liveContext?: Record<string, unknown>) {
  const chunks = getRelevantCipherBotDocChunks(message, 6)
  const docsContext =
    chunks.length > 0
      ? chunks
          .map(
            (chunk, index) =>
              `Document ${index + 1}: ${chunk.source}\nSection: ${chunk.title}\n${chunk.content}`
          )
          .join('\n\n')
      : 'No directly relevant local documentation chunks were matched.'

  const contextBlock = liveContext
    ? `Live portal context:\n${JSON.stringify(liveContext, null, 2)}`
    : 'Live portal context: none'

  return {
    docsContext,
    prompt: [
      `Portal scope: ${scope}`,
      '',
      contextBlock,
      '',
      'Relevant local CipherRoll markdown documentation:',
      docsContext,
      '',
      `User question: ${message}`
    ].join('\n')
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'CipherBot AI mode is not configured. Add GOOGLE_API_KEY to local env.' },
      { status: 500 }
    )
  }

  const body = (await request.json()) as ChatBody
  const message = body.message?.trim()
  const scope = body.scope || 'docs'

  if (!message) {
    return NextResponse.json({ error: 'Missing chat message.' }, { status: 400 })
  }

  const { prompt } = makePrompt(message, scope, body.liveContext)

  const result = streamText({
    model: google(process.env.GOOGLE_GEMINI_MODEL || 'gemini-2.5-flash'),
    system: [
      'You are CipherBot.',
      'You are a technical operator assistant for the Fhenix EVM payroll system, CipherRoll.',
      'Answer only from the provided CipherRoll markdown documentation and live portal context.',
      'Do not invent features, flows, or product behavior.',
      'Refuse to write code.',
      'Refuse general trivia or unrelated questions.',
      'If the answer is not supported by the provided docs, say you can only answer from current CipherRoll documentation.',
      'Use simple language.',
      'Keep answers short, practical, and operator-friendly.',
      'Prefer 2 to 4 short sentences over long paragraphs.'
    ].join(' '),
    prompt,
    temperature: 0.2
  })

  return result.toTextStreamResponse()
}
