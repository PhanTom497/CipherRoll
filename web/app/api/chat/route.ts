import { NextResponse } from 'next/server'
import { getRelevantCipherBotDocChunks } from '@/lib/server/cipherbot-docs'

type ChatBody = {
  message?: string
  scope?: 'docs' | 'admin' | 'auditor' | 'employee'
  liveContext?: Record<string, unknown>
}

function wantsDeploymentHelp(question: string) {
  const normalized = question.toLowerCase()
  return [
    'deploy',
    'deployment',
    'vercel',
    'render',
    'env',
    'environment',
    'google_api_key',
    'google api key',
    'gemini key',
    'api key',
    'backend url',
    'supabase',
  ].some((token) => normalized.includes(token))
}

function getScopedDocChunks(message: string, scope: string, limit: number) {
  const chunks = getRelevantCipherBotDocChunks(message, 10)
  const allowDeploymentDocs = scope === 'docs' || wantsDeploymentHelp(message)

  const filtered = chunks.filter((chunk) => {
    const source = chunk.source.toLowerCase()

    if (!allowDeploymentDocs && source.includes('deployment.md')) {
      return false
    }

    if (scope === 'admin') {
      return !source.includes('privacy_matrix.md') || chunk.title.toLowerCase().includes('admin')
    }

    if (scope === 'employee') {
      return !source.includes('deployment.md')
    }

    if (scope === 'auditor') {
      return !source.includes('deployment.md')
    }

    return true
  })

  return (filtered.length > 0 ? filtered : chunks).slice(0, limit)
}

function makeFallbackAnswer(message: string, scope: string, liveContext?: Record<string, unknown>) {
  const chunks = getScopedDocChunks(message, scope, 3)

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
  const normalizedTopContent = top.content.replace(/\s+/g, ' ').trim()
  const sentenceMatch = normalizedTopContent.match(/(.+?[.!?])(\s|$)/g)
  const summary =
    sentenceMatch && sentenceMatch.length > 0
      ? sentenceMatch.slice(0, 2).join(' ').trim()
      : normalizedTopContent.slice(0, 520).trim()

  return [
    `Based on the current CipherRoll ${scope} guidance, the closest match is ${top.title}.`,
    summary,
    supportLine,
    liveContextLine,
  ]
    .filter(Boolean)
    .join(' ')
}

function makePrompt(message: string, scope: string, liveContext?: Record<string, unknown>) {
  const chunks = getScopedDocChunks(message, scope, 6)
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
      `Answer depth target: ${getAnswerDepthHint(message)}`,
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

function estimateQuestionComplexity(message: string, scope: string) {
  const normalized = message.trim().toLowerCase()
  const wordCount = normalized.split(/\s+/).filter(Boolean).length
  let score = wordCount

  if (wordCount >= 12) score += 6
  if (wordCount >= 24) score += 8
  if (normalized.includes('how')) score += 3
  if (normalized.includes('actually')) score += 3
  if (normalized.includes('step by step')) score += 6
  if (normalized.includes('workflow')) score += 5
  if (normalized.includes('difference')) score += 4
  if (normalized.includes('why')) score += 4
  if (normalized.includes('explain')) score += 4
  if (normalized.includes('admin portal')) score += 4
  if (scope !== 'docs') score += 3

  return score
}

function getAnswerDepthHint(message: string) {
  const normalized = message.toLowerCase()
  if (
    normalized.includes('how') ||
    normalized.includes('actually') ||
    normalized.includes('workflow') ||
    normalized.includes('step by step') ||
    normalized.includes('explain') ||
    normalized.includes('process')
  ) {
    return 'Give a fuller practical answer with 6 to 10 sentences. Walk through the flow in order and name the key actions, not just the surface label.'
  }

  return 'Give a concise but complete answer with 3 to 5 sentences.'
}

function wantsStepByStepAnswer(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('step by step') ||
    normalized.includes('workflow') ||
    normalized.includes('process') ||
    normalized.includes('how do i') ||
    normalized.includes('how should i') ||
    normalized.includes('how does') ||
    normalized.includes('how can i') ||
    normalized.includes('pay my employee') ||
    normalized.includes('sending payroll')
  )
}

function getGeminiGenerationSettings(message: string, scope: string) {
  const complexity = estimateQuestionComplexity(message, scope)

  if (complexity >= 32) {
    return {
      timeoutMs: 45000,
      maxOutputTokens: 1100,
    }
  }

  if (complexity >= 20) {
    return {
      timeoutMs: 36000,
      maxOutputTokens: 850,
    }
  }

  return {
    timeoutMs: 25000,
    maxOutputTokens: 600,
  }
}

function buildSystemInstruction(message: string) {
  const stepByStep = wantsStepByStepAnswer(message)

  return [
    'You are CipherBot.',
    'You are a technical operator assistant for the Fhenix EVM payroll system, CipherRoll.',
    'Answer only from the provided CipherRoll markdown documentation and live portal context.',
    'Do not invent features, flows, or product behavior.',
    'Refuse to write code.',
    'Refuse general trivia or unrelated questions.',
    'If the answer is not supported by the provided docs, say you can only answer from current CipherRoll documentation.',
    'Use simple language.',
    stepByStep
      ? 'For workflow questions, answer as a numbered step-by-step list with 5 to 8 concrete steps.'
      : 'Keep answers practical and operator-friendly.',
    stepByStep
      ? 'Each step must be a complete sentence and must mention the relevant action in order.'
      : 'Prefer 3 to 6 complete sentences.',
    'Never end mid-sentence. Always finish with a complete final sentence.',
    'Do not answer with vague one-line summaries when the user asks how something works.',
  ].join(' ')
}

function isWeakGeminiAnswer(answer: string, message: string) {
  const normalized = answer.trim()
  if (!normalized) return true
  if (normalized.length < 120 && wantsStepByStepAnswer(message)) return true
  if (wantsStepByStepAnswer(message) && !/^\s*1[\.\)]\s/m.test(normalized)) return true
  if (!/[.!?]\s*$/.test(normalized)) return true
  if (
    /^the (admin|employee|auditor) portal is\b/i.test(normalized) &&
    normalized.length < 220
  ) {
    return true
  }
  return false
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

async function requestGeminiReply(
  apiKey: string,
  message: string,
  prompt: string,
  settings: { timeoutMs: number; maxOutputTokens: number }
) : Promise<{ text: string | null; model: string | null; reason: string }> {
  const models = getGeminiModelCandidates()
  const systemInstruction = buildSystemInstruction(message)

  const errors: string[] = []

  for (const model of models) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), settings.timeoutMs)

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
              maxOutputTokens: settings.maxOutputTokens,
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
          if (isWeakGeminiAnswer(text, message)) {
            errors.push(`${model}: weak-or-incomplete answer`)
            continue
          }

          return {
            text: text.trim(),
            model,
            reason: 'gemini-success',
          }
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
        return {
          text: null,
          model,
          reason: `gemini-non-retryable:${errorMessage}`,
        }
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
  return {
    text: null,
    model: null,
    reason: errors.length > 0 ? errors.join(' | ') : 'gemini-no-response',
  }
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
        'X-CipherBot-Mode': 'fallback-no-key',
      },
    })
  }

  const { prompt } = makePrompt(message, scope, body.liveContext)
  const geminiResult = await requestGeminiReply(
    apiKey,
    message,
    prompt,
    getGeminiGenerationSettings(message, scope)
  )
  const answer = geminiResult.text || makeFallbackAnswer(message, scope, body.liveContext)
  const mode = geminiResult.text ? 'gemini' : 'fallback-after-gemini'

  return new Response(answer, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-CipherBot-Mode': mode,
      'X-CipherBot-Model': geminiResult.model || 'none',
      'X-CipherBot-Reason': geminiResult.reason.slice(0, 180),
    },
  })
}
