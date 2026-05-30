import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import { type CipherBotLiveContext, type CipherBotScope } from "../../packages/cipherroll-sdk/dist";
import { generateCipherBotAnswer } from "./cipherbot-assistant";
import { backendConfig } from "./config";
import { coerceRowBooleans, CipherRollDatabase, rowToJson } from "./db";
import { CipherRollIndexer } from "./indexer";
import type { AuditReceiptRecord, PaymentRecord, PayrollRunRecord, RawEventRecord } from "./types";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const BYTES32_PATTERN = /^0x[a-fA-F0-9]{64}$/;
const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;

function sanitizeManifestText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[^\w\s:./#-]/g, "").slice(0, maxLength);
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.end(JSON.stringify(payload, null, 2));
}

function notFound(response: ServerResponse) {
  sendJson(response, 404, { error: "Not found" });
}

function unauthorized(response: ServerResponse) {
  sendJson(response, 401, { error: "Missing or invalid backend admin token." });
}

function sendText(
  response: ServerResponse,
  statusCode: number,
  contentType: string,
  payload: string
) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", contentType);
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.end(payload);
}

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  if (/[,"\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    return "section,message\nempty,No rows available\n";
  }

  const columns = Array.from(
    rows.reduce((set, row) => {
      for (const key of Object.keys(row)) set.add(key);
      return set;
    }, new Set<string>())
  );

  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))
  ];
  return `${lines.join("\n")}\n`;
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function isAdminAuthorized(request: IncomingMessage) {
  if (!backendConfig.adminToken) return true;
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  return token === backendConfig.adminToken;
}

export function createCipherRollBackendServer(db: CipherRollDatabase, indexer: CipherRollIndexer) {
  return createServer(async (request, response) => {
    if (!request.url) {
      return notFound(response);
    }

    if (request.method === "OPTIONS") {
      return sendJson(response, 200, { ok: true });
    }

    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const segments = url.pathname.split("/").filter(Boolean);

    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        return sendJson(response, 200, {
          ok: true,
          service: "cipherroll-backend",
          timestamp: Date.now(),
          chainId: backendConfig.chainId.toString()
        });
      }

      if (request.method === "GET" && url.pathname === "/api/status") {
        return sendJson(response, 200, await db.getIndexerStatus());
      }

      if (request.method === "GET" && url.pathname === "/api/organizations") {
        const limit = Number.parseInt(url.searchParams.get("limit") || "100", 10);
        const rows = ((await db.getOrganizations(limit)) as Record<string, unknown>[]).map((row) =>
          rowToJson(coerceRowBooleans(row as Record<string, unknown>, ["exists_flag", "supports_confidential_settlement"]))
        );
        return sendJson(response, 200, { organizations: rows });
      }

      if (request.method === "GET" && segments[0] === "api" && segments[1] === "organizations" && segments[2] && !segments[3]) {
        const row = (await db.getOrganization(segments[2])) as Record<string, unknown> | undefined;
        if (!row) return notFound(response);
        return sendJson(
          response,
          200,
          rowToJson(coerceRowBooleans(row, ["exists_flag", "supports_confidential_settlement"]))
        );
      }

      if (
        request.method === "GET" &&
        segments[0] === "api" &&
        segments[1] === "organizations" &&
        segments[2] &&
        segments[3] === "runs"
      ) {
        const status = url.searchParams.get("status");
        const limit = Number.parseInt(url.searchParams.get("limit") || "200", 10);
        const rows = ((await db.getPayrollRunsForOrganization(segments[2], {
          status: status != null && status !== "" ? Number.parseInt(status, 10) : undefined,
          limit
        })) as PayrollRunRecord[]).map((row) =>
          rowToJson(coerceRowBooleans(row as Record<string, unknown>, ["exists_flag"]))
        );
        return sendJson(response, 200, { payrollRuns: rows });
      }

      if (
        request.method === "GET" &&
        segments[0] === "api" &&
        segments[1] === "organizations" &&
        segments[2] &&
        segments[3] === "payments"
      ) {
        const limit = Number.parseInt(url.searchParams.get("limit") || "100", 10);
        const claimState = url.searchParams.get("claimState") || undefined;
        const settlementState = url.searchParams.get("settlementState") || undefined;
        const rows = ((await db.getPaymentsForOrganization(segments[2], limit, {
          claimState:
            claimState === "pending" || claimState === "claimed" ? claimState : undefined,
          settlementState:
            settlementState === "requested" ||
            settlementState === "settled" ||
            settlementState === "unsettled"
              ? settlementState
              : undefined
        })) as PaymentRecord[]).map((row) =>
          rowToJson(coerceRowBooleans(row as Record<string, unknown>, ["is_claimed"]))
        );
        return sendJson(response, 200, { payments: rows });
      }

      if (request.method === "GET" && segments[0] === "api" && segments[1] === "payroll-runs" && segments[2]) {
        const row = (await db.getPayrollRun(segments[2])) as Record<string, unknown> | undefined;
        if (!row) return notFound(response);
        return sendJson(response, 200, rowToJson(coerceRowBooleans(row, ["exists_flag"])));
      }

      if (request.method === "GET" && segments[0] === "api" && segments[1] === "payments" && segments[2]) {
        const row = (await db.getPayment(segments[2])) as Record<string, unknown> | undefined;
        if (!row) return notFound(response);
        return sendJson(response, 200, rowToJson(coerceRowBooleans(row, ["is_claimed"])));
      }

      if (
        request.method === "GET" &&
        segments[0] === "api" &&
        segments[1] === "organizations" &&
        segments[2] &&
        segments[3] === "batch-payroll-manifests"
      ) {
        const payrollRunId = url.searchParams.get("payrollRunId") || undefined;
        if (payrollRunId && !BYTES32_PATTERN.test(payrollRunId)) {
          return sendJson(response, 400, { error: "Invalid payroll run id." });
        }

        const manifests = await db.getBatchPayrollManifests(segments[2], payrollRunId);
        return sendJson(response, 200, { manifests });
      }

      if (request.method === "POST" && url.pathname === "/api/batch-payroll-manifests") {
        const body = await readJsonBody(request);
        const orgId = typeof body.orgId === "string" ? body.orgId : "";
        const payrollRunId = typeof body.payrollRunId === "string" ? body.payrollRunId : "";
        const employee = typeof body.employee === "string" ? body.employee : "";
        const paymentId = typeof body.paymentId === "string" ? body.paymentId : "";
        const txHash = typeof body.txHash === "string" ? body.txHash : "";
        const roleSlug = sanitizeManifestText(body.roleSlug, 64);
        const roleLabel = sanitizeManifestText(body.roleLabel, 96);

        if (
          !BYTES32_PATTERN.test(orgId) ||
          !BYTES32_PATTERN.test(payrollRunId) ||
          !ADDRESS_PATTERN.test(employee) ||
          !BYTES32_PATTERN.test(paymentId) ||
          !TX_HASH_PATTERN.test(txHash) ||
          !roleSlug ||
          !roleLabel
        ) {
          return sendJson(response, 400, {
            error: "Batch payroll manifest requires safe org, run, employee, role, payment, and tx metadata."
          });
        }

        const now = Date.now();
        const record = {
          id: randomUUID(),
          orgId,
          payrollRunId,
          employee: employee.toLowerCase(),
          roleSlug,
          roleLabel,
          paymentId,
          txHash,
          createdAt: now,
          updatedAt: now
        };

        await db.upsertBatchPayrollManifest(record);
        return sendJson(response, 200, record);
      }

      if (request.method === "GET" && url.pathname === "/api/audit-receipts") {
        const orgId = url.searchParams.get("orgId") || undefined;
        const limit = Number.parseInt(url.searchParams.get("limit") || "100", 10);
        const published = url.searchParams.get("published");
        const receiptKind = url.searchParams.get("receiptKind");
        const rows = ((await db.getAuditReceipts(orgId, limit, {
          published:
            published === "true" ? true : published === "false" ? false : undefined,
          receiptKind:
            receiptKind === "single" || receiptKind === "batch" ? receiptKind : undefined
        })) as AuditReceiptRecord[]).map((row) =>
          rowToJson(coerceRowBooleans(row as Record<string, unknown>, ["published"]))
        );
        return sendJson(response, 200, { auditReceipts: rows });
      }

      if (request.method === "GET" && url.pathname === "/api/events") {
        const orgId = url.searchParams.get("orgId") || undefined;
        const eventName = url.searchParams.get("event") || undefined;
        const limit = Number.parseInt(url.searchParams.get("limit") || "100", 10);
        const rows = ((await db.getRawEvents(orgId, eventName, limit)) as RawEventRecord[]).map((row) =>
          rowToJson(row as Record<string, unknown>)
        );
        return sendJson(response, 200, { events: rows });
      }

      if (request.method === "GET" && url.pathname === "/api/notifications") {
        const orgId = url.searchParams.get("orgId") || undefined;
        const limit = Number.parseInt(url.searchParams.get("limit") || "100", 10);
        const category = url.searchParams.get("category") || undefined;
        const severity = url.searchParams.get("severity") || undefined;
        const rows = ((await db.getNotifications(orgId, limit, {
          category,
          severity:
            severity === "info" || severity === "success" || severity === "warning"
              ? severity
              : undefined
        })) as Record<string, unknown>[]).map((row) =>
          rowToJson(row as Record<string, unknown>)
        );
        return sendJson(response, 200, { notifications: rows });
      }

      if (
        request.method === "GET" &&
        segments[0] === "api" &&
        segments[1] === "reports" &&
        segments[2] === "organizations" &&
        segments[3] &&
        segments[4] === "summary"
      ) {
        const summary = await db.getOrganizationReportSummary(segments[3]);
        if (!summary) return notFound(response);
        return sendJson(response, 200, summary);
      }

      if (
        request.method === "GET" &&
        segments[0] === "api" &&
        segments[1] === "reports" &&
        segments[2] === "organizations" &&
        segments[3] &&
        segments[4] === "treasury"
      ) {
        const treasury = await db.getTreasuryExposureSummary(segments[3]);
        if (!treasury) return notFound(response);
        return sendJson(response, 200, treasury);
      }

      if (
        request.method === "GET" &&
        segments[0] === "api" &&
        segments[1] === "compliance" &&
        segments[2] === "organizations" &&
        segments[3] &&
        (segments[4] === "package" || segments[4] === "export")
      ) {
        const taxReserveBps = Number.parseInt(url.searchParams.get("taxReserveBps") || "", 10);
        const compliancePackage = await db.getCompliancePackage(
          segments[3],
          Number.isFinite(taxReserveBps) ? taxReserveBps : undefined
        );
        if (!compliancePackage) return notFound(response);

        if (segments[4] === "export" && url.searchParams.get("format") === "csv") {
          const rows: Array<Record<string, unknown>> = [
            {
              section: "policy",
              ...compliancePackage.policy
            },
            {
              section: "tax_provision",
              ...compliancePackage.taxProvision
            },
            {
              section: "treasury",
              routeHealth: compliancePackage.treasury.routeHealth,
              availableTreasuryFunds: compliancePackage.treasury.availableTreasuryFunds,
              reservedTreasuryFunds: compliancePackage.treasury.reservedTreasuryFunds,
              payoutBacklog: compliancePackage.treasury.payoutBacklog,
              activeRuns: compliancePackage.treasury.activeRuns,
              fundedRuns: compliancePackage.treasury.fundedRuns
            },
            {
              section: "evidence",
              ...compliancePackage.evidence,
              evidenceModes: compliancePackage.evidence.evidenceModes.join(" | ")
            },
            ...compliancePackage.recentReceipts.map((receipt: Record<string, unknown>) => ({
              section: "audit_receipt",
              ...receipt
            }))
          ];

          response.setHeader(
            "Content-Disposition",
            `attachment; filename=\"cipherroll-${segments[3]}-compliance.csv\"`
          );
          return sendText(response, 200, "text/csv; charset=utf-8", toCsv(rows));
        }

        return sendJson(response, 200, compliancePackage);
      }

      if (
        request.method === "GET" &&
        segments[0] === "api" &&
        segments[1] === "reports" &&
        segments[2] === "organizations" &&
        segments[3] &&
        segments[4] === "audit-package"
      ) {
        const auditPackage = await db.getOrganizationAuditPackage(segments[3]);
        if (!auditPackage) return notFound(response);
        return sendJson(response, 200, auditPackage);
      }

      if (
        request.method === "GET" &&
        segments[0] === "api" &&
        segments[1] === "reports" &&
        segments[2] === "organizations" &&
        segments[3] &&
        segments[4] === "export"
      ) {
        const exportPackage = await db.getOrganizationExportPackage(segments[3]);
        if (!exportPackage) return notFound(response);

        if (url.searchParams.get("format") === "csv") {
          const rows: Array<Record<string, unknown>> = [
            {
              section: "summary",
              ...exportPackage.summary
            },
            {
              section: "treasury",
              ...exportPackage.treasury,
              runExposures: JSON.stringify(exportPackage.treasury.runExposures),
              safetyNotes: JSON.stringify(exportPackage.treasury.safetyNotes)
            },
            ...exportPackage.payrollRuns.map((run: Record<string, unknown>) => ({
              section: "payroll_run",
              ...run
            })),
            ...exportPackage.auditReceipts.map((receipt: Record<string, unknown>) => ({
              section: "audit_receipt",
              ...receipt
            })),
            ...exportPackage.notifications.map((notification: Record<string, unknown>) => ({
              section: "notification",
              ...notification
            }))
          ];

          response.setHeader(
            "Content-Disposition",
            `attachment; filename=\"cipherroll-${segments[3]}-export.csv\"`
          );
          return sendText(response, 200, "text/csv; charset=utf-8", toCsv(rows));
        }

        return sendJson(response, 200, exportPackage);
      }

      if (request.method === "POST" && url.pathname === "/api/cipherbot/query") {
        const body = await readJsonBody(request);
        const scope = body.scope;
        const question = body.question;

        if (
          (scope !== "docs" && scope !== "admin" && scope !== "auditor" && scope !== "employee") ||
          typeof question !== "string" ||
          question.trim().length === 0
        ) {
          return sendJson(response, 400, {
            error: "CipherBot query requires a valid scope and question."
          });
        }

        const incomingLiveContext =
          typeof body.liveContext === "object" && body.liveContext != null
            ? (body.liveContext as CipherBotLiveContext)
            : undefined;

        const liveContext: CipherBotLiveContext = {
          ...(incomingLiveContext ?? {})
        };

        if (incomingLiveContext?.organizationId) {
          const reportSummary = await db.getOrganizationReportSummary(incomingLiveContext.organizationId);
          if (reportSummary) {
            liveContext.reportSummary = {
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
            };
          }
        }

        if (scope !== "docs") {
          const status = await db.getIndexerStatus();
          liveContext.indexerStatus = {
            latestIndexedBlock: status.latestIndexedBlock,
            latestKnownBlock: status.latestKnownBlock,
            organizations: status.organizations,
            payrollRuns: status.payrollRuns,
            payments: status.payments,
            notifications: status.notifications,
            lastSyncError: status.lastSyncError
          };
        }

        return sendJson(
          response,
          200,
          await generateCipherBotAnswer({
            scope: scope as CipherBotScope,
            question,
            liveContext
          })
        );
      }

      if (request.method === "POST" && url.pathname === "/api/admin/reindex") {
        if (!isAdminAuthorized(request)) {
          return unauthorized(response);
        }

        const body = await readJsonBody(request);
        if (body && typeof body.resetToBlock === "number") {
          await db.setMetadata("indexer.latestIndexedBlock", String(body.resetToBlock - 1));
        }

        await indexer.syncOnce();
        return sendJson(response, 200, {
          ok: true,
          status: await db.getIndexerStatus()
        });
      }

      return notFound(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return sendJson(response, 500, {
        error: "CipherRoll backend request failed.",
        detail: message
      });
    }
  });
}
