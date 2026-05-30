import {
  answerCipherBotQuestion,
  getCipherBotRelevantEntries,
  type CipherBotAnswer,
  type CipherBotQuery
} from "../../packages/cipherroll-sdk/dist";

type GeminiModelInfo = {
  rawName: string;
  shortName: string;
  supportedMethods: string[];
};

let geminiModelsCache: {
  expiresAt: number;
  models: GeminiModelInfo[] | null;
} = {
  expiresAt: 0,
  models: null
};

function getGeminiModelCandidates() {
  const configured = (process.env.GOOGLE_GEMINI_MODELS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const primary = (process.env.GOOGLE_GEMINI_MODEL || "gemini-2.5-flash").trim();
  const defaults = ["gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.0-flash-lite"];

  return Array.from(new Set([primary, ...configured, ...defaults].filter(Boolean)));
}

async function fetchAvailableGeminiModels(apiKey: string) {
  const now = Date.now();
  if (geminiModelsCache.models && geminiModelsCache.expiresAt > now) {
    return geminiModelsCache.models;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const errorPayload =
      typeof payload.error === "object" && payload.error != null
        ? (payload.error as Record<string, unknown>)
        : {};
    const errorMessage = String(
      errorPayload.message || errorPayload.status || "Failed to list Gemini models."
    );
    throw new Error(errorMessage);
  }

  const models = (Array.isArray(payload.models) ? payload.models : [])
    .map((model) => {
      const rawModel =
        typeof model === "object" && model != null ? (model as Record<string, unknown>) : {};
      const rawName = String(rawModel.name || "");
      const shortName = rawName.startsWith("models/") ? rawName.slice("models/".length) : rawName;
      const methods = Array.isArray(rawModel.supportedGenerationMethods)
        ? rawModel.supportedGenerationMethods
        : Array.isArray(rawModel.supportedActions)
          ? rawModel.supportedActions
          : [];

      return {
        rawName,
        shortName,
        supportedMethods: methods.map((method) => String(method))
      };
    })
    .filter(
      (model) =>
        model.shortName &&
        model.supportedMethods.some((method) => method.toLowerCase() === "generatecontent")
    );

  geminiModelsCache = {
    models,
    expiresAt: now + 5 * 60 * 1000
  };

  return models;
}

async function getGeminiModelsForRequest(apiKey: string) {
  const configuredCandidates = getGeminiModelCandidates();

  try {
    const availableModels = await fetchAvailableGeminiModels(apiKey);
    const availableNames = new Set(availableModels.map((model) => model.shortName));
    const configuredAvailable = configuredCandidates.filter((model) => availableNames.has(model));

    if (configuredAvailable.length > 0) {
      return configuredAvailable;
    }

    const discoveredFlashModels = availableModels
      .map((model) => model.shortName)
      .filter(
        (name) =>
          name.includes("flash") &&
          !name.includes("image") &&
          !name.includes("live") &&
          !name.includes("preview")
      );

    if (discoveredFlashModels.length > 0) {
      return discoveredFlashModels;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[cipherbot] Gemini ListModels failed; using configured model order:", message);
  }

  return configuredCandidates;
}

function isRetryableGeminiError(response: Response, payload: Record<string, unknown>) {
  const statusCode = response.status || Number(payload?.error) || 0;
  const errorPayload =
    typeof payload.error === "object" && payload.error != null
      ? (payload.error as Record<string, unknown>)
      : {};
  const statusText = String(errorPayload.status || "").toUpperCase();
  const message = String(errorPayload.message || "").toLowerCase();

  if (statusCode === 429 || statusCode === 503) return true;
  if (statusText === "RESOURCE_EXHAUSTED" || statusText === "UNAVAILABLE") return true;

  return (
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("retry in") ||
    message.includes("resource exhausted") ||
    message.includes("model not found") ||
    message.includes("not found")
  );
}

function isIncompleteGeminiAnswer(answer: string) {
  const normalized = answer.trim();
  if (!normalized) return true;
  return !/[.!?:)`\]]\s*$/.test(normalized) && !/\n\s*[-*]\s+\S/.test(normalized);
}

async function requestGeminiReply(systemInstruction: string, prompt: string) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY is not configured.");
  }

  const errors: string[] = [];
  const models = await getGeminiModelsForRequest(apiKey);

  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 220
          }
        })
      }
    );

    const payload = (await response.json()) as Record<string, unknown>;

    if (response.ok) {
      const candidates = Array.isArray(payload.candidates)
        ? (payload.candidates as Array<Record<string, unknown>>)
        : [];
      const text = candidates
        .flatMap((candidate) => {
          const content =
            typeof candidate.content === "object" && candidate.content != null
              ? (candidate.content as Record<string, unknown>)
              : {};
          return Array.isArray(content.parts)
            ? (content.parts as Array<Record<string, unknown>>)
            : [];
        })
        .map((part) => String(part.text || ""))
        .join("\n")
        .trim();

      if (text) {
        if (isIncompleteGeminiAnswer(text)) {
          errors.push(`${model}: incomplete answer`);
          continue;
        }

        return text;
      }
      errors.push(`${model}: empty response`);
      continue;
    }

    const errorPayload =
      typeof payload.error === "object" && payload.error != null
        ? (payload.error as Record<string, unknown>)
        : {};
    const errorMessage =
      String(errorPayload.message || errorPayload.status || `Gemini request failed for ${model}.`);
    errors.push(`${model}: ${errorMessage}`);

    if (!isRetryableGeminiError(response, payload)) {
      throw new Error(errorMessage);
    }
  }

  throw new Error(`All configured Gemini models failed. ${errors.join(" | ")}`);
}

function buildCipherBotPrompt(query: CipherBotQuery) {
  const relevantEntries = getCipherBotRelevantEntries(query.scope, query.question, 4);
  const liveContext = query.liveContext
    ? JSON.stringify(query.liveContext, null, 2)
    : "No live portal context was provided.";

  const prompt = [
    `CipherRoll portal scope: ${query.scope}`,
    "",
    `User question: ${query.question}`,
    "",
    "Relevant CipherRoll knowledge:",
    relevantEntries
      .map(
        (entry, index) =>
          `${index + 1}. ${entry.title} (${entry.sourceLabel})\nQuestion: ${entry.question}\nAnswer basis: ${entry.body}`
      )
      .join("\n\n"),
    "",
    "Current portal context:",
    liveContext
  ].join("\n");

  return {
    relevantEntries,
    prompt
  };
}

function wantsActionExecution(question: string) {
  const normalized = question.toLowerCase();
  if (/^(why|how|what|when|where|explain|tell me|walk me through)\b/.test(normalized)) {
    return false;
  }

  return [
    "do it for me",
    "execute for me",
    "submit for me",
    "send the transaction",
    "send tx",
    "activate payroll for me",
    "fund payroll for me",
    "approve payroll for me",
    "execute payroll for me",
    "reserve payroll funds for me",
    "publish this receipt for me",
    "publish receipt for me",
    "please fund this run",
    "please activate this run",
    "please reserve funds",
    "please approve this proposal",
    "please execute this proposal",
    "can you fund this run",
    "can you activate this run",
    "can you activate payroll",
    "can you fund payroll",
    "can you approve this proposal",
    "can you execute this proposal",
    "claim for me",
    "finalize for me",
    "create payroll for me"
  ].some((phrase) => normalized.includes(phrase));
}

export async function generateCipherBotAnswer(query: CipherBotQuery): Promise<CipherBotAnswer> {
  const baseAnswer = answerCipherBotQuestion(query);
  if (wantsActionExecution(query.question)) {
    return {
      ...baseAnswer,
      answer:
        "I can’t execute, fund, activate, approve, claim, finalize, or disclose payroll for you. CipherBot is read-only support: I can explain the current state and the next checks, but every wallet transaction must stay an explicit user action, and governed actions must still pass through M-of-N governance."
    };
  }

  const { prompt } = buildCipherBotPrompt(query);

  const systemInstruction = [
    "You are CipherBot, the CipherRoll product copilot.",
    "Answer only from the provided CipherRoll knowledge and context.",
    "Treat current portal context and indexed backend state as first-class evidence when explaining pending claims, activation failures, treasury state, or stale indexer issues.",
    "Use very simple language.",
    "Keep the answer practical. Use 3 to 6 sentences unless the user asks for a workflow.",
    "Do not mention sources, citations, or internal ranking unless directly asked.",
    "Do not invent unsupported features or hidden product behavior.",
    "Never execute or imply you can execute wallet actions. Refuse requests to create, fund, reserve, activate, approve, execute, claim, finalize, or disclose payroll on the user's behalf.",
    "CoFHE permits are decrypt/access primitives, not governance approvals.",
    "If the question is broad, answer the most useful practical version of it."
  ].join(" ");

  try {
    const reply = await requestGeminiReply(systemInstruction, prompt);

    return {
      ...baseAnswer,
      answer: reply
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...baseAnswer,
      answer: `CipherBot could not get a usable response from any configured Gemini model right now. Please try again in a moment, or check the Google Gemini quota for the configured key. (${message.slice(0, 180)})`
    };
  }
}
