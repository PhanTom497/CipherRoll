import type { IndexerStatus, OrganizationReportSummary } from "./backend-types";

export type CipherBotScope = "docs" | "admin" | "auditor" | "employee";

export type CipherBotKnowledgeEntry = {
  id: string;
  scopes: Array<CipherBotScope | "shared">;
  question: string;
  title: string;
  body: string;
  keywords: string[];
  sourceLabel: string;
};

export type CipherBotCitation = {
  id: string;
  title: string;
  sourceLabel: string;
};

export type CipherBotLiveContext = {
  organizationId?: string;
  route?: string;
  portalSummary?: string[] | null;
  reportSummary?: Pick<
    OrganizationReportSummary,
    | "pendingClaims"
    | "pendingSettlementRequests"
    | "activePayrollRuns"
    | "settledPayments"
    | "availableTreasuryFunds"
    | "reservedTreasuryFunds"
    | "treasuryRouteConfigured"
  > | null;
  indexerStatus?: Pick<
    IndexerStatus,
    "latestIndexedBlock" | "organizations" | "payrollRuns" | "payments" | "notifications"
  > | null;
};

export type CipherBotAnswer = {
  scope: CipherBotScope;
  question: string;
  answer: string;
  citations: CipherBotCitation[];
  suggestedQuestions: string[];
  matchedEntryIds: string[];
};

export type CipherBotQuery = {
  scope: CipherBotScope;
  question: string;
  liveContext?: CipherBotLiveContext;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "before",
  "can",
  "do",
  "for",
  "from",
  "how",
  "i",
  "if",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "so",
  "the",
  "to",
  "what",
  "when",
  "why",
  "with"
]);

const CIPHERBOT_ENTRIES: CipherBotKnowledgeEntry[] = [
  {
    id: "shared-identity",
    scopes: ["shared", "docs", "admin", "auditor", "employee"],
    question: "Who are you?",
    title: "CipherBot identity",
    body:
      "I am CipherBot, CipherRoll's in-product guide. I help explain the current product, its workflow, and its privacy boundaries in plain language.",
    keywords: ["who are you", "what are you", "your name", "cipherbot", "assistant", "help"],
    sourceLabel: "CipherBot product identity"
  },
  {
    id: "shared-funding-order",
    scopes: ["shared", "docs", "admin"],
    question: "How does payroll funding work from workspace setup to employee claim?",
    title: "Payroll funding order",
    body:
      "CipherRoll works best in a deliberate order: create the workspace, attach the treasury route, enable privacy mode, deposit encrypted budget, create the payroll run, issue allocations, move treasury inventory into that run, and only then activate employee claims. Wrapper-backed payouts add one more employee-side step: request first, finalize second.",
    keywords: ["funding", "order", "claim", "activate", "budget", "treasury", "wrapper", "run"],
    sourceLabel: "Current product flow"
  },
  {
    id: "shared-wrapper-finalize",
    scopes: ["shared", "docs", "admin"],
    question: "What does wrapper finalize do, and why is it separate from request?",
    title: "Wrapper request plus finalize",
    body:
      "The wrapper settlement path is intentionally two-step. The employee first requests payout from the confidential wrapper balance, then finalizes that request with an on-chain proof. Finalize is a real settlement gate, not a mock simulation, and it can reveal the amount on-chain before the underlying token transfer completes.",
    keywords: ["wrapper", "finalize", "request", "proof", "on-chain", "payout", "unshield"],
    sourceLabel: "Wrapper settlement boundary"
  },
  {
    id: "shared-privacy-boundary",
    scopes: ["shared", "docs", "admin", "auditor", "employee"],
    question: "What stays encrypted, and what is still public on the host chain?",
    title: "Host-chain privacy boundary",
    body:
      "CipherRoll keeps selected payroll and treasury amounts encrypted, but normal EVM metadata stays public. Wallet addresses, timestamps, transaction activity, payroll-run lifecycle changes, and many ids remain visible by host-chain design. Some labels can also be inferred if operators choose readable names that are later hashed.",
    keywords: ["public", "private", "encrypted", "metadata", "ids", "labels", "host chain"],
    sourceLabel: "Privacy matrix"
  },
  {
    id: "shared-auditor-scope",
    scopes: ["shared", "docs", "auditor", "admin"],
    question: "What does the auditor permit actually unlock?",
    title: "Aggregate-only auditor disclosure",
    body:
      "The auditor sharing permit is scoped to organization-level review. It unlocks aggregate budget, committed payroll, available runway, and the intentional public summary fields exposed by the contracts. It does not unlock employee salary rows or employee-level allocation details.",
    keywords: ["auditor", "permit", "aggregate", "employee rows", "salary", "scope", "import"],
    sourceLabel: "Auditor disclosure boundary"
  },
  {
    id: "admin-budget-vs-treasury",
    scopes: ["admin"],
    question: "Why do I need both encrypted budget and treasury funding?",
    title: "Budget versus treasury",
    body:
      "Encrypted budget is the planning layer. Treasury inventory is the actual payout backing. Budget shows what the organization intends to pay, while treasury funding is what makes a configured settlement route capable of paying employees.",
    keywords: ["budget", "treasury", "difference", "funding", "backing", "inventory"],
    sourceLabel: "Admin portal guide"
  },
  {
    id: "admin-reserve-funds",
    scopes: ["admin"],
    question: "What does Reserve Treasury Funds do, and why can a later run still show zero available?",
    title: "Reserve behavior",
    body:
      "Reserve Treasury Funds moves inventory out of the workspace's general available pool and locks it to one payroll run. If you reserve all available funds for run A, run B cannot reuse that inventory unless unreserved balance still exists. Activating claims does not move money by itself.",
    keywords: ["reserve", "available", "locked", "run", "funds", "zero", "reusable"],
    sourceLabel: "Admin portal funding behavior"
  },
  {
    id: "admin-common-failures",
    scopes: ["admin"],
    question: "What are the most common admin-side mistakes?",
    title: "Common admin-side failures",
    body:
      "The most common admin-side mistakes are missing privacy mode in the current browser session, trying to fund or activate a run before allocations exist, misreading reserved funds as reusable balance, using stale frontend state after a redeploy, or forgetting that wrapper-backed payouts still need employee-side finalize after request.",
    keywords: ["mistakes", "privacy mode", "activate", "fund", "stale frontend", "wrapper", "reserved"],
    sourceLabel: "Admin troubleshooting"
  },
  {
    id: "admin-auditor-sharing",
    scopes: ["admin"],
    question: "When should I create an auditor sharing permit?",
    title: "Auditor sharing timing",
    body:
      "The auditor sharing permit is independent from employee claim order. The admin can create it before or after employee claims, as long as the admin wallet is connected, privacy mode is enabled, the workspace exists, and the auditor recipient address is valid.",
    keywords: ["auditor", "sharing", "before claim", "after claim", "timing", "permit"],
    sourceLabel: "Admin portal: auditor sharing"
  },
  {
    id: "auditor-import-flow",
    scopes: ["auditor"],
    question: "What is the correct order for the auditor permit import flow?",
    title: "Auditor import order",
    body:
      "The clean auditor flow is: connect the auditor wallet, enable auditor access in the current browser session, paste and import the shared payload, confirm that the recipient permit is active, and then refresh the auditor summary. After that, the auditor can review shared aggregates or create verify or publish receipts.",
    keywords: ["auditor", "import", "flow", "permit", "refresh", "recipient"],
    sourceLabel: "Auditor portal access flow"
  },
  {
    id: "auditor-receipts",
    scopes: ["auditor"],
    question: "What is the difference between verify and publish receipts?",
    title: "Verify versus publish",
    body:
      "Verify creates a narrower on-chain receipt proving the decrypt result was valid. Publish goes further by making the decrypt result directly available on-chain for downstream consumers. Verify is the lower-disclosure choice by default; publish is for cases that truly need the clear result on-chain.",
    keywords: ["verify", "publish", "receipt", "on-chain", "disclosure", "difference"],
    sourceLabel: "Auditor evidence mode"
  },
  {
    id: "auditor-refresh-failure",
    scopes: ["auditor"],
    question: "Why can Refresh Auditor Summary fail even after import looked successful?",
    title: "Auditor refresh failures",
    body:
      "Refresh usually fails because the wallet is on the wrong chain, auditor access was not enabled in this browser session, the imported recipient permit expired, or the frontend is stale relative to the deployed contract ABI. The permit import can succeed locally while the actual summary refresh still fails later.",
    keywords: ["refresh", "fail", "expired", "permit", "stale abi", "wrong chain", "auditor"],
    sourceLabel: "Auditor troubleshooting"
  },
  {
    id: "phase4-backend-layer",
    scopes: ["shared", "docs", "admin", "auditor"],
    question: "What new backend support exists in Phase 4?",
    title: "Phase 4 backend and reporting layer",
    body:
      "Phase 4 adds a real backend foundation with indexed contract events, normalized read models, operator-grade reporting, exports, notification feeds, and shared SDK slices. The goal is to make CipherRoll feel like a usable product system instead of a frontend talking directly to contracts with no supporting data layer.",
    keywords: ["backend", "reporting", "exports", "notifications", "sdk", "phase 4", "indexer"],
    sourceLabel: "Phase 4 roadmap and architecture"
  },
  {
    id: "shared-future-roadmap",
    scopes: ["shared", "docs", "admin", "auditor", "employee"],
    question: "What are CipherRoll's future plans after the current release?",
    title: "CipherRoll future roadmap",
    body:
      "After the current Phase 4 release, CipherRoll's next focus is heavier operational work: real on-chain multi-admin governance, deeper integrations, richer compliance and tax workflows, and further backend and CipherBot polish. The current product already ships the payroll core, backend platform layer, reporting surface, and support copilot.",
    keywords: ["future plans", "roadmap", "next phase", "phase 5", "future", "after release"],
    sourceLabel: "Roadmap and progress"
  },
  {
    id: "shared-view-vs-tx-disclosure",
    scopes: ["shared", "docs", "auditor", "employee"],
    question: "What is the difference between local decrypt and an on-chain proof flow?",
    title: "Local browser decrypt versus on-chain proof",
    body:
      "CipherRoll uses two different disclosure modes. Local view decrypt keeps plaintext in the browser for the permitted viewer. On-chain proof flows such as wrapper finalize or auditor verify/publish receipts create public chain evidence and can expose the clear result to the host chain or downstream contracts.",
    keywords: ["local decrypt", "browser", "on-chain", "proof", "decryptForView", "decryptForTx", "public"],
    sourceLabel: "Testing and privacy boundary"
  },
  {
    id: "shared-inferable-ids",
    scopes: ["shared", "docs", "admin"],
    question: "Why can hashed workspace or run labels still be guessable?",
    title: "Hashed does not always mean private",
    body:
      "A bytes32 label is not automatically secret. If the frontend derives it from a readable source string such as a workspace name, route label, payroll run label, or memo text, outsiders can often reproduce the same hash. CipherRoll now offers safer, harder-to-guess defaults in key admin flows, but readable labels still trade convenience for inferability.",
    keywords: ["hashed", "guessable", "inferable", "workspace id", "run id", "memo", "privacy matrix"],
    sourceLabel: "Privacy matrix"
  },
  {
    id: "employee-privacy-mode",
    scopes: ["employee"],
    question: "Why do I need to enable privacy mode before I can see my payroll items?",
    title: "Why employee privacy mode exists",
    body:
      "CipherRoll stores payroll amounts as encrypted handles, not plain salary numbers. Enabling privacy mode gives your wallet the local permit and CoFHE session it needs to decrypt only your payroll items inside the browser. Without that step, the app can find your allocation records but cannot safely show the clear amounts.",
    keywords: ["privacy mode", "employee", "decrypt", "permit", "cofhe", "amounts"],
    sourceLabel: "Employee portal flow"
  },
  {
    id: "employee-claim-ready",
    scopes: ["employee"],
    question: "What has to happen before my payroll is actually claimable?",
    title: "Claim-ready conditions",
    body:
      "A payroll item becomes claimable only after the employer has funded the run and activated employee claims. Vesting items also need to reach their unlock time. If the payout route uses the wrapper path, claiming can still leave one more finalize step before the underlying settlement token is released to your wallet.",
    keywords: ["claimable", "funded", "activated", "vesting", "wrapper", "finalize"],
    sourceLabel: "Employee portal state model"
  },
  {
    id: "employee-permit-expired",
    scopes: ["employee"],
    question: "Why would I see a permit expired error when trying to claim?",
    title: "Expired employee permit",
    body:
      "That error usually comes from the local browser permit used for confidential reads or claim preparation, not from the payroll run deadline itself. Refresh the page, enable privacy mode again, and let CipherRoll mint a fresh permit for the current wallet session before retrying the claim.",
    keywords: ["permit expired", "claim", "employee", "refresh", "privacy mode", "deadline"],
    sourceLabel: "Employee troubleshooting"
  },
  {
    id: "employee-wrapper-claim",
    scopes: ["employee"],
    question: "Why does a wrapper-backed payroll claim need both request and finalize?",
    title: "Why wrapper claim is two-step",
    body:
      "The wrapper payout path first requests release from a confidential wrapper balance and then finalizes that request with an on-chain proof. Request starts the payout workflow. Finalize is the settlement gate that actually releases the underlying token, and that proof step can make the amount public on-chain.",
    keywords: ["wrapper", "request", "finalize", "employee", "claim", "public"],
    sourceLabel: "Employee portal wrapper guidance"
  },
  {
    id: "employee-vesting-state",
    scopes: ["employee"],
    question: "What do scheduled, vesting, claim ready, and claimed mean for me?",
    title: "Employee claim states",
    body:
      "Scheduled means the vesting period has not started yet. Vesting means the item exists but is still locked until the configured end time. Claim ready means the item is funded, activated, and unlocked for action. Claimed means the on-chain claim already happened, even if the surrounding workflow still has public metadata attached to it.",
    keywords: ["scheduled", "vesting", "claim ready", "claimed", "states", "employee"],
    sourceLabel: "Employee portal status language"
  },
  {
    id: "employee-no-items",
    scopes: ["employee"],
    question: "Why might the employee portal show no payroll items for my wallet?",
    title: "Why no payroll items appear",
    body:
      "The most common reasons are using the wrong wallet, selecting the wrong workspace id, not enabling privacy mode, or simply not having any allocation assigned to that address yet. CipherRoll matches payroll items to the connected wallet address, so the right wallet and workspace both matter.",
    keywords: ["no payroll items", "wrong wallet", "workspace", "privacy mode", "employee"],
    sourceLabel: "Employee troubleshooting"
  }
];

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function isScopeVisible(entry: CipherBotKnowledgeEntry, scope: CipherBotScope) {
  return entry.scopes.includes("shared") || entry.scopes.includes(scope);
}

function getScopeEntries(scope: CipherBotScope) {
  return CIPHERBOT_ENTRIES.filter((entry) => isScopeVisible(entry, scope));
}

function scoreEntry(
  entry: CipherBotKnowledgeEntry,
  scope: CipherBotScope,
  question: string,
  questionTokens: string[]
) {
  const normalizedQuestion = normalizeText(question);
  const questionTokenSet = new Set(questionTokens);
  const searchableText = `${entry.question} ${entry.title} ${entry.body} ${entry.keywords.join(" ")}`;
  const searchableTokens = tokenize(searchableText);
  const searchableTokenSet = new Set(searchableTokens);
  let score = 0;

  if (entry.scopes.includes(scope)) score += 4;
  if (entry.scopes.includes("shared")) score += 2;

  const normalizedTitle = normalizeText(entry.title);
  const normalizedPrompt = normalizeText(entry.question);

  if (normalizedQuestion === normalizedPrompt) score += 28;
  if (normalizedQuestion.includes(normalizedPrompt)) score += 18;
  if (normalizedPrompt.includes(normalizedQuestion) && normalizedQuestion.length > 10) score += 12;
  if (normalizedQuestion.includes(normalizedTitle)) score += 12;

  for (const keyword of entry.keywords) {
    const normalizedKeyword = normalizeText(keyword);
    if (normalizedQuestion.includes(normalizedKeyword)) {
      score += normalizedKeyword.includes(" ") ? 8 : 4;
    }
  }

  let overlap = 0;
  for (const token of questionTokenSet) {
    if (searchableTokenSet.has(token)) overlap += 1;
  }
  score += overlap * 3;

  return score;
}

function formatLiveContext(
  scope: CipherBotScope,
  liveContext?: CipherBotLiveContext
) {
  if (!liveContext) return "";

  const lines: string[] = [];

  if (liveContext.reportSummary) {
    lines.push(
      `Current workspace snapshot: ${liveContext.reportSummary.activePayrollRuns} active runs, ${liveContext.reportSummary.pendingClaims} pending claims, ${liveContext.reportSummary.pendingSettlementRequests} pending wrapper finalizations.`
    );

    if (scope === "admin") {
      lines.push(
        `Treasury view: available ${liveContext.reportSummary.availableTreasuryFunds}, reserved ${liveContext.reportSummary.reservedTreasuryFunds}, route configured: ${liveContext.reportSummary.treasuryRouteConfigured ? "yes" : "no"}.`
      );
    }
  }

  if (liveContext.portalSummary && liveContext.portalSummary.length > 0) {
    lines.push(...liveContext.portalSummary);
  }

  if (liveContext.indexerStatus) {
    lines.push(
      `Backend index snapshot: ${liveContext.indexerStatus.organizations} organizations, ${liveContext.indexerStatus.payrollRuns} runs, ${liveContext.indexerStatus.payments} payments, and ${liveContext.indexerStatus.notifications} notifications indexed through block ${liveContext.indexerStatus.latestIndexedBlock}.`
    );
  }

  return lines.length > 0 ? `\n\nCurrent portal context:\n- ${lines.join("\n- ")}` : "";
}

export function getCipherBotGreeting(scope: CipherBotScope) {
  switch (scope) {
    case "admin":
      return "I can help you run CipherRoll smoothly, from workspace setup and treasury funding to payroll activation, wrapper settlement, and auditor sharing.";
    case "auditor":
      return "I can help you review the current audit flow, including permit import, aggregate-only disclosure, receipts, and common refresh issues.";
    case "employee":
      return "I can help you understand employee claims, including privacy mode, claim readiness, wrapper finalize, vesting, and common wallet-side issues.";
    case "docs":
    default:
      return "I can help explain the current CipherRoll product, including payroll flow, settlement steps, privacy boundaries, auditor access, and roadmap status.";
  }
}

export function getCipherBotStarterQuestions(scope: CipherBotScope) {
  switch (scope) {
    case "admin":
      return [
        "How should I set up a workspace before sending payroll?",
        "What is the correct funding order from budget to employee claim?",
        "Why can a later payroll run still show zero available treasury funds?",
        "When does a wrapper-backed payout need request plus finalize?"
      ];
    case "auditor":
      return [
        "What does the auditor permit actually unlock?",
        "What is the correct order for importing an auditor permit?",
        "What is the difference between verify and publish receipts?",
        "Why can Refresh Auditor Summary fail after import?"
      ];
    case "employee":
      return [
        "How do I prepare my wallet before claiming payroll?",
        "Why is a payroll item not claimable yet?",
        "Why does a wrapper-backed claim need request plus finalize?",
        "What should I do if privacy mode or permits fail?"
      ];
    case "docs":
    default:
      return [
        "What is the current end-to-end CipherRoll payroll flow?",
        "What stays encrypted and what is still public on-chain?",
        "How does the wrapper settlement path work today?",
        "What shipped in Phase 4 and what is still future work?"
      ];
  }
}

export function getCipherBotEntries(scope: CipherBotScope) {
  return getScopeEntries(scope);
}

export function getCipherBotRelevantEntries(
  scope: CipherBotScope,
  question: string,
  limit = 4
) {
  const questionTokens = tokenize(question);

  return getScopeEntries(scope)
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, scope, question, questionTokens)
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.entry);
}

export function answerCipherBotQuestion(query: CipherBotQuery): CipherBotAnswer {
  const scopeEntries = getScopeEntries(query.scope);
  const questionTokens = tokenize(query.question);
  const rankedEntries = scopeEntries
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, query.scope, query.question, questionTokens)
    }))
    .sort((left, right) => right.score - left.score);

  const matched = rankedEntries.filter((item) => item.score > 0).slice(0, 3);
  const primary = matched[0]?.entry ?? scopeEntries[0];
  const supporting = matched.slice(1).map((item) => item.entry);

  const answerSections: string[] = [];

  if (matched.length === 0 || rankedEntries[0]?.score < 4) {
    answerSections.push(
      "I could not match that cleanly, so I am falling back to the closest CipherRoll guidance I have."
    );
  }

  answerSections.push(primary.body);

  if (supporting.length > 0 && rankedEntries[1]?.score >= 8) {
    answerSections.push(`Also: ${supporting[0]?.body}`);
  }

  const liveContextSection = formatLiveContext(query.scope, query.liveContext);
  if (liveContextSection && query.scope !== "docs") {
    answerSections.push(liveContextSection.trim());
  }

  const suggestions = rankedEntries
    .filter((item) => item.entry.id !== primary.id)
    .slice(0, 4)
    .map((item) => item.entry.question);

  return {
    scope: query.scope,
    question: query.question,
    answer: answerSections.join("\n\n"),
    citations: [primary, ...supporting].map((entry) => ({
      id: entry.id,
      title: entry.title,
      sourceLabel: entry.sourceLabel
    })),
    suggestedQuestions:
      suggestions.length > 0 ? suggestions : getCipherBotStarterQuestions(query.scope),
    matchedEntryIds: [primary, ...supporting].map((entry) => entry.id)
  };
}
