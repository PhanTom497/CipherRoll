import {
  answerCipherBotQuestion,
  getCipherBotRelevantEntries,
  type CipherBotAnswer,
  type CipherBotQuery
} from "../../packages/cipherroll-sdk/dist";

function getGeminiModelCandidates() {
  const configured = (process.env.GOOGLE_GEMINI_MODELS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const primary = (process.env.GOOGLE_GEMINI_MODEL || "gemini-2.5-flash").trim();
  const defaults = ["gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.0-flash-lite"];

  return Array.from(new Set([primary, ...configured, ...defaults].filter(Boolean)));
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

async function requestGeminiReply(systemInstruction: string, prompt: string) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  const errors: string[] = [];
  const models = getGeminiModelCandidates();

  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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

      if (text) return text;
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

export async function generateCipherBotAnswer(query: CipherBotQuery): Promise<CipherBotAnswer> {
  const fallback = answerCipherBotQuestion(query);
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return fallback;

  const { prompt } = buildCipherBotPrompt(query);

  const systemInstruction = [
    "You are CipherBot, the CipherRoll product copilot.",
    "Answer only from the provided CipherRoll knowledge and context.",
    "Use very simple language.",
    "Keep the answer short, ideally 2 to 4 sentences.",
    "Do not mention sources, citations, or internal ranking unless directly asked.",
    "Do not invent unsupported features or hidden product behavior.",
    "If the question is broad, answer the most useful practical version of it."
  ].join(" ");

  try {
    const reply = await requestGeminiReply(systemInstruction, prompt);
    if (!reply) return fallback;

    return {
      ...fallback,
      answer: reply
    };
  } catch {
    return fallback;
  }
}
