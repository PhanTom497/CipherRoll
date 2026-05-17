import { NextResponse } from 'next/server'
import { getRelevantCipherBotDocChunks } from '@/lib/server/cipherbot-docs'

type ChatBody = {
  message?: string
  scope?: 'docs' | 'admin' | 'auditor' | 'employee'
  liveContext?: Record<string, unknown>
}

function makeFallbackAnswer(message: string, scope: string, liveContext?: Record<string, unknown>) {
  const chunks = getRelevantCipherBotDocChunks(message, 3)

  if (chunks.length === 0) {
    return [
      `CipherBot is running in fallback mode for the ${scope} surface.`,
      'I could not find a closely matching answer in the local CipherRoll documentation.',
      'Try asking with terms like workspace, payroll run, claim, wrapper finalization, auditor permit, or backend export.',
    ].join(' ')
  }

  const top = chunks[0]
  const supporting = chunks.slice(1).map((chunk) => chunk.title)
  const supportLine =
    supporting.length > 0
      ? `Related sections: ${supporting.join(', ')}.`
      : 'This answer comes from the closest matching local docs section.'
  const liveContextLine = liveContext
    ? 'Live portal context was provided and should be used together with the linked workflow.'
    : ''

  return [
    `CipherBot is running in fallback mode for the ${scope} surface.`,
    `Best match: ${top.title} from ${top.source}.`,
    top.content.replace(/\s+/g, ' ').slice(0, 420),
    supportLine,
    liveContextLine,
  ]
    .filter(Boolean)
    .join(' ')
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

function getGeminiModelCandidates() {
  const configured = (process.env.GOOGLE_GEMINI_MODELS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  const primary = (process.env.GOOGLE_GEMINI_MODEL || 'gemini-2.5-flash').trim()
  const defaults = ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']

  return Array.from(new Set([primary, ...configured, ...defaults].filter(Boolean)))
}

function isRetryableGeminiError(response: Response, payload: Record<string, unknown>) {
  const statusCode = response.status || Number(payload?.error) || 0
  const errorPayload =
    typeof payload.error === 'object' && payload.error != null
      ? (payload.error as Record<string, unknown>)
      : {}
  const statusText = String(errorPayload.status || '').toUpperCase()
  const message = String(errorPayload.message || '').toLowerCase()

  if (statusCode === 408 || statusCode === 429 || statusCode === 500 || statusCode === 503) {
    return true
  }
  if (
    statusText === 'RESOURCE_EXHAUSTED' ||
    statusText === 'UNAVAILABLE' ||
    statusText === 'DEADLINE_EXCEEDED'
  ) {
    return true
  }

  return (
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('retry in') ||
    message.includes('resource exhausted') ||
    message.includes('deadline') ||
    message.includes('timed out') ||
    message.includes('model not found') ||
    message.includes('not found')
  )
}

async function requestGeminiReply(apiKey: string, prompt: string) {
  const models = getGeminiModelCandidates()
  const systemInstruction = [
    'You are CipherBot.',
    'You are a technical operator assistant for the Fhenix EVM payroll system, CipherRoll.',
    'Answer only from the provided CipherRoll markdown documentation and live portal context.',
    'Do not invent features, flows, or product behavior.',
    'Refuse to write code.',
    'Refuse general trivia or unrelated questions.',
    'If the answer is not supported by the provided docs, say you can only answer from current CipherRoll documentation.',
    'Use simple language.',
    'Keep answers short, practical, and operator-friendly.',
    'Prefer 2 to 4 short sentences over long paragraphs.',
  ].join(' ')

  const errors: string[] = []

  for (const model of models) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 220,
            },
          }),
          signal: controller.signal,
        }
      )

      const payload = (await response.json()) as Record<string, unknown>

      if (response.ok) {
        const candidates = Array.isArray(payload.candidates)
          ? (payload.candidates as Array<Record<string, unknown>>)
          : []
        const text = candidates
          .flatMap((candidate) => {
            const content =
              typeof candidate.content === 'object' && candidate.content != null
                ? (candidate.content as Record<string, unknown>)
                : {}
            return Array.isArray(content.parts)
              ? (content.parts as Array<Record<string, unknown>>)
              : []
          })
          .map((part) => String(part.text || ''))
          .join('\n')
          .trim()

        if (text) {
          return text
        }

        errors.push(`${model}: empty response`)
        continue
      }

      const errorPayload =
        typeof payload.error === 'object' && payload.error != null
          ? (payload.error as Record<string, unknown>)
          : {}
      const errorMessage = String(
        errorPayload.message || errorPayload.status || `Gemini request failed for ${model}.`
      )
      errors.push(`${model}: ${errorMessage}`)

      if (!isRetryableGeminiError(response, payload)) {
        return null
      }
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? 'request timed out'
          : error instanceof Error
            ? error.message
            : 'unknown request error'
      errors.push(`${model}: ${message}`)
    } finally {
      clearTimeout(timeout)
    }
  }

  console.error('[cipherbot] Gemini fallback triggered:', errors.join(' | '))
  return null
}

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const body = (await request.json()) as ChatBody
  const message = body.message?.trim()
  const scope = body.scope || 'docs'

  if (!message) {
    return NextResponse.json({ error: 'Missing chat message.' }, { status: 400 })
  }

  if (!apiKey) {
    const fallback = makeFallbackAnswer(message, scope, body.liveContext)
    return new Response(fallback, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  }

  const { prompt } = makePrompt(message, scope, body.liveContext)
  const geminiReply = await requestGeminiReply(apiKey, prompt)
  const answer = geminiReply || makeFallbackAnswer(message, scope, body.liveContext)

  return new Response(answer, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
