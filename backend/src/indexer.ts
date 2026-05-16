import { Log } from "ethers";
import {
  mapOrganizationInsightsResult,
  mapOrganizationResult,
  mapPayrollRunIdResult,
  mapPayrollRunResult,
  mapTreasuryAdapterDetailsResult,
  safeAddress
} from "../../packages/cipherroll-sdk/dist";
import { backendConfig } from "./config";
import { coerceRowBooleans, CipherRollDatabase } from "./db";
import { auditorContract, auditorInterface, payrollContract, payrollInterface, provider } from "./contracts";
import { deriveIndexerStartBlock } from "./start-block";

type ParsedLog = {
  contract: "payroll" | "auditor";
  log: Log;
  parsed: NonNullable<ReturnType<typeof payrollInterface.parseLog>> | NonNullable<ReturnType<typeof auditorInterface.parseLog>>;
  blockTimestamp: number;
};

function normalizeAddress(address: string | null | undefined) {
  return safeAddress(address ?? "") ?? "0x0000000000000000000000000000000000000000";
}

function asString(value: unknown) {
  return typeof value === "bigint" ? value.toString() : String(value);
}

function asJson(value: Record<string, unknown>) {
  return JSON.stringify(value, (_key, entry) =>
    typeof entry === "bigint" ? entry.toString() : entry
  );
}

export class CipherRollIndexer {
  private readonly blockTimestampCache = new Map<number, number>();

  constructor(private readonly db: CipherRollDatabase) {}

  async syncOnce() {
    const now = Date.now();
    this.db.setMetadata("indexer.lastSyncStartedAt", String(now));
    this.db.setMetadata("indexer.lastSyncError", "");

    try {
      const latestKnownBlock = await provider.getBlockNumber();
      this.db.setMetadata("indexer.latestKnownBlock", String(latestKnownBlock));

      const storedBlock = this.db.getMetadata("indexer.latestIndexedBlock");
      const startBlock = storedBlock != null ? BigInt(storedBlock) + 1n : await deriveIndexerStartBlock();
      const latestBlock = BigInt(latestKnownBlock);

      if (startBlock <= latestBlock) {
        for (
          let fromBlock = startBlock;
          fromBlock <= latestBlock;
          fromBlock += BigInt(backendConfig.chunkSize)
        ) {
          const toBlock = fromBlock + BigInt(backendConfig.chunkSize - 1);
          const boundedTo = toBlock > latestBlock ? latestBlock : toBlock;
          await this.indexChunk(fromBlock, boundedTo);
          this.db.setMetadata("indexer.latestIndexedBlock", boundedTo.toString());
        }
      } else if (storedBlock == null) {
        this.db.setMetadata("indexer.latestIndexedBlock", latestBlock.toString());
      }

      this.db.setMetadata("indexer.lastSyncFinishedAt", String(Date.now()));
      this.db.setMetadata("indexer.lastSyncError", "");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.db.setMetadata("indexer.lastSyncError", message);
      throw error;
    }
  }

  private async indexChunk(fromBlock: bigint, toBlock: bigint) {
    const [payrollLogs, auditorLogs] = await Promise.all([
      provider.getLogs({
        address: backendConfig.payrollAddress,
        fromBlock,
        toBlock
      }),
      provider.getLogs({
        address: backendConfig.auditorDisclosureAddress,
        fromBlock,
        toBlock
      })
    ]);

    const parsedLogs = await this.parseLogs([
      ...payrollLogs.map((log) => ({ contract: "payroll" as const, log })),
      ...auditorLogs.map((log) => ({ contract: "auditor" as const, log }))
    ]);

    parsedLogs.sort((left, right) => {
      if (left.log.blockNumber !== right.log.blockNumber) {
        return left.log.blockNumber - right.log.blockNumber;
      }
      return left.log.index - right.log.index;
    });

    for (const entry of parsedLogs) {
      if (entry.contract === "payroll") {
        await this.processPayrollEvent(entry);
      } else {
        await this.processAuditorEvent(entry);
      }
    }
  }

  private async parseLogs(
    logs: Array<{ contract: "payroll" | "auditor"; log: Log }>
  ): Promise<ParsedLog[]> {
    const parsed: ParsedLog[] = [];
    for (const entry of logs) {
      const parsedLog =
        entry.contract === "payroll"
          ? payrollInterface.parseLog(entry.log)
          : auditorInterface.parseLog(entry.log);

      if (!parsedLog) continue;

      const blockTimestamp = await this.getBlockTimestamp(entry.log.blockNumber);
      parsed.push({
        contract: entry.contract,
        log: entry.log,
        parsed: parsedLog,
        blockTimestamp
      });
    }
    return parsed;
  }

  private async getBlockTimestamp(blockNumber: number) {
    const cached = this.blockTimestampCache.get(blockNumber);
    if (cached != null) return cached;

    const block = await provider.getBlock(blockNumber);
    const timestamp = Number(block?.timestamp ?? 0);
    this.blockTimestampCache.set(blockNumber, timestamp);
    return timestamp;
  }

  private async processPayrollEvent(entry: ParsedLog) {
    const { parsed, log, blockTimestamp } = entry;
    const args = parsed.args as unknown as Record<string, unknown>;
    const eventId = `${log.transactionHash}:${log.index}`;

    this.db.insertRawEvent({
      id: eventId,
      chainId: backendConfig.chainId.toString(),
      contractAddress: log.address,
      blockNumber: log.blockNumber,
      blockTimestamp,
      transactionHash: log.transactionHash,
      logIndex: log.index,
      eventName: parsed.name,
      orgId: typeof args.orgId === "string" ? args.orgId : null,
      payrollRunId: typeof args.payrollRunId === "string" ? args.payrollRunId : null,
      paymentId: typeof args.paymentId === "string" ? args.paymentId : null,
      payloadJson: asJson(args)
    });

    switch (parsed.name) {
      case "OrganizationCreated":
        this.db.insertNotification({
          id: eventId,
          orgId: String(args.orgId),
          payrollRunId: null,
          paymentId: null,
          category: "workspace",
          severity: "success",
          title: "Workspace created",
          detail: "A new CipherRoll workspace was created on-chain.",
          eventName: parsed.name,
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          createdAt: blockTimestamp,
          metadataJson: asJson(args)
        });
        await this.refreshOrganization(String(args.orgId), log.blockNumber);
        await this.refreshOrganizationInsights(String(args.orgId));
        await this.refreshTreasuryRoute(String(args.orgId));
        break;
      case "TreasuryConfigured":
        this.db.insertNotification({
          id: eventId,
          orgId: String(args.orgId),
          payrollRunId: null,
          paymentId: null,
          category: "treasury",
          severity: "success",
          title: "Treasury route configured",
          detail: "The workspace treasury route is now configured for payroll settlement.",
          eventName: parsed.name,
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          createdAt: blockTimestamp,
          metadataJson: asJson(args)
        });
        await this.refreshOrganization(String(args.orgId), log.blockNumber);
        await this.refreshOrganizationInsights(String(args.orgId));
        await this.refreshTreasuryRoute(String(args.orgId));
        break;
      case "BudgetDeposited":
        this.db.insertNotification({
          id: eventId,
          orgId: String(args.orgId),
          payrollRunId: null,
          paymentId: null,
          category: "treasury",
          severity: "success",
          title: "Encrypted budget deposited",
          detail: "The workspace budget increased and is ready for future payroll funding.",
          eventName: parsed.name,
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          createdAt: blockTimestamp,
          metadataJson: asJson(args)
        });
        await this.refreshOrganization(String(args.orgId), log.blockNumber);
        await this.refreshOrganizationInsights(String(args.orgId));
        await this.refreshTreasuryRoute(String(args.orgId));
        break;
      case "PayrollRunCreated":
        this.db.insertNotification({
          id: eventId,
          orgId: String(args.orgId),
          payrollRunId: String(args.payrollRunId),
          paymentId: null,
          category: "payroll_run",
          severity: "info",
          title: "Payroll run created",
          detail: "A new payroll run was created and is waiting for funding and activation.",
          eventName: parsed.name,
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          createdAt: blockTimestamp,
          metadataJson: asJson(args)
        });
        await this.refreshPayrollRun(String(args.payrollRunId), log.blockNumber);
        await this.refreshOrganization(String(args.orgId), log.blockNumber);
        await this.refreshOrganizationInsights(String(args.orgId));
        await this.refreshTreasuryRoute(String(args.orgId));
        break;
      case "PayrollRunFunded":
        this.db.insertNotification({
          id: eventId,
          orgId: String(args.orgId),
          payrollRunId: String(args.payrollRunId),
          paymentId: null,
          category: "payroll_run",
          severity: "success",
          title: "Payroll run funded",
          detail: "Payroll funding is locked for this run and it can move toward employee activation.",
          eventName: parsed.name,
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          createdAt: blockTimestamp,
          metadataJson: asJson(args)
        });
        await this.refreshPayrollRun(String(args.payrollRunId), log.blockNumber);
        await this.refreshOrganization(String(args.orgId), log.blockNumber);
        await this.refreshOrganizationInsights(String(args.orgId));
        await this.refreshTreasuryRoute(String(args.orgId));
        break;
      case "PayrollRunTreasuryFunded":
        this.db.insertNotification({
          id: eventId,
          orgId: String(args.orgId),
          payrollRunId: String(args.payrollRunId),
          paymentId: null,
          category: "treasury",
          severity: "success",
          title: "Treasury funds reserved",
          detail: "Treasury inventory was reserved into a payroll run bucket.",
          eventName: parsed.name,
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          createdAt: blockTimestamp,
          metadataJson: asJson(args)
        });
        await this.refreshPayrollRun(String(args.payrollRunId), log.blockNumber);
        await this.refreshOrganization(String(args.orgId), log.blockNumber);
        await this.refreshOrganizationInsights(String(args.orgId));
        await this.refreshTreasuryRoute(String(args.orgId));
        break;
      case "PayrollRunActivated":
        this.db.insertNotification({
          id: eventId,
          orgId: String(args.orgId),
          payrollRunId: String(args.payrollRunId),
          paymentId: null,
          category: "payroll_run",
          severity: "success",
          title: "Employee claims activated",
          detail: "Employees can now act on allocations attached to this payroll run.",
          eventName: parsed.name,
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          createdAt: blockTimestamp,
          metadataJson: asJson(args)
        });
        await this.refreshPayrollRun(String(args.payrollRunId), log.blockNumber);
        await this.refreshOrganization(String(args.orgId), log.blockNumber);
        await this.refreshOrganizationInsights(String(args.orgId));
        await this.refreshTreasuryRoute(String(args.orgId));
        break;
      case "PayrollRunFinalized":
        this.db.insertNotification({
          id: eventId,
          orgId: String(args.orgId),
          payrollRunId: String(args.payrollRunId),
          paymentId: null,
          category: "payroll_run",
          severity: "success",
          title: "Payroll run finalized",
          detail: "The payroll run completed and reached its finalized state.",
          eventName: parsed.name,
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          createdAt: blockTimestamp,
          metadataJson: asJson(args)
        });
        await this.refreshPayrollRun(String(args.payrollRunId), log.blockNumber);
        await this.refreshOrganization(String(args.orgId), log.blockNumber);
        await this.refreshOrganizationInsights(String(args.orgId));
        await this.refreshTreasuryRoute(String(args.orgId));
        break;
      case "ConfidentialPayrollIssued":
        this.db.insertNotification({
          id: eventId,
          orgId: String(args.orgId),
          payrollRunId: typeof args.payrollRunId === "string" ? String(args.payrollRunId) : null,
          paymentId: String(args.paymentId),
          category: "allocation",
          severity: "info",
          title: "Payroll allocation issued",
          detail: "A confidential payroll allocation was issued to an employee wallet.",
          eventName: parsed.name,
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          createdAt: blockTimestamp,
          metadataJson: asJson(args)
        });
        await this.refreshPayment({
          paymentId: String(args.paymentId),
          orgId: String(args.orgId),
          employee: normalizeAddress(String(args.employee)),
          issuedAt: blockTimestamp,
          lastEventBlock: log.blockNumber
        });
        await this.refreshOrganizationInsights(String(args.orgId));
        break;
      case "PayrollClaimed":
        this.db.insertNotification({
          id: eventId,
          orgId: String(args.orgId),
          payrollRunId: null,
          paymentId: String(args.paymentId),
          category: "claim",
          severity: "success",
          title: "Employee claim submitted",
          detail: "An employee successfully submitted a payroll claim transaction.",
          eventName: parsed.name,
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          createdAt: blockTimestamp,
          metadataJson: asJson(args)
        });
        await this.refreshPayment({
          paymentId: String(args.paymentId),
          orgId: String(args.orgId),
          employee: normalizeAddress(String(args.employee)),
          claimedAt: blockTimestamp,
          lastEventBlock: log.blockNumber
        });
        await this.refreshOrganizationInsights(String(args.orgId));
        break;
      case "PayrollSettled":
        this.db.insertNotification({
          id: eventId,
          orgId: String(args.orgId),
          payrollRunId: null,
          paymentId: String(args.paymentId),
          category: "settlement",
          severity: "success",
          title: "Payroll settlement finalized",
          detail: "A payroll payout completed and the settlement leg finished on-chain.",
          eventName: parsed.name,
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          createdAt: blockTimestamp,
          metadataJson: asJson(args)
        });
        await this.refreshPayment({
          paymentId: String(args.paymentId),
          orgId: String(args.orgId),
          employee: normalizeAddress(String(args.employee)),
          settledAt: blockTimestamp,
          lastEventBlock: log.blockNumber
        });
        break;
      case "PayrollSettlementRequested":
        this.db.insertNotification({
          id: eventId,
          orgId: String(args.orgId),
          payrollRunId: null,
          paymentId: String(args.paymentId),
          category: "settlement",
          severity: "info",
          title: "Wrapper settlement requested",
          detail: "A wrapper-backed payout is waiting for its finalize step.",
          eventName: parsed.name,
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          createdAt: blockTimestamp,
          metadataJson: asJson(args)
        });
        await this.refreshPayment({
          paymentId: String(args.paymentId),
          orgId: String(args.orgId),
          employee: normalizeAddress(String(args.employee)),
          requestedAt: blockTimestamp,
          requestId: String(args.requestId),
          payoutAsset: normalizeAddress(String(args.payoutAsset)),
          confidentialAsset: normalizeAddress(String(args.confidentialAsset)),
          lastEventBlock: log.blockNumber
        });
        break;
      default:
        break;
    }
  }

  private async processAuditorEvent(entry: ParsedLog) {
    const { parsed, log, blockTimestamp } = entry;
    const args = parsed.args as unknown as Record<string, unknown>;
    const eventId = `${log.transactionHash}:${log.index}`;

    this.db.insertRawEvent({
      id: eventId,
      chainId: backendConfig.chainId.toString(),
      contractAddress: log.address,
      blockNumber: log.blockNumber,
      blockTimestamp,
      transactionHash: log.transactionHash,
      logIndex: log.index,
      eventName: parsed.name,
      orgId: typeof args.orgId === "string" ? args.orgId : null,
      payrollRunId: null,
      paymentId: null,
      payloadJson: asJson(args)
    });

    if (parsed.name === "AuditorAggregateDisclosureRecorded") {
      this.db.insertNotification({
        id: eventId,
        orgId: String(args.orgId),
        payrollRunId: null,
        paymentId: null,
        category: "audit_receipt",
        severity: Boolean(args.published) ? "warning" : "success",
        title: Boolean(args.published)
          ? "Audit receipt published"
          : "Audit receipt verified",
        detail: Boolean(args.published)
          ? "An aggregate audit metric was published on-chain for downstream use."
          : "An aggregate audit metric was verified on-chain as narrow evidence.",
        eventName: parsed.name,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        createdAt: blockTimestamp,
        metadataJson: asJson(args)
      });
      this.db.upsertAuditReceipt({
        id: eventId,
        orgId: String(args.orgId),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        blockTimestamp,
        auditor: normalizeAddress(String(args.auditor)),
        receiptKind: "single",
        metric: asString(args.metric),
        cleartextValue: asString(args.cleartextValue),
        batchHash: null,
        published: Boolean(args.published),
        contractAddress: log.address
      });
    }

    if (parsed.name === "AuditorAggregateDisclosureBatchRecorded") {
      this.db.insertNotification({
        id: eventId,
        orgId: String(args.orgId),
        payrollRunId: null,
        paymentId: null,
        category: "audit_receipt",
        severity: Boolean(args.published) ? "warning" : "success",
        title: Boolean(args.published)
          ? "Batch audit receipt published"
          : "Batch audit receipt verified",
        detail: Boolean(args.published)
          ? "A batch of aggregate audit metrics was published on-chain."
          : "A batch of aggregate audit metrics was verified on-chain.",
        eventName: parsed.name,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        createdAt: blockTimestamp,
        metadataJson: asJson(args)
      });
      this.db.upsertAuditReceipt({
        id: eventId,
        orgId: String(args.orgId),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        blockTimestamp,
        auditor: normalizeAddress(String(args.auditor)),
        receiptKind: "batch",
        metric: null,
        cleartextValue: null,
        batchHash: String(args.batchHash),
        published: Boolean(args.published),
        contractAddress: log.address
      });
    }
  }

  private async refreshOrganization(orgId: string, lastEventBlock: number) {
    const result = await payrollContract.getOrganization(orgId);
    const organization = mapOrganizationResult(result);
    this.db.upsertOrganization({
      orgId,
      ...organization,
      admin: normalizeAddress(organization.admin),
      treasuryAdapter: normalizeAddress(organization.treasuryAdapter),
      lastEventBlock,
      syncedAt: Date.now()
    });
  }

  private async refreshOrganizationInsights(orgId: string) {
    const result = await payrollContract.getAuditorOrganizationInsights(orgId);
    const insights = mapOrganizationInsightsResult(result);
    this.db.upsertOrganizationInsights({
      orgId,
      ...insights,
      syncedAt: Date.now()
    });
  }

  private async refreshTreasuryRoute(orgId: string) {
    const result = await payrollContract.getTreasuryAdapterDetails(orgId);
    const treasuryRoute = mapTreasuryAdapterDetailsResult(result);
    this.db.upsertTreasuryRoute({
      orgId,
      ...treasuryRoute,
      adapter: normalizeAddress(treasuryRoute.adapter),
      settlementAsset: normalizeAddress(treasuryRoute.settlementAsset),
      confidentialSettlementAsset: normalizeAddress(
        treasuryRoute.confidentialSettlementAsset
      ),
      syncedAt: Date.now()
    });
  }

  private async refreshPayrollRun(payrollRunId: string, lastEventBlock: number) {
    const result = await payrollContract.getPayrollRun(payrollRunId);
    const payrollRun = mapPayrollRunResult(result);
    this.db.upsertPayrollRun({
      payrollRunId,
      ...payrollRun,
      lastEventBlock,
      syncedAt: Date.now()
    });
  }

  private async refreshPayment(input: {
    paymentId: string;
    orgId: string;
    employee: string;
    issuedAt?: number;
    claimedAt?: number;
    settledAt?: number;
    requestedAt?: number;
    requestId?: string;
    payoutAsset?: string;
    confidentialAsset?: string;
    lastEventBlock: number;
  }) {
    const existing = this.db.getPayment(input.paymentId) as Record<string, unknown> | undefined;
    const normalizedExisting = coerceRowBooleans(existing, ["is_claimed"]);
    const payrollRunId = await payrollContract.getPayrollRunForPayment(input.paymentId);
    const isClaimed = await payrollContract.isPayrollClaimed(input.paymentId);

    this.db.upsertPayment({
      paymentId: input.paymentId,
      orgId: input.orgId,
      employee: input.employee,
      payrollRunId:
        mapPayrollRunIdResult(payrollRunId) ??
        ((normalizedExisting?.payroll_run_id as string | undefined) ?? null),
      issuedAt: input.issuedAt ?? ((normalizedExisting?.issued_at as number | undefined) ?? null),
      claimedAt: input.claimedAt ?? ((normalizedExisting?.claimed_at as number | undefined) ?? null),
      settledAt: input.settledAt ?? ((normalizedExisting?.settled_at as number | undefined) ?? null),
      requestedAt:
        input.requestedAt ?? ((normalizedExisting?.requested_at as number | undefined) ?? null),
      requestId: input.requestId ?? ((normalizedExisting?.request_id as string | undefined) ?? null),
      payoutAsset:
        input.payoutAsset ?? ((normalizedExisting?.payout_asset as string | undefined) ?? null),
      confidentialAsset:
        input.confidentialAsset ??
        ((normalizedExisting?.confidential_asset as string | undefined) ?? null),
      isClaimed: Boolean(isClaimed),
      lastEventBlock: input.lastEventBlock,
      syncedAt: Date.now()
    });
  }
}
