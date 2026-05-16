import {
  answerCipherBotQuestion,
  getCipherBotEntries as getSharedCipherBotEntries,
  getCipherBotGreeting as getSharedCipherBotGreeting,
  getCipherBotStarterQuestions as getSharedCipherBotStarterQuestions,
  type CipherBotAnswer,
  type CipherBotKnowledgeEntry,
  type CipherBotLiveContext,
  type CipherBotScope
} from "../../packages/cipherroll-sdk/src"
import { getCipherRollBackendClient } from "./cipherroll-backend"

export type {
  CipherBotAnswer,
  CipherBotKnowledgeEntry,
  CipherBotLiveContext,
  CipherBotScope
}

export function getCipherBotEntries(scope: CipherBotScope) {
  return getSharedCipherBotEntries(scope)
}

export function getCipherBotGreeting(scope: CipherBotScope) {
  return getSharedCipherBotGreeting(scope)
}

export function getCipherBotStarterQuestions(scope: CipherBotScope) {
  return getSharedCipherBotStarterQuestions(scope)
}

export async function queryCipherBot(options: {
  scope: CipherBotScope
  question: string
  liveContext?: CipherBotLiveContext
}): Promise<CipherBotAnswer> {
  const backend = getCipherRollBackendClient()

  try {
    return await backend.queryCipherBot(options)
  } catch {
    return answerCipherBotQuestion(options)
  }
}
