import { expect } from "chai";

import { answerCipherBotQuestion } from "../packages/cipherroll-sdk/src/cipherbot";

describe("CipherBot knowledge", function () {
  it("answers pending-claim troubleshooting with live workspace context", function () {
    const answer = answerCipherBotQuestion({
      scope: "admin",
      question: "Why is this claim pending?",
      liveContext: {
        reportSummary: {
          pendingClaims: 2,
          pendingSettlementRequests: 1,
          activePayrollRuns: 1,
          settledPayments: 3,
          availableTreasuryFunds: "40",
          reservedTreasuryFunds: "10",
          treasuryRouteConfigured: true,
          supportsConfidentialSettlement: true,
          draftPayrollRuns: 1,
          fundedPayrollRuns: 1,
          finalizedPayrollRuns: 0,
          totalPayments: 5,
          employeeRecipients: 4
        },
        indexerStatus: {
          latestIndexedBlock: 123,
          latestKnownBlock: 130,
          organizations: 1,
          payrollRuns: 3,
          payments: 5,
          notifications: 7,
          lastSyncError: null
        }
      }
    });

    expect(answer.matchedEntryIds).to.include("admin-claim-pending");
    expect(answer.answer).to.include("pending claim");
    expect(answer.answer).to.include("2 pending claims");
    expect(answer.answer).to.include("wrapper-backed confidential settlement");
    expect(answer.answer).to.include("indexed through block 123");
  });

  it("keeps governance separate from permit and operational-action guidance", function () {
    const answer = answerCipherBotQuestion({
      scope: "admin",
      question: "Which actions are governed and which actions stay single-admin?"
    });

    expect(answer.matchedEntryIds).to.include("admin-governance-boundary");
    expect(answer.answer).to.include("payroll issuance");
    expect(answer.answer).to.include("activate run stay single-admin");
    expect(answer.answer).to.include("CoFHE permits are only decryption-access tools");
  });

  it("describes compliance packages as aggregate-first evidence exports", function () {
    const answer = answerCipherBotQuestion({
      scope: "docs",
      question: "What does the tax compliance page do?"
    });

    expect(answer.matchedEntryIds).to.include("shared-tier-a-compliance");
    expect(answer.answer).to.include("Tier A aggregate reporting layer");
    expect(answer.answer).to.include("not a tax filing");
    expect(answer.answer).to.include("not an employee salary export");
    expect(answer.answer).to.include("auditor verify/publish receipt flow");
  });
});
