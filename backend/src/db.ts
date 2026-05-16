import { backendConfig } from "./config";
import type {
  AuditReceiptRecord,
  IndexerStatus,
  NotificationRecord,
  OrganizationAuditPackage,
  OrganizationExportPackage,
  OrganizationReportSummary,
  OrganizationInsightsRecord,
  OrganizationRecord,
  PaymentRecord,
  PayrollRunRecord,
  RawEventRecord,
  TreasuryRouteRecord
} from "./types";

type Primitive = string | number | bigint | null;

type StatementSync = {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
};

type DatabaseSyncType = {
  exec(sql: string): void;
  prepare(sql: string): StatementSync;
};

const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (path: string) => DatabaseSyncType;
};

function asBoolean(value: unknown): boolean {
  return Number(value) === 1;
}

export class CipherRollDatabase {
  readonly sqlite: DatabaseSyncType;

  constructor() {
    this.sqlite = new DatabaseSync(backendConfig.dbPath);
    this.sqlite.exec("PRAGMA journal_mode = WAL;");
    this.sqlite.exec("PRAGMA foreign_keys = ON;");
    this.migrate();
  }

  private migrate() {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS organizations (
        org_id TEXT PRIMARY KEY,
        admin TEXT NOT NULL,
        treasury_adapter TEXT NOT NULL,
        metadata_hash TEXT NOT NULL,
        treasury_route_id TEXT NOT NULL,
        reserved_admin_slots INTEGER NOT NULL,
        reserved_quorum INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        exists_flag INTEGER NOT NULL,
        last_event_block INTEGER NOT NULL,
        synced_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS organization_insights (
        org_id TEXT PRIMARY KEY,
        total_payroll_items INTEGER NOT NULL,
        active_payroll_items INTEGER NOT NULL,
        claimed_payroll_items INTEGER NOT NULL,
        vesting_payroll_items INTEGER NOT NULL,
        employee_recipients INTEGER NOT NULL,
        last_issued_at INTEGER NOT NULL,
        last_claimed_at INTEGER NOT NULL,
        synced_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS treasury_routes (
        org_id TEXT PRIMARY KEY,
        adapter TEXT NOT NULL,
        route_id TEXT NOT NULL,
        adapter_id TEXT NOT NULL,
        adapter_name TEXT NOT NULL,
        supports_confidential_settlement INTEGER NOT NULL,
        settlement_asset TEXT NOT NULL,
        confidential_settlement_asset TEXT NOT NULL,
        available_payroll_funds TEXT NOT NULL,
        reserved_payroll_funds TEXT NOT NULL,
        synced_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payroll_runs (
        payroll_run_id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        settlement_asset_id TEXT NOT NULL,
        funding_deadline INTEGER NOT NULL,
        planned_headcount INTEGER NOT NULL,
        allocation_count INTEGER NOT NULL,
        claimed_count INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        funded_at INTEGER NOT NULL,
        activated_at INTEGER NOT NULL,
        finalized_at INTEGER NOT NULL,
        status INTEGER NOT NULL,
        exists_flag INTEGER NOT NULL,
        last_event_block INTEGER NOT NULL,
        synced_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payments (
        payment_id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        employee TEXT NOT NULL,
        payroll_run_id TEXT,
        issued_at INTEGER,
        claimed_at INTEGER,
        settled_at INTEGER,
        requested_at INTEGER,
        request_id TEXT,
        payout_asset TEXT,
        confidential_asset TEXT,
        is_claimed INTEGER NOT NULL,
        last_event_block INTEGER NOT NULL,
        synced_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_receipts (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        block_number INTEGER NOT NULL,
        block_timestamp INTEGER NOT NULL,
        auditor TEXT NOT NULL,
        receipt_kind TEXT NOT NULL,
        metric TEXT,
        cleartext_value TEXT,
        batch_hash TEXT,
        published INTEGER NOT NULL,
        contract_address TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS raw_events (
        id TEXT PRIMARY KEY,
        chain_id TEXT NOT NULL,
        contract_address TEXT NOT NULL,
        block_number INTEGER NOT NULL,
        block_timestamp INTEGER NOT NULL,
        transaction_hash TEXT NOT NULL,
        log_index INTEGER NOT NULL,
        event_name TEXT NOT NULL,
        org_id TEXT,
        payroll_run_id TEXT,
        payment_id TEXT,
        payload_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        org_id TEXT,
        payroll_run_id TEXT,
        payment_id TEXT,
        category TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT NOT NULL,
        event_name TEXT NOT NULL,
        transaction_hash TEXT NOT NULL,
        block_number INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        metadata_json TEXT NOT NULL
      );
    `);
  }

  setMetadata(key: string, value: string) {
    this.sqlite
      .prepare(`
        INSERT INTO metadata (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `)
      .run(key, value);
  }

  getMetadata(key: string): string | null {
    const row = this.sqlite
      .prepare("SELECT value FROM metadata WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  upsertOrganization(record: OrganizationRecord) {
    this.sqlite
      .prepare(`
        INSERT INTO organizations (
          org_id, admin, treasury_adapter, metadata_hash, treasury_route_id,
          reserved_admin_slots, reserved_quorum, created_at, updated_at,
          exists_flag, last_event_block, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(org_id) DO UPDATE SET
          admin = excluded.admin,
          treasury_adapter = excluded.treasury_adapter,
          metadata_hash = excluded.metadata_hash,
          treasury_route_id = excluded.treasury_route_id,
          reserved_admin_slots = excluded.reserved_admin_slots,
          reserved_quorum = excluded.reserved_quorum,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          exists_flag = excluded.exists_flag,
          last_event_block = excluded.last_event_block,
          synced_at = excluded.synced_at
      `)
      .run(
        record.orgId,
        record.admin,
        record.treasuryAdapter,
        record.metadataHash,
        record.treasuryRouteId,
        record.reservedAdminSlots,
        record.reservedQuorum,
        record.createdAt,
        record.updatedAt,
        record.exists ? 1 : 0,
        record.lastEventBlock,
        record.syncedAt
      );
  }

  upsertOrganizationInsights(record: OrganizationInsightsRecord) {
    this.sqlite
      .prepare(`
        INSERT INTO organization_insights (
          org_id, total_payroll_items, active_payroll_items, claimed_payroll_items,
          vesting_payroll_items, employee_recipients, last_issued_at, last_claimed_at, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(org_id) DO UPDATE SET
          total_payroll_items = excluded.total_payroll_items,
          active_payroll_items = excluded.active_payroll_items,
          claimed_payroll_items = excluded.claimed_payroll_items,
          vesting_payroll_items = excluded.vesting_payroll_items,
          employee_recipients = excluded.employee_recipients,
          last_issued_at = excluded.last_issued_at,
          last_claimed_at = excluded.last_claimed_at,
          synced_at = excluded.synced_at
      `)
      .run(
        record.orgId,
        record.totalPayrollItems,
        record.activePayrollItems,
        record.claimedPayrollItems,
        record.vestingPayrollItems,
        record.employeeRecipients,
        record.lastIssuedAt,
        record.lastClaimedAt,
        record.syncedAt
      );
  }

  upsertTreasuryRoute(record: TreasuryRouteRecord) {
    this.sqlite
      .prepare(`
        INSERT INTO treasury_routes (
          org_id, adapter, route_id, adapter_id, adapter_name,
          supports_confidential_settlement, settlement_asset, confidential_settlement_asset,
          available_payroll_funds, reserved_payroll_funds, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(org_id) DO UPDATE SET
          adapter = excluded.adapter,
          route_id = excluded.route_id,
          adapter_id = excluded.adapter_id,
          adapter_name = excluded.adapter_name,
          supports_confidential_settlement = excluded.supports_confidential_settlement,
          settlement_asset = excluded.settlement_asset,
          confidential_settlement_asset = excluded.confidential_settlement_asset,
          available_payroll_funds = excluded.available_payroll_funds,
          reserved_payroll_funds = excluded.reserved_payroll_funds,
          synced_at = excluded.synced_at
      `)
      .run(
        record.orgId,
        record.adapter,
        record.routeId,
        record.adapterId,
        record.adapterName,
        record.supportsConfidentialSettlement ? 1 : 0,
        record.settlementAsset,
        record.confidentialSettlementAsset,
        record.availablePayrollFunds,
        record.reservedPayrollFunds,
        record.syncedAt
      );
  }

  upsertPayrollRun(record: PayrollRunRecord) {
    this.sqlite
      .prepare(`
        INSERT INTO payroll_runs (
          payroll_run_id, org_id, settlement_asset_id, funding_deadline, planned_headcount,
          allocation_count, claimed_count, created_at, funded_at, activated_at, finalized_at,
          status, exists_flag, last_event_block, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(payroll_run_id) DO UPDATE SET
          org_id = excluded.org_id,
          settlement_asset_id = excluded.settlement_asset_id,
          funding_deadline = excluded.funding_deadline,
          planned_headcount = excluded.planned_headcount,
          allocation_count = excluded.allocation_count,
          claimed_count = excluded.claimed_count,
          created_at = excluded.created_at,
          funded_at = excluded.funded_at,
          activated_at = excluded.activated_at,
          finalized_at = excluded.finalized_at,
          status = excluded.status,
          exists_flag = excluded.exists_flag,
          last_event_block = excluded.last_event_block,
          synced_at = excluded.synced_at
      `)
      .run(
        record.payrollRunId,
        record.orgId,
        record.settlementAssetId,
        record.fundingDeadline,
        record.plannedHeadcount,
        record.allocationCount,
        record.claimedCount,
        record.createdAt,
        record.fundedAt,
        record.activatedAt,
        record.finalizedAt,
        record.status,
        record.exists ? 1 : 0,
        record.lastEventBlock,
        record.syncedAt
      );
  }

  upsertPayment(record: PaymentRecord) {
    this.sqlite
      .prepare(`
        INSERT INTO payments (
          payment_id, org_id, employee, payroll_run_id, issued_at, claimed_at, settled_at,
          requested_at, request_id, payout_asset, confidential_asset, is_claimed,
          last_event_block, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(payment_id) DO UPDATE SET
          org_id = excluded.org_id,
          employee = excluded.employee,
          payroll_run_id = excluded.payroll_run_id,
          issued_at = COALESCE(excluded.issued_at, payments.issued_at),
          claimed_at = COALESCE(excluded.claimed_at, payments.claimed_at),
          settled_at = COALESCE(excluded.settled_at, payments.settled_at),
          requested_at = COALESCE(excluded.requested_at, payments.requested_at),
          request_id = COALESCE(excluded.request_id, payments.request_id),
          payout_asset = COALESCE(excluded.payout_asset, payments.payout_asset),
          confidential_asset = COALESCE(excluded.confidential_asset, payments.confidential_asset),
          is_claimed = excluded.is_claimed,
          last_event_block = excluded.last_event_block,
          synced_at = excluded.synced_at
      `)
      .run(
        record.paymentId,
        record.orgId,
        record.employee,
        record.payrollRunId,
        record.issuedAt,
        record.claimedAt,
        record.settledAt,
        record.requestedAt,
        record.requestId,
        record.payoutAsset,
        record.confidentialAsset,
        record.isClaimed ? 1 : 0,
        record.lastEventBlock,
        record.syncedAt
      );
  }

  upsertAuditReceipt(record: AuditReceiptRecord) {
    this.sqlite
      .prepare(`
        INSERT INTO audit_receipts (
          id, org_id, tx_hash, block_number, block_timestamp, auditor, receipt_kind,
          metric, cleartext_value, batch_hash, published, contract_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          org_id = excluded.org_id,
          tx_hash = excluded.tx_hash,
          block_number = excluded.block_number,
          block_timestamp = excluded.block_timestamp,
          auditor = excluded.auditor,
          receipt_kind = excluded.receipt_kind,
          metric = excluded.metric,
          cleartext_value = excluded.cleartext_value,
          batch_hash = excluded.batch_hash,
          published = excluded.published,
          contract_address = excluded.contract_address
      `)
      .run(
        record.id,
        record.orgId,
        record.txHash,
        record.blockNumber,
        record.blockTimestamp,
        record.auditor,
        record.receiptKind,
        record.metric,
        record.cleartextValue,
        record.batchHash,
        record.published ? 1 : 0,
        record.contractAddress
      );
  }

  insertRawEvent(record: RawEventRecord) {
    this.sqlite
      .prepare(`
        INSERT OR IGNORE INTO raw_events (
          id, chain_id, contract_address, block_number, block_timestamp,
          transaction_hash, log_index, event_name, org_id, payroll_run_id, payment_id, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        record.id,
        record.chainId,
        record.contractAddress,
        record.blockNumber,
        record.blockTimestamp,
        record.transactionHash,
        record.logIndex,
        record.eventName,
        record.orgId,
        record.payrollRunId,
        record.paymentId,
        record.payloadJson
      );
  }

  insertNotification(record: NotificationRecord) {
    this.sqlite
      .prepare(`
        INSERT OR REPLACE INTO notifications (
          id, org_id, payroll_run_id, payment_id, category, severity, title, detail,
          event_name, transaction_hash, block_number, created_at, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        record.id,
        record.orgId,
        record.payrollRunId,
        record.paymentId,
        record.category,
        record.severity,
        record.title,
        record.detail,
        record.eventName,
        record.transactionHash,
        record.blockNumber,
        record.createdAt,
        record.metadataJson
      );
  }

  getOrganizations(limit = 100) {
    return this.sqlite
      .prepare(`
        SELECT
          o.*,
          i.total_payroll_items,
          i.active_payroll_items,
          i.claimed_payroll_items,
          i.vesting_payroll_items,
          i.employee_recipients,
          i.last_issued_at,
          i.last_claimed_at,
          t.adapter,
          t.route_id,
          t.adapter_id,
          t.adapter_name,
          t.supports_confidential_settlement,
          t.settlement_asset,
          t.confidential_settlement_asset,
          t.available_payroll_funds,
          t.reserved_payroll_funds
        FROM organizations o
        LEFT JOIN organization_insights i ON i.org_id = o.org_id
        LEFT JOIN treasury_routes t ON t.org_id = o.org_id
        ORDER BY o.updated_at DESC
        LIMIT ?
      `)
      .all(limit);
  }

  getOrganization(orgId: string) {
    return this.sqlite
      .prepare(`
        SELECT
          o.*,
          i.total_payroll_items,
          i.active_payroll_items,
          i.claimed_payroll_items,
          i.vesting_payroll_items,
          i.employee_recipients,
          i.last_issued_at,
          i.last_claimed_at,
          t.adapter,
          t.route_id,
          t.adapter_id,
          t.adapter_name,
          t.supports_confidential_settlement,
          t.settlement_asset,
          t.confidential_settlement_asset,
          t.available_payroll_funds,
          t.reserved_payroll_funds
        FROM organizations o
        LEFT JOIN organization_insights i ON i.org_id = o.org_id
        LEFT JOIN treasury_routes t ON t.org_id = o.org_id
        WHERE o.org_id = ?
      `)
      .get(orgId);
  }

  getPayrollRunsForOrganization(orgId: string, options?: { status?: number; limit?: number }) {
    const limit = options?.limit ?? 200;
    const hasStatus = typeof options?.status === "number";

    if (hasStatus) {
      return this.sqlite
        .prepare(`
          SELECT * FROM payroll_runs
          WHERE org_id = ? AND status = ?
          ORDER BY created_at DESC, payroll_run_id DESC
          LIMIT ?
        `)
        .all(orgId, options!.status, limit);
    }

    return this.sqlite
      .prepare(`
        SELECT * FROM payroll_runs
        WHERE org_id = ?
        ORDER BY created_at DESC, payroll_run_id DESC
        LIMIT ?
      `)
      .all(orgId, limit);
  }

  getPayrollRun(payrollRunId: string) {
    return this.sqlite
      .prepare("SELECT * FROM payroll_runs WHERE payroll_run_id = ?")
      .get(payrollRunId);
  }

  getPayment(paymentId: string) {
    return this.sqlite
      .prepare("SELECT * FROM payments WHERE payment_id = ?")
      .get(paymentId);
  }

  getPaymentsForOrganization(
    orgId: string,
    limit = 100,
    options?: {
      claimState?: "pending" | "claimed";
      settlementState?: "requested" | "settled" | "unsettled";
    }
  ) {
    const clauses = ["org_id = ?"];
    const params: Array<string | number> = [orgId];

    if (options?.claimState === "pending") {
      clauses.push("is_claimed = 0");
    } else if (options?.claimState === "claimed") {
      clauses.push("is_claimed = 1");
    }

    if (options?.settlementState === "requested") {
      clauses.push("requested_at IS NOT NULL AND requested_at > 0 AND (settled_at IS NULL OR settled_at = 0)");
    } else if (options?.settlementState === "settled") {
      clauses.push("settled_at IS NOT NULL AND settled_at > 0");
    } else if (options?.settlementState === "unsettled") {
      clauses.push("(settled_at IS NULL OR settled_at = 0)");
    }

    params.push(limit);

    return this.sqlite
      .prepare(`
        SELECT * FROM payments
        WHERE ${clauses.join(" AND ")}
        ORDER BY COALESCE(settled_at, claimed_at, issued_at, 0) DESC, payment_id DESC
        LIMIT ?
      `)
      .all(...params);
  }

  getAuditReceipts(
    orgId?: string,
    limit = 100,
    options?: { published?: boolean; receiptKind?: "single" | "batch" }
  ) {
    const clauses: string[] = [];
    const params: Array<string | number> = [];

    if (orgId) {
      clauses.push("org_id = ?");
      params.push(orgId);
    }

    if (typeof options?.published === "boolean") {
      clauses.push("published = ?");
      params.push(options.published ? 1 : 0);
    }

    if (options?.receiptKind) {
      clauses.push("receipt_kind = ?");
      params.push(options.receiptKind);
    }

    params.push(limit);

    return this.sqlite
      .prepare(`
        SELECT * FROM audit_receipts
        ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
        ORDER BY block_number DESC, id DESC
        LIMIT ?
      `)
      .all(...params);
  }

  getRawEvents(orgId?: string, eventName?: string, limit = 100) {
    if (orgId && eventName) {
      return this.sqlite
        .prepare(`
          SELECT * FROM raw_events
          WHERE org_id = ? AND event_name = ?
          ORDER BY block_number DESC, log_index DESC
          LIMIT ?
        `)
        .all(orgId, eventName, limit);
    }
    if (orgId) {
      return this.sqlite
        .prepare(`
          SELECT * FROM raw_events
          WHERE org_id = ?
          ORDER BY block_number DESC, log_index DESC
          LIMIT ?
        `)
        .all(orgId, limit);
    }
    if (eventName) {
      return this.sqlite
        .prepare(`
          SELECT * FROM raw_events
          WHERE event_name = ?
          ORDER BY block_number DESC, log_index DESC
          LIMIT ?
        `)
        .all(eventName, limit);
    }

    return this.sqlite
      .prepare(`
        SELECT * FROM raw_events
        ORDER BY block_number DESC, log_index DESC
        LIMIT ?
      `)
      .all(limit);
  }

  getNotifications(
    orgId?: string,
    limit = 100,
    options?: { category?: string; severity?: "info" | "success" | "warning" }
  ) {
    const clauses: string[] = [];
    const params: Array<string | number> = [];

    if (orgId) {
      clauses.push("org_id = ?");
      params.push(orgId);
    }

    if (options?.category) {
      clauses.push("category = ?");
      params.push(options.category);
    }

    if (options?.severity) {
      clauses.push("severity = ?");
      params.push(options.severity);
    }

    params.push(limit);

    return this.sqlite
      .prepare(`
          SELECT * FROM notifications
          ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
          ORDER BY created_at DESC, block_number DESC, id DESC
          LIMIT ?
        `)
      .all(...params);
  }

  getOrganizationReportSummary(orgId: string): OrganizationReportSummary | null {
    const organization = coerceRowBooleans(
      this.getOrganization(orgId) as Record<string, unknown> | undefined,
      ["exists_flag", "supports_confidential_settlement"]
    );
    if (!organization) return null;

    const payrollRuns = (this.getPayrollRunsForOrganization(orgId) as Record<string, unknown>[]).map((row) =>
      coerceRowBooleans(row, ["exists_flag"]) as Record<string, unknown>
    );
    const payments = (this.getPaymentsForOrganization(orgId, 10_000) as Record<string, unknown>[]).map((row) =>
      coerceRowBooleans(row, ["is_claimed"]) as Record<string, unknown>
    );

    const countRunsByStatus = (status: number) =>
      payrollRuns.filter((run) => Number(run.status ?? 0) === status).length;

    const latestRunCreatedAt = payrollRuns.reduce<number | null>((latest, run) => {
      const value = Number(run.created_at ?? 0);
      if (!value) return latest;
      return latest == null || value > latest ? value : latest;
    }, null);

    const latestRunActivatedAt = payrollRuns.reduce<number | null>((latest, run) => {
      const value = Number(run.activated_at ?? 0);
      if (!value) return latest;
      return latest == null || value > latest ? value : latest;
    }, null);

    const latestRunFinalizedAt = payrollRuns.reduce<number | null>((latest, run) => {
      const value = Number(run.finalized_at ?? 0);
      if (!value) return latest;
      return latest == null || value > latest ? value : latest;
    }, null);

    const claimedPayments = payments.filter((payment) => Boolean(payment.is_claimed)).length;
    const settledPayments = payments.filter((payment) => Number(payment.settled_at ?? 0) > 0).length;
    const pendingClaims = payments.filter((payment) => !Boolean(payment.is_claimed)).length;
    const pendingSettlementRequests = payments.filter(
      (payment) => Number(payment.requested_at ?? 0) > 0 && Number(payment.settled_at ?? 0) === 0
    ).length;

    return {
      orgId,
      generatedAt: Date.now(),
      admin: String(organization.admin ?? ""),
      treasuryRouteConfigured:
        String(organization.treasury_adapter ?? "0x0000000000000000000000000000000000000000") !==
        "0x0000000000000000000000000000000000000000",
      supportsConfidentialSettlement: Boolean(organization.supports_confidential_settlement),
      settlementAsset: String(organization.settlement_asset ?? ""),
      confidentialSettlementAsset: String(organization.confidential_settlement_asset ?? ""),
      availableTreasuryFunds: String(organization.available_payroll_funds ?? "0"),
      reservedTreasuryFunds: String(organization.reserved_payroll_funds ?? "0"),
      totalPayrollRuns: payrollRuns.length,
      draftPayrollRuns: countRunsByStatus(0),
      fundedPayrollRuns: countRunsByStatus(1),
      activePayrollRuns: countRunsByStatus(2),
      finalizedPayrollRuns: countRunsByStatus(3),
      totalPayments: payments.length,
      claimedPayments,
      pendingClaims,
      pendingSettlementRequests,
      settledPayments,
      employeeRecipients: Number(organization.employee_recipients ?? 0),
      totalPayrollItems: Number(organization.total_payroll_items ?? 0),
      activePayrollItems: Number(organization.active_payroll_items ?? 0),
      claimedPayrollItems: Number(organization.claimed_payroll_items ?? 0),
      vestingPayrollItems: Number(organization.vesting_payroll_items ?? 0),
      lastIssuedAt: Number(organization.last_issued_at ?? 0),
      lastClaimedAt: Number(organization.last_claimed_at ?? 0),
      latestRunCreatedAt,
      latestRunActivatedAt,
      latestRunFinalizedAt
    };
  }

  getOrganizationAuditPackage(orgId: string): OrganizationAuditPackage | null {
    const summary = this.getOrganizationReportSummary(orgId);
    if (!summary) return null;

    const recentAuditReceipts = (this.getAuditReceipts(orgId, 25) as Record<string, unknown>[]).map((row) =>
      rowToJson(coerceRowBooleans(row, ["published"])) as unknown as AuditReceiptRecord
    );
    const recentNotifications = (this.getNotifications(orgId, 25) as Record<string, unknown>[]).map((row) =>
      rowToJson(row) as unknown as NotificationRecord
    );

    return {
      orgId,
      generatedAt: Date.now(),
      summary,
      recentAuditReceipts,
      recentNotifications
    };
  }

  getOrganizationExportPackage(orgId: string): OrganizationExportPackage | null {
    const summary = this.getOrganizationReportSummary(orgId);
    if (!summary) return null;

    const payrollRuns = (this.getPayrollRunsForOrganization(orgId) as Record<string, unknown>[]).map((row) =>
      rowToJson(coerceRowBooleans(row, ["exists_flag"])) as unknown as PayrollRunRecord
    );
    const auditReceipts = (this.getAuditReceipts(orgId, 250) as Record<string, unknown>[]).map((row) =>
      rowToJson(coerceRowBooleans(row, ["published"])) as unknown as AuditReceiptRecord
    );
    const notifications = (this.getNotifications(orgId, 250) as Record<string, unknown>[]).map((row) =>
      rowToJson(row) as unknown as NotificationRecord
    );

    return {
      orgId,
      generatedAt: Date.now(),
      summary,
      payrollRuns,
      auditReceipts,
      notifications
    };
  }

  getIndexerStatus(): IndexerStatus {
    const latestIndexedBlock = Number(this.getMetadata("indexer.latestIndexedBlock") || "0");
    const latestKnownBlock = Number(this.getMetadata("indexer.latestKnownBlock") || "0");
    const lastSyncStartedAt = this.getMetadata("indexer.lastSyncStartedAt");
    const lastSyncFinishedAt = this.getMetadata("indexer.lastSyncFinishedAt");
    const lastSyncError = this.getMetadata("indexer.lastSyncError");

    const counts = this.sqlite
      .prepare(`
        SELECT
          (SELECT COUNT(*) FROM organizations) AS organizations,
          (SELECT COUNT(*) FROM payroll_runs) AS payroll_runs,
          (SELECT COUNT(*) FROM payments) AS payments,
          (SELECT COUNT(*) FROM audit_receipts) AS audit_receipts,
          (SELECT COUNT(*) FROM raw_events) AS raw_events,
          (SELECT COUNT(*) FROM notifications) AS notifications
      `)
      .get() as Record<string, number>;

    return {
      chainId: backendConfig.chainId.toString(),
      payrollAddress: backendConfig.payrollAddress,
      auditorDisclosureAddress: backendConfig.auditorDisclosureAddress,
      latestIndexedBlock,
      latestKnownBlock,
      lastSyncStartedAt: lastSyncStartedAt ? Number(lastSyncStartedAt) : null,
      lastSyncFinishedAt: lastSyncFinishedAt ? Number(lastSyncFinishedAt) : null,
      lastSyncError,
      organizations: Number(counts.organizations ?? 0),
      payrollRuns: Number(counts.payroll_runs ?? 0),
      payments: Number(counts.payments ?? 0),
      auditReceipts: Number(counts.audit_receipts ?? 0),
      rawEvents: Number(counts.raw_events ?? 0),
      notifications: Number(counts.notifications ?? 0)
    };
  }
}

export function coerceRowBooleans<T extends Record<string, unknown>>(row: T | undefined, keys: string[]) {
  if (!row) return row;
  const copy = { ...row } as Record<string, unknown>;
  for (const key of keys) {
    copy[key] = asBoolean(copy[key]);
  }
  return copy as T;
}

export function rowToJson(row: Record<string, unknown> | undefined) {
  if (!row) return null;
  const output: Record<string, Primitive> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "bigint") {
      output[key] = value.toString();
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      value === null
    ) {
      output[key] = value;
    } else {
      output[key] = value == null ? null : String(value);
    }
  }
  return output;
}
