export type CipherBotScope = "docs" | "admin" | "auditor"

export type CipherBotKnowledgeEntry = {
  id: string
  scope: CipherBotScope
  question: string
  title: string
  body: string
  tags: string[]
  sourceLabel: string
}

const docsEntries: CipherBotKnowledgeEntry[] = [
  {
    id: "docs-funding-flow",
    scope: "docs",
    question: "How does payroll funding work from start to claim?",
    title: "Payroll funding flow",
    body:
      "CipherRoll works in a deliberate order. The admin creates the workspace, attaches the treasury route, funds encrypted budget, creates the payroll run, adds allocations, funds or reserves treasury inventory for that run, and activates claims. After that the employee can claim. If the route uses the wrapper path, the employee requests payout first and finalizes it second.",
    tags: ["funding", "flow", "claims", "payroll run", "treasury", "wrapper"],
    sourceLabel: "Docs: current product flow"
  },
  {
    id: "docs-wrapper-finalize",
    scope: "docs",
    question: "What is the wrapper finalize step in plain language?",
    title: "Wrapper request and finalize",
    body:
      "The wrapper route is a two-step payout flow. First the employee requests payout from the confidential wrapper balance. Then they finalize that request with an on-chain proof. The finalize step is a real settlement step and can reveal the amount on-chain before the last underlying token transfer completes.",
    tags: ["wrapper", "finalize", "request", "unshield", "proof", "public"],
    sourceLabel: "Docs: wrapper settlement boundary"
  },
  {
    id: "docs-auditor-import",
    scope: "docs",
    question: "What does the auditor import actually give access to?",
    title: "Auditor permit import scope",
    body:
      "Importing the sharing payload gives the auditor a recipient permit for aggregate review only. It unlocks the shared organization-level budget, committed, and available handles plus the public summary fields exposed by the contract. It does not unlock employee salary rows or employee allocation details.",
    tags: ["auditor", "permit", "import", "aggregate", "privacy"],
    sourceLabel: "Docs: auditor disclosure boundary"
  },
  {
    id: "docs-public-boundary",
    scope: "docs",
    question: "Which things are still public even though payroll amounts are encrypted?",
    title: "What stays public",
    body:
      "CipherRoll keeps selected amounts encrypted, but it does not hide normal EVM metadata. Wallet addresses, timestamps, transaction activity, payroll-run lifecycle state, and many ids remain public on the host chain.",
    tags: ["public", "private", "metadata", "privacy", "on-chain"],
    sourceLabel: "Docs: privacy boundary"
  },
  {
    id: "docs-common-failures",
    scope: "docs",
    question: "What are the most common operator mistakes?",
    title: "Common operator mistakes",
    body:
      "The usual mistakes are using the wrong wallet role, forgetting to enable privacy mode in the current browser session, trying to claim before the payroll run is funded and activated, assuming reserved treasury funds stay reusable for other runs, or forgetting that wrapper payouts require both request and finalize.",
    tags: ["errors", "mistakes", "privacy mode", "claim", "reserve", "wrapper"],
    sourceLabel: "Docs: operator troubleshooting"
  }
]

const adminEntries: CipherBotKnowledgeEntry[] = [
  {
    id: "admin-setup-order",
    scope: "admin",
    question: "What is the safest order for setting up a new workspace?",
    title: "Safest admin setup order",
    body:
      "The cleanest admin flow is: create the workspace, attach the treasury route, enable privacy mode, fund encrypted budget, create the payroll run, add allocations, move treasury inventory into that run, and only then activate claims. That order keeps each step easy to verify and avoids claim-side confusion.",
    tags: ["setup", "workspace", "order", "treasury", "claims", "admin"],
    sourceLabel: "Admin portal guide"
  },
  {
    id: "admin-budget-vs-treasury",
    scope: "admin",
    question: "Why do I need both budget and treasury funding?",
    title: "Budget versus treasury funding",
    body:
      "Encrypted budget is CipherRoll's planning layer. Treasury inventory is the real payout backing. Budget shows what the organization intends to pay, while treasury funding is what lets employees receive the settlement token when a payout route is configured.",
    tags: ["budget", "treasury", "funding", "settlement", "difference"],
    sourceLabel: "Admin portal: budget and treasury"
  },
  {
    id: "admin-reserve",
    scope: "admin",
    question: "What does Reserve Treasury Funds do?",
    title: "What reserve funds does",
    body:
      "Reserve Treasury Funds moves inventory from the workspace's available treasury pool into one selected payroll run. After that, those funds are locked to that run until claims consume them. Reserved funds do not stay generally available for other runs.",
    tags: ["reserve", "treasury", "available", "run", "locked"],
    sourceLabel: "Admin portal: payroll funding"
  },
  {
    id: "admin-activate",
    scope: "admin",
    question: "What changes when I activate employee claims?",
    title: "What activating claims changes",
    body:
      "Activating claims opens the payroll run for employee action. It does not move funds by itself. On direct routes the employee can claim once. On wrapper routes the employee requests payout first and finalizes the wrapper release second.",
    tags: ["activate", "claims", "employee", "wrapper", "direct"],
    sourceLabel: "Admin portal: claim activation"
  },
  {
    id: "admin-auditor-sharing",
    scope: "admin",
    question: "When should I create an auditor sharing permit?",
    title: "When to create an auditor sharing permit",
    body:
      "You can create the auditor sharing permit before or after employee claims. It is independent from payroll claim order. The admin wallet just needs privacy mode enabled, a valid auditor recipient address, and a real workspace so the sharing scope matches that organization.",
    tags: ["auditor", "sharing", "permit", "before claim", "after claim"],
    sourceLabel: "Admin portal: auditor sharing"
  },
  {
    id: "admin-common-failures",
    scope: "admin",
    question: "What are the most common admin-side failures?",
    title: "Common admin-side failures",
    body:
      "The main admin-side failures are missing privacy mode, invalid treasury setup, trying to fund or activate a run before allocations exist, using an expired or inactive browser permit, or running a stale frontend build after a redeploy.",
    tags: ["failures", "stale frontend", "privacy mode", "treasury", "fund run"],
    sourceLabel: "Admin portal troubleshooting"
  }
]

const auditorEntries: CipherBotKnowledgeEntry[] = [
  {
    id: "auditor-import-order",
    scope: "auditor",
    question: "What is the correct order for the auditor flow?",
    title: "Correct auditor flow",
    body:
      "The auditor flow is: connect the auditor wallet, enable auditor access, paste and import the admin's shared payload, confirm the imported recipient permit is active, then refresh the auditor summary. After that, the auditor can review shared aggregate values or create verify or publish receipts.",
    tags: ["auditor", "import", "permit", "refresh", "flow"],
    sourceLabel: "Auditor portal: access flow"
  },
  {
    id: "auditor-aggregate-only",
    scope: "auditor",
    question: "Why can I see aggregate numbers but not employee rows?",
    title: "Why the auditor only sees aggregates",
    body:
      "That is the intended disclosure boundary. The auditor permit is scoped to organization-level review only. CipherRoll shares aggregate budget, committed payroll, and available runway plus public summary metadata, but not employee-level encrypted allocations or salary rows.",
    tags: ["aggregate", "employee rows", "scope", "privacy", "auditor"],
    sourceLabel: "Auditor portal: disclosure scope"
  },
  {
    id: "auditor-verify-publish",
    scope: "auditor",
    question: "What is the difference between verify and publish receipts?",
    title: "Verify versus publish receipts",
    body:
      "Verify creates a narrower on-chain receipt proving the decrypt result was valid. Publish goes further and posts the decrypt result on-chain for downstream consumers. Verify is the smaller disclosure by default. Publish is for cases where the result needs to be consumed directly on-chain.",
    tags: ["verify", "publish", "receipt", "on-chain", "disclosure"],
    sourceLabel: "Auditor portal: evidence mode"
  },
  {
    id: "auditor-refresh-failure",
    scope: "auditor",
    question: "What should I check if Refresh Auditor Summary fails?",
    title: "Why Refresh Auditor Summary can fail",
    body:
      "Check that the auditor wallet is on Arbitrum Sepolia, auditor access is enabled in this browser session, the imported recipient permit is active and not expired, and the frontend was restarted after any contract redeploy. A stale frontend ABI can break refresh even if permit import looked successful.",
    tags: ["refresh", "expired permit", "abi", "frontend", "auditor error"],
    sourceLabel: "Auditor portal troubleshooting"
  },
  {
    id: "auditor-remove-local",
    scope: "auditor",
    question: "Does removing a recipient permit fully revoke auditor access?",
    title: "What removing a recipient permit really does",
    body:
      "Removing the permit from the browser only clears local access in that browser session. It does not invalidate the same payload in another browser or wallet that already imported it. Expiration time and narrow scope remain the main controls.",
    tags: ["remove permit", "local", "expiration", "revoke", "auditor"],
    sourceLabel: "Auditor portal: revocation note"
  }
]

const scopeEntries: Record<CipherBotScope, CipherBotKnowledgeEntry[]> = {
  docs: docsEntries,
  admin: adminEntries,
  auditor: auditorEntries
}

export function getCipherBotEntries(scope: CipherBotScope) {
  return scopeEntries[scope]
}
