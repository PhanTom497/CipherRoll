import type {
  AuditReceiptRecord,
  IndexerStatus,
  NotificationRecord,
  OrganizationAuditPackage,
  OrganizationExportPackage,
  OrganizationRecord,
  OrganizationReportSummary,
  PaymentRecord,
  PayrollRunRecord,
  RawEventRecord
} from "./backend-types";
import type { CipherBotAnswer, CipherBotLiveContext, CipherBotScope } from "./cipherbot";
import { getCipherRollRuntimeConfig, type SupportedChainKey } from "./runtime";

export type CipherRollBackendHealth = {
  ok: boolean;
  service: string;
  timestamp: number;
  chainId: string;
};

export type GetOrganizationsOptions = {
  limit?: number;
};

export type GetOrganizationPaymentsOptions = {
  limit?: number;
  claimState?: "pending" | "claimed";
  settlementState?: "requested" | "settled" | "unsettled";
};

export type GetAuditReceiptsOptions = {
  orgId?: string;
  limit?: number;
  published?: boolean;
  receiptKind?: "single" | "batch";
};

export type GetEventsOptions = {
  orgId?: string;
  event?: string;
  limit?: number;
};

export type GetNotificationsOptions = {
  orgId?: string;
  limit?: number;
  category?: string;
  severity?: "info" | "success" | "warning";
};

export type GetOrganizationRunsOptions = {
  status?: number;
  limit?: number;
};

export type ReindexOptions = {
  resetToBlock?: number;
  adminToken?: string;
};

export type QueryCipherBotOptions = {
  scope: CipherBotScope;
  question: string;
  liveContext?: CipherBotLiveContext;
};

export type CipherRollBackendFetch = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export type CipherRollBackendClientOptions = {
  baseUrl: string;
  fetchFn?: CipherRollBackendFetch;
};

export type CipherRollBackendClientEnvOptions = {
  env: Record<string, string | undefined>;
  fetchFn?: CipherRollBackendFetch;
  targetChainKey?: SupportedChainKey;
};

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function withQuery(path: string, query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === "") continue;
    params.set(key, String(value));
  }

  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

async function parseJsonResponse<T>(
  responsePromise: ReturnType<CipherRollBackendFetch>,
  path: string
): Promise<T> {
  const response = await responsePromise;
  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const detail =
      typeof payload.detail === "string"
        ? payload.detail
        : typeof payload.error === "string"
          ? payload.error
          : `HTTP ${response.status}`;
    throw new Error(`CipherRoll backend request failed for ${path}: ${detail}`);
  }

  return payload as T;
}

export class CipherRollBackendClient {
  private readonly baseUrl: string;
  private readonly fetchFn: CipherRollBackendFetch;

  constructor(options: CipherRollBackendClientOptions) {
    this.baseUrl = trimTrailingSlash(options.baseUrl);
    const resolvedFetch =
      options.fetchFn ??
      ((globalThis as { fetch?: CipherRollBackendFetch }).fetch?.bind(globalThis) as
        | CipherRollBackendFetch
        | undefined);

    if (!resolvedFetch) {
      throw new Error(
        "CipherRoll backend client requires a fetch implementation in this runtime."
      );
    }

    this.fetchFn = resolvedFetch;
  }

  private get<T>(path: string): Promise<T> {
    return parseJsonResponse<T>(this.fetchFn(`${this.baseUrl}${path}`), path);
  }

  private post<T>(
    path: string,
    body: Record<string, unknown>,
    adminToken?: string
  ): Promise<T> {
    return parseJsonResponse<T>(
      this.fetchFn(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {})
        },
        body: JSON.stringify(body)
      }),
      path
    );
  }

  getHealth(): Promise<CipherRollBackendHealth> {
    return this.get<CipherRollBackendHealth>("/api/health");
  }

  getStatus(): Promise<IndexerStatus> {
    return this.get<IndexerStatus>("/api/status");
  }

  async getOrganizations(options: GetOrganizationsOptions = {}): Promise<OrganizationRecord[]> {
    const result = await this.get<{ organizations: OrganizationRecord[] }>(
      withQuery("/api/organizations", { limit: options.limit })
    );
    return result.organizations;
  }

  getOrganization(orgId: string): Promise<OrganizationRecord> {
    return this.get<OrganizationRecord>(`/api/organizations/${orgId}`);
  }

  async getOrganizationRuns(
    orgId: string,
    options: GetOrganizationRunsOptions = {}
  ): Promise<PayrollRunRecord[]> {
    const result = await this.get<{ payrollRuns: PayrollRunRecord[] }>(
      withQuery(`/api/organizations/${orgId}/runs`, {
        status: options.status,
        limit: options.limit
      })
    );
    return result.payrollRuns;
  }

  async getOrganizationPayments(
    orgId: string,
    options: GetOrganizationPaymentsOptions = {}
  ): Promise<PaymentRecord[]> {
    const result = await this.get<{ payments: PaymentRecord[] }>(
      withQuery(`/api/organizations/${orgId}/payments`, {
        limit: options.limit,
        claimState: options.claimState,
        settlementState: options.settlementState
      })
    );
    return result.payments;
  }

  getPayrollRun(payrollRunId: string): Promise<PayrollRunRecord> {
    return this.get<PayrollRunRecord>(`/api/payroll-runs/${payrollRunId}`);
  }

  getPayment(paymentId: string): Promise<PaymentRecord> {
    return this.get<PaymentRecord>(`/api/payments/${paymentId}`);
  }

  async getAuditReceipts(
    options: GetAuditReceiptsOptions = {}
  ): Promise<AuditReceiptRecord[]> {
    const result = await this.get<{ auditReceipts: AuditReceiptRecord[] }>(
      withQuery("/api/audit-receipts", {
        orgId: options.orgId,
        limit: options.limit,
        published:
          typeof options.published === "boolean" ? String(options.published) : undefined,
        receiptKind: options.receiptKind
      })
    );
    return result.auditReceipts;
  }

  async getEvents(options: GetEventsOptions = {}): Promise<RawEventRecord[]> {
    const result = await this.get<{ events: RawEventRecord[] }>(
      withQuery("/api/events", {
        orgId: options.orgId,
        event: options.event,
        limit: options.limit
      })
    );
    return result.events;
  }

  async getNotifications(
    options: GetNotificationsOptions = {}
  ): Promise<NotificationRecord[]> {
    const result = await this.get<{ notifications: NotificationRecord[] }>(
      withQuery("/api/notifications", {
        orgId: options.orgId,
        limit: options.limit,
        category: options.category,
        severity: options.severity
      })
    );
    return result.notifications;
  }

  getOrganizationReportSummary(orgId: string): Promise<OrganizationReportSummary> {
    return this.get<OrganizationReportSummary>(`/api/reports/organizations/${orgId}/summary`);
  }

  getOrganizationAuditPackage(orgId: string): Promise<OrganizationAuditPackage> {
    return this.get<OrganizationAuditPackage>(
      `/api/reports/organizations/${orgId}/audit-package`
    );
  }

  getOrganizationExportPackage(orgId: string): Promise<OrganizationExportPackage> {
    return this.get<OrganizationExportPackage>(`/api/reports/organizations/${orgId}/export`);
  }

  queryCipherBot(options: QueryCipherBotOptions): Promise<CipherBotAnswer> {
    return this.post<CipherBotAnswer>("/api/cipherbot/query", {
      scope: options.scope,
      question: options.question,
      liveContext: options.liveContext
    });
  }

  reindex(options: ReindexOptions = {}): Promise<{ ok: true; status: IndexerStatus }> {
    return this.post<{ ok: true; status: IndexerStatus }>(
      "/api/admin/reindex",
      options.resetToBlock != null ? { resetToBlock: options.resetToBlock } : {},
      options.adminToken
    );
  }
}

export function createCipherRollBackendClient(
  options: CipherRollBackendClientEnvOptions | CipherRollBackendClientOptions
): CipherRollBackendClient {
  if ("baseUrl" in options) {
    return new CipherRollBackendClient(options);
  }

  const runtime = getCipherRollRuntimeConfig(
    options.env,
    options.targetChainKey ?? "arb-sepolia"
  );

  return new CipherRollBackendClient({
    baseUrl: runtime.backendBaseUrl,
    fetchFn: options.fetchFn
  });
}
