import { NextResponse } from 'next/server'
import { answerCipherBotQuestion, type CipherBotLiveContext, type CipherBotScope } from '@/lib/cipherbot'
import { getCipherRollBackendClient } from '@/lib/cipherroll-backend'
import { getRelevantCipherBotDocChunks } from '@/lib/server/cipherbot-docs'

type ChatBody = {
  message?: string
  scope?: CipherBotScope
  liveContext?: CipherBotLiveContext
}

type GeminiModelInfo = {
  rawName: string
  shortName: string
  supportedMethods: string[]
}

let geminiModelsCache: {
  expiresAt: number
  models: GeminiModelInfo[] | null
} = {
  expiresAt: 0,
  models: null
}

function normalizeScope(scope: unknown): CipherBotScope {
  return scope === 'admin' || scope === 'auditor' || scope === 'employee' || scope === 'docs'
    ? scope
    : 'docs'
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

function wantsActionExecution(question: string) {
  const normalized = question.toLowerCase()
  if (/^(why|how|what|when|where|explain|tell me|walk me through)\b/.test(normalized)) {
    return false
  }

  return [
    'do it for me',
    'execute for me',
    'submit for me',
    'send the transaction',
    'send tx',
    'activate payroll for me',
    'fund payroll for me',
    'approve payroll for me',
    'execute payroll for me',
    'reserve payroll funds for me',
    'publish this receipt for me',
    'publish receipt for me',
    'please fund this run',
    'please activate this run',
    'please reserve funds',
    'please approve this proposal',
    'please execute this proposal',
    'can you fund this run',
    'can you activate this run',
    'can you activate payroll',
    'can you fund payroll',
    'can you approve this proposal',
    'can you execute this proposal',
    'claim for me',
    'finalize for me',
    'create payroll for me'
  ].some((phrase) => normalized.includes(phrase))
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

function makeActionRefusal() {
  return [
    'I can’t execute, fund, activate, approve, claim, finalize, or disclose payroll for you.',
    'CipherBot is read-only support: I can explain the current screen, indexed backend state, docs, and likely next checks.',
    'Every wallet transaction must remain an explicit user action, and governed actions must still pass through M-of-N governance.'
  ].join(' ')
}

function makePrompt(message: string, scope: CipherBotScope, liveContext?: CipherBotLiveContext) {
  const chunks = getScopedDocChunks(message, scope, 6)
  const localAnswer = answerCipherBotQuestion({
    scope,
    question: message,
    liveContext
  })
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
      'Relevant built-in CipherRoll product knowledge:',
      `Answer basis:\n${localAnswer.answer}`,
      `Internal grounding labels, for your reasoning only. Do not mention these labels in the final answer:\n${localAnswer.citations
        .map((citation) => `- ${citation.title} (${citation.sourceLabel})`)
        .join('\n') || '- No built-in grounding label matched.'}`,
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
    'Refuse any request to execute, fund, reserve, activate, approve, claim, finalize, or disclose payroll on the user’s behalf.',
    'You are read-only support: you may explain current state, likely causes, and next user-controlled checks, but wallet transactions must stay explicit user actions.',
    'Do not imply that AI can bypass governance, treasury funding, permit, or wallet-signature rules.',
    'CoFHE permits are decryption-access primitives, not governance approvals.',
    'Refuse general trivia or unrelated questions.',
    'Use live portal context and indexed backend state when explaining pending claims, activation failures, treasury state, or stale backend/indexer issues.',
    'Do not include a Sources, Citations, or References section unless the user explicitly asks for sources.',
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

async function withBackendContext(
  scope: CipherBotScope,
  liveContext?: CipherBotLiveContext
): Promise<CipherBotLiveContext | undefined> {
  if (scope === 'docs' && !liveContext) return undefined

  const nextContext: CipherBotLiveContext = {
    ...(liveContext ?? {})
  }

  try {
    const backend = getCipherRollBackendClient()
    if (nextContext.organizationId && !nextContext.reportSummary) {
      const reportSummary = await backend.getOrganizationReportSummary(nextContext.organizationId)
      nextContext.reportSummary = {
        pendingClaims: reportSummary.pendingClaims,
        pendingSettlementRequests: reportSummary.pendingSettlementRequests,
        activePayrollRuns: reportSummary.activePayrollRuns,
        settledPayments: reportSummary.settledPayments,
        availableTreasuryFunds: reportSummary.availableTreasuryFunds,
        reservedTreasuryFunds: reportSummary.reservedTreasuryFunds,
        treasuryRouteConfigured: reportSummary.treasuryRouteConfigured,
        supportsConfidentialSettlement: reportSummary.supportsConfidentialSettlement,
        draftPayrollRuns: reportSummary.draftPayrollRuns,
        fundedPayrollRuns: reportSummary.fundedPayrollRuns,
        finalizedPayrollRuns: reportSummary.finalizedPayrollRuns,
        totalPayments: reportSummary.totalPayments,
        employeeRecipients: reportSummary.employeeRecipients
      }
    }

    if (scope !== 'docs' && !nextContext.indexerStatus) {
      const status = await backend.getStatus()
      nextContext.indexerStatus = {
        latestIndexedBlock: status.latestIndexedBlock,
        latestKnownBlock: status.latestKnownBlock,
        organizations: status.organizations,
        payrollRuns: status.payrollRuns,
        payments: status.payments,
        notifications: status.notifications,
        lastSyncError: status.lastSyncError
      }
    }
  } catch {
    nextContext.portalSummary = [
      ...(nextContext.portalSummary ?? []),
      'Backend indexed context is unavailable right now, so this answer may rely on local portal state and docs only.'
    ]
  }

  return nextContext
}

function isWeakGeminiAnswer(answer: string, message: string) {
  const normalized = answer.trim()
  if (!normalized) return true
  if (!/[.!?:)`\]]\s*$/.test(normalized) && !/\n\s*[-*]\s+\S/.test(normalized)) return true
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

async function fetchAvailableGeminiModels(apiKey: string) {
  const now = Date.now()
  if (geminiModelsCache.models && geminiModelsCache.expiresAt > now) {
    return geminiModelsCache.models
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  )
  const payload = (await response.json()) as Record<string, unknown>

  if (!response.ok) {
    const errorPayload =
      typeof payload.error === 'object' && payload.error != null
        ? (payload.error as Record<string, unknown>)
        : {}
    const errorMessage = String(
      errorPayload.message || errorPayload.status || 'Failed to list Gemini models.'
    )
    throw new Error(errorMessage)
  }

  const models = (Array.isArray(payload.models) ? payload.models : [])
    .map((model) => {
      const rawModel = typeof model === 'object' && model != null ? (model as Record<string, unknown>) : {}
      const rawName = String(rawModel.name || '')
      const shortName = rawName.startsWith('models/') ? rawName.slice('models/'.length) : rawName
      const methods = Array.isArray(rawModel.supportedGenerationMethods)
        ? rawModel.supportedGenerationMethods
        : Array.isArray(rawModel.supportedActions)
          ? rawModel.supportedActions
          : []

      return {
        rawName,
        shortName,
        supportedMethods: methods.map((method) => String(method))
      }
    })
    .filter(
      (model) =>
        model.shortName &&
        model.supportedMethods.some((method) => method.toLowerCase() === 'generatecontent')
    )

  geminiModelsCache = {
    models,
    expiresAt: now + 5 * 60 * 1000
  }

  return models
}

async function getGeminiModelsForRequest(apiKey: string) {
  const configuredCandidates = getGeminiModelCandidates()

  try {
    const availableModels = await fetchAvailableGeminiModels(apiKey)
    const availableNames = new Set(availableModels.map((model) => model.shortName))
    const configuredAvailable = configuredCandidates.filter((model) => availableNames.has(model))

    if (configuredAvailable.length > 0) {
      return configuredAvailable
    }

    const discoveredFlashModels = availableModels
      .map((model) => model.shortName)
      .filter(
        (name) =>
          name.includes('flash') &&
          !name.includes('image') &&
          !name.includes('live') &&
          !name.includes('preview')
      )

    if (discoveredFlashModels.length > 0) {
      return discoveredFlashModels
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn('[cipherbot] Gemini ListModels failed; using configured model order:', message)
  }

  return configuredCandidates
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
  const models = await getGeminiModelsForRequest(apiKey)
  const systemInstruction = buildSystemInstruction(message)

  const errors: string[] = []

  for (const model of models) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), settings.timeoutMs)

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
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
            errors.push(`${model}: incomplete answer`)
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

  console.error('[cipherbot] all Gemini models failed:', errors.join(' | '))
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
  const scope = normalizeScope(body.scope)

  if (!message) {
    return NextResponse.json({ error: 'Missing chat message.' }, { status: 400 })
  }

  if (wantsActionExecution(message)) {
    return new Response(makeActionRefusal(), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-CipherBot-Mode': 'refusal-read-only',
      },
    })
  }

  const liveContext = await withBackendContext(scope, body.liveContext)

  if (!apiKey) {
    return new Response('CipherBot needs a configured Gemini API key before it can answer. Add GOOGLE_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY and restart the frontend server.', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-CipherBot-Mode': 'gemini-missing-key',
      },
    })
  }

  const { prompt } = makePrompt(message, scope, liveContext)
  const geminiResult = await requestGeminiReply(
    apiKey,
    message,
    prompt,
    getGeminiGenerationSettings(message, scope)
  )
  const answer =
    geminiResult.text ||
    'CipherBot could not get a usable response from any configured Gemini model right now. Please try again in a moment, or check the Google Gemini quota for the configured key.'
  const mode = geminiResult.text ? 'gemini' : 'gemini-unavailable'

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
