'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AbiCoder } from 'ethers'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Copy,
  Download,
  FileKey2,
  FolderCog,
  Info,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
  X,
  Zap
} from 'lucide-react'
import CipherBotWidget from '@/components/CipherBotWidget'
import GlassCard from '@/components/GlassCard'
import { motion, AnimatePresence } from 'framer-motion'
import NetworkStatus from '@/components/NetworkStatus'
import { useCipherRollWallet } from '@/components/EvmWalletProvider'
import {
  getCipherRollContract,
  getCipherRollGovernanceContract,
  formatHandle
} from '@/lib/cipherroll-client'
import {
  BACKEND_BASE_URL,
  CONTRACT_ADDRESS,
  DEFAULT_ORG_ID,
  DIRECT_SETTLEMENT_ADAPTER_ADDRESS,
  formatBytes32Preview,
  GOVERNANCE_CONTRACT_ADDRESS,
  makeHighEntropyBytes32Label,
  makeHighEntropyLabel,
  makeDeterministicLabel,
  safeAddress,
  TARGET_CHAIN_ID,
  TARGET_CHAIN_NAME,
  WRAPPER_SETTLEMENT_ADAPTER_ADDRESS,
  toBytes32Label
} from '@/lib/cipherroll-config'
import { getCipherRollBackendClient } from '@/lib/cipherroll-backend'
import {
  extractCipherRollErrorMessage,
  isRetryableWalletFeeError,
  parseDecimalAmountToWei,
  shortHash
} from '@/lib/admin-portal-utils'
import {
  createAuditorSharingPermit,
  decryptUint128ForView,
  encryptUint128,
  getAuditorSharingPermits,
  initCofhe,
  removeAuditorSharingPermit
} from '@/lib/fhenix-permits'
import type {
  AuditorSharingPermitView,
  IndexerStatus,
  NotificationRecord,
  OrganizationView,
  OrganizationInsightsView,
  OrganizationReportSummary,
  TreasuryExposureSummary,
  PaymentRecord,
  BatchPayrollManifestRecord,
  PayrollRunRecord,
  PayrollRunView,
  TreasuryAdapterConfig
} from '@/lib/cipherroll-types'
import type { CipherRollEncryptedInput } from '@/lib/generated/cipherroll-abi'

type AdminPortal = 'overview' | 'setup' | 'budget' | 'payroll' | 'governance' | 'auditor'

type GovernanceActionKey =
  | 'configure_treasury'
  | 'create_payroll_run'
  | 'fund_payroll_run'
  | 'fund_payroll_run_from_treasury'
  | 'activate_payroll_run'
  | 'issue_confidential_payroll'
  | 'issue_confidential_payroll_to_run'
  | 'issue_vesting_allocation'
  | 'issue_vesting_allocation_to_run'
  | 'add_admin'
  | 'remove_admin'
  | 'update_quorum'

type GovernanceActionDefinition = {
  type: number
  label: string
  requiresWalletExecutor: boolean
}

type GovernanceProposalRecord = {
  proposalId: string
  orgId: string
  actionType: number
  actionLabel: string
  payload: string
  proposer: string
  createdAt: number
  expiresAt: number
  approvalCount: number
  executed: boolean
  cancelled: boolean
  approvedByCurrentAdmin: boolean
  requiresWalletExecutor: boolean
}

type GovernanceOverview = {
  primaryAdmin: string
  maxAdmins: number
  quorum: number
  adminCount: number
  nonce: number
  initialized: boolean
}

type PendingGovernedPayrollIntent = {
  key: string
  actionKey: 'issue_confidential_payroll_to_run' | 'issue_vesting_allocation_to_run'
  payload: string
  encryptedAmount: CipherRollEncryptedInput
  paymentId: string
  memoHash: string
}

type SurfaceStatusTone = 'neutral' | 'info' | 'success' | 'error'

type BatchPayrollRole = {
  id: string
  slug: string
  label: string
  baseSalary: string
}

type BatchPayrollRowStatus = 'draft' | 'validated' | 'sealed' | 'submitting' | 'confirmed' | 'failed'

type BatchPayrollRow = {
  id: string
  employeeAddress: string
  roleSlug: string
  roleLabel: string
  amount: string
  memo: string
  status: BatchPayrollRowStatus
  error?: string | null
  txHash?: string | null
  paymentId?: string | null
  encryptedAmount?: CipherRollEncryptedInput | null
  memoHash?: string | null
}

type BatchPayrollStage = 'draft' | 'review' | 'sealed'

const MIN_PAYROLL_FUNDING_DEADLINE_BUFFER_SECONDS = 10 * 60

type SurfaceStatus = {
  tone: SurfaceStatusTone
  title: string
  detail: string
  txHash?: string | null
}

const defaultOrganization: OrganizationView = {
  admin: '',
  treasuryAdapter: '',
  metadataHash: '',
  treasuryRouteId: '',
  reservedAdminSlots: 3,
  reservedQuorum: 2,
  createdAt: 0,
  updatedAt: 0,
  exists: false
}

const defaultOrganizationInsights: OrganizationInsightsView = {
  totalPayrollItems: 0,
  activePayrollItems: 0,
  claimedPayrollItems: 0,
  vestingPayrollItems: 0,
  employeeRecipients: 0,
  lastIssuedAt: 0,
  lastClaimedAt: 0
}

const defaultPayrollRun: PayrollRunView = {
  orgId: '',
  settlementAssetId: '',
  fundingDeadline: 0,
  plannedHeadcount: 0,
  allocationCount: 0,
  claimedCount: 0,
  createdAt: 0,
  fundedAt: 0,
  activatedAt: 0,
  finalizedAt: 0,
  status: 0,
  exists: false
}

const defaultTreasuryAdapter: TreasuryAdapterConfig = {
  adapter: '',
  routeId: '',
  adapterId: '',
  adapterName: '',
  supportsConfidentialSettlement: false,
  settlementAsset: '',
  confidentialSettlementAsset: '',
  availablePayrollFunds: '0',
  reservedPayrollFunds: '0'
}

function formatTreasuryTokenAmount(value?: string | null): string {
  if (!value) return '0'

  try {
    const normalized = BigInt(value)
    const whole = normalized / 10n ** 18n
    const fraction = normalized % 10n ** 18n
    if (fraction === 0n) return whole.toString()

    const fractionText = fraction
      .toString()
      .padStart(18, '0')
      .replace(/0+$/, '')
      .slice(0, 4)

    return fractionText ? `${whole.toString()}.${fractionText}` : whole.toString()
  } catch {
    return value
  }
}

function formatDateTimeLocalInput(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function formatUnixTimestamp(value?: number | null): string {
  if (!value) return 'Not recorded'
  return new Date(value * 1000).toLocaleString()
}

function makeBatchRowId() {
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function slugifyRole(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function formatRoleLabel(value: string) {
  const clean = value.trim() || 'Imported role'
  return clean
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function parseCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  cells.push(current.trim())
  return cells
}

function parseBatchPayrollCsv(text: string): BatchPayrollRow[] {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return []

  const firstCells = parseCsvLine(lines[0]).map((cell) => cell.toLowerCase())
  const hasHeader = firstCells.some((cell) => ['employee', 'employeeaddress', 'address', 'role', 'amount', 'memo'].includes(cell.replace(/\s+/g, '')))
  const dataLines = hasHeader ? lines.slice(1) : lines
  const headerIndex = (names: string[], fallback: number) => {
    if (!hasHeader) return fallback
    const index = firstCells.findIndex((cell) => names.includes(cell.replace(/\s+/g, '')))
    return index >= 0 ? index : fallback
  }
  const employeeIndex = headerIndex(['employee', 'employeeaddress', 'address', 'wallet'], 0)
  const roleIndex = headerIndex(['role', 'roleslug', 'rolelabel'], 1)
  const amountIndex = headerIndex(['amount', 'salary', 'basesalary'], 2)
  const memoIndex = headerIndex(['memo', 'note'], 3)

  return dataLines.map((line) => {
    const cells = parseCsvLine(line)
    const roleValue = cells[roleIndex] ?? ''
    return {
      id: makeBatchRowId(),
      employeeAddress: cells[employeeIndex] ?? '',
      roleSlug: slugifyRole(roleValue),
      roleLabel: roleValue.trim(),
      amount: cells[amountIndex] ?? '',
      memo: cells[memoIndex] ?? '',
      status: 'draft',
      error: null,
      txHash: null,
      paymentId: null,
      encryptedAmount: null,
      memoHash: null
    }
  })
}

function decodeBatchPayrollCsvBuffer(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)

  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    throw new Error('This looks like an Excel .xlsx workbook, not a CSV file. In Excel, use Save As or Export and choose CSV UTF-8 (.csv), then import that file.')
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  }

  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  }

  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  if (utf8.includes('\u0000')) {
    const utf16 = new TextDecoder('utf-16le').decode(bytes)
    if (!utf16.includes('\u0000')) return utf16
  }

  return utf8
}

const governanceActionDefinitions: Record<GovernanceActionKey, GovernanceActionDefinition> = {
  configure_treasury: { type: 0, label: 'Set up treasury route', requiresWalletExecutor: false },
  create_payroll_run: { type: 1, label: 'Create payroll cycle', requiresWalletExecutor: false },
  fund_payroll_run: { type: 2, label: 'Fund payroll from private budget', requiresWalletExecutor: true },
  fund_payroll_run_from_treasury: { type: 3, label: 'Fund payroll from treasury', requiresWalletExecutor: false },
  activate_payroll_run: { type: 4, label: 'Activate payroll cycle', requiresWalletExecutor: false },
  issue_confidential_payroll: { type: 5, label: 'Issue private payroll', requiresWalletExecutor: true },
  issue_confidential_payroll_to_run: { type: 6, label: 'Issue private payroll to run', requiresWalletExecutor: true },
  issue_vesting_allocation: { type: 7, label: 'Issue vesting payment', requiresWalletExecutor: true },
  issue_vesting_allocation_to_run: { type: 8, label: 'Issue vesting payment to run', requiresWalletExecutor: true },
  add_admin: { type: 9, label: 'Add admin', requiresWalletExecutor: false },
  remove_admin: { type: 10, label: 'Remove admin', requiresWalletExecutor: false },
  update_quorum: { type: 11, label: 'Update approval threshold', requiresWalletExecutor: false }
}

const governanceActionLabelsByType = Object.fromEntries(
  Object.values(governanceActionDefinitions).map((item) => [item.type, item.label])
) as Record<number, string>

const governanceWalletActionTypes = new Set(
  Object.values(governanceActionDefinitions)
    .filter((item) => item.requiresWalletExecutor)
    .map((item) => item.type)
)

const abiCoder = AbiCoder.defaultAbiCoder()

export default function AdminPage() {
  const { address, signer, provider, chainId, isInstalled, switchToTargetChain } = useCipherRollWallet()
  const [activePortal, setActivePortal] = useState<AdminPortal>('overview')
  const [orgIdInput, setOrgIdInput] = useState(DEFAULT_ORG_ID)
  const [workspaceName, setWorkspaceName] = useState('CipherRoll Core')
  const [budgetAmount, setBudgetAmount] = useState('25.5')
  const [employeeAddress, setEmployeeAddress] = useState('')
  const [payrollWorkflow, setPayrollWorkflow] = useState<'single' | 'batch'>('single')
  const [payrollMode, setPayrollMode] = useState<'instant' | 'vesting'>('instant')
  const [paymentAmount, setPaymentAmount] = useState('3.5')
  const [paymentMemo, setPaymentMemo] = useState('')
  const [vestingStartInput, setVestingStartInput] = useState('')
  const [vestingEndInput, setVestingEndInput] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [pendingAdminAction, setPendingAdminAction] = useState<'depositBudget' | 'issuePayroll' | null>(null)
  const [cofheReady, setCofheReady] = useState(false)
  const [organization, setOrganization] = useState<OrganizationView>(defaultOrganization)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [surfaceStatus, setSurfaceStatus] = useState<SurfaceStatus>({
    tone: 'neutral',
    title: 'Ready to get started',
    detail: 'Connect your wallet, select the right network, and refresh to load your workspace.'
  })
  const [showGuide, setShowGuide] = useState(false)
  const [showAdvancedWorkspaceSettings, setShowAdvancedWorkspaceSettings] = useState(false)
  const [showAdvancedTreasurySettings, setShowAdvancedTreasurySettings] = useState(false)
  const [showAdvancedRunSettings, setShowAdvancedRunSettings] = useState(false)
  const [showPaymentMemoInput, setShowPaymentMemoInput] = useState(false)
  const [showBatchRoleEditor, setShowBatchRoleEditor] = useState(false)
  const [showBatchAuditDetails, setShowBatchAuditDetails] = useState(false)
  const [showBackendDebugDetails, setShowBackendDebugDetails] = useState(false)
  const lastSuggestedPayrollAmountRef = useRef<string | null>(null)
  const [backendReport, setBackendReport] = useState<OrganizationReportSummary | null>(null)
  const [backendTreasuryExposure, setBackendTreasuryExposure] = useState<TreasuryExposureSummary | null>(null)
  const [backendNotifications, setBackendNotifications] = useState<NotificationRecord[]>([])
  const [backendStatus, setBackendStatus] = useState<IndexerStatus | null>(null)
  const [backendActiveRuns, setBackendActiveRuns] = useState<PayrollRunRecord[]>([])
  const [backendPendingClaims, setBackendPendingClaims] = useState<PaymentRecord[]>([])
  const [backendPendingFinalizations, setBackendPendingFinalizations] = useState<PaymentRecord[]>([])
  const [batchPayrollManifests, setBatchPayrollManifests] = useState<BatchPayrollManifestRecord[]>([])
  const [backendNotificationCategory, setBackendNotificationCategory] = useState<'all' | 'payroll_run' | 'claim' | 'settlement' | 'audit_receipt' | 'governance'>('all')
  const [backendReportError, setBackendReportError] = useState<string | null>(null)
  const [isBackendReportLoading, setIsBackendReportLoading] = useState(false)
  const [governanceOverview, setGovernanceOverview] = useState<GovernanceOverview | null>(null)
  const [governanceAdmins, setGovernanceAdmins] = useState<string[]>([])
  const [governanceProposals, setGovernanceProposals] = useState<GovernanceProposalRecord[]>([])
  const [isGovernanceLoading, setIsGovernanceLoading] = useState(false)
  const [governanceError, setGovernanceError] = useState<string | null>(null)
  const [bootstrapAdminAddress, setBootstrapAdminAddress] = useState('')
  const [governanceLinkedAddress, setGovernanceLinkedAddress] = useState('')
  const [newGovernanceAdminAddress, setNewGovernanceAdminAddress] = useState('')
  const [governanceAdminToRemove, setGovernanceAdminToRemove] = useState('')
  const [nextGovernanceQuorum, setNextGovernanceQuorum] = useState('2')
  const [pendingGovernedPayrollIntent, setPendingGovernedPayrollIntent] = useState<PendingGovernedPayrollIntent | null>(null)
  const [batchPayrollStage, setBatchPayrollStage] = useState<BatchPayrollStage>('draft')
  const [batchPayrollMode, setBatchPayrollMode] = useState<'instant' | 'vesting'>('instant')
  const [batchPayrollRoles, setBatchPayrollRoles] = useState<BatchPayrollRole[]>([
    { id: 'role-engineer', slug: 'engineer', label: 'Engineer', baseSalary: '3.5' },
    { id: 'role-ops', slug: 'operations', label: 'Operations', baseSalary: '2.5' }
  ])
  const [batchPayrollRows, setBatchPayrollRows] = useState<BatchPayrollRow[]>([
    {
      id: makeBatchRowId(),
      employeeAddress: '',
      roleSlug: 'engineer',
      roleLabel: 'Engineer',
      amount: '',
      memo: '',
      status: 'draft',
      error: null,
      txHash: null,
      paymentId: null,
      encryptedAmount: null,
      memoHash: null
    }
  ])
  const [batchPayrollCsvName, setBatchPayrollCsvName] = useState('')
  const [batchPayrollProgress, setBatchPayrollProgress] = useState('')
  const [isBatchPayrollSealing, setIsBatchPayrollSealing] = useState(false)
  const [isBatchPayrollSubmitting, setIsBatchPayrollSubmitting] = useState(false)

  useEffect(() => {
    try {
      const hasDismissedGuide = localStorage.getItem('cipherroll-admin-guide-dismissed')
      if (!hasDismissedGuide) {
        setShowGuide(true)
      }
    } catch {
      setShowGuide(true)
    }
  }, [])

  useEffect(() => {
    if (!showGuide) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [showGuide])

  useEffect(() => {
    setCofheReady(false)
  }, [address, chainId])

  const remindGuideLater = () => {
    setShowGuide(false)
  }

  const downloadBackendJsonExport = async () => {
    try {
      const backend = getCipherRollBackendClient()
      const exportPackage = await backend.getOrganizationExportPackage(orgId)
      const blob = new Blob([JSON.stringify(exportPackage, null, 2)], {
        type: 'application/json;charset=utf-8'
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `cipherroll-${orgId}-operations.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(extractCipherRollErrorMessage(error))
    }
  }

  const downloadBackendCsvExport = async () => {
    try {
      const response = await fetch(
        `${BACKEND_BASE_URL}/api/reports/organizations/${encodeURIComponent(orgId)}/export?format=csv`
      )
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { detail?: string; error?: string } | null
        throw new Error(payload?.detail || payload?.error || 'CipherRoll could not generate the CSV export.')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `cipherroll-${orgId}-operations.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(extractCipherRollErrorMessage(error))
    }
  }

  const assignHighEntropyOrgLabel = () => {
    setOrgIdInput(makeHighEntropyLabel('org', workspaceName.trim() || 'cipherroll-workspace'))
  }

  const assignHighEntropyRouteLabel = () => {
    setTreasuryRouteLabel(makeHighEntropyLabel('route', treasuryRouteMode))
  }

  const assignHighEntropyPayrollRunLabel = () => {
    setSelectedPayrollRunInput(makeHighEntropyLabel('run', 'payroll'))
  }

  const dismissGuideForever = () => {
    try {
      localStorage.setItem('cipherroll-admin-guide-dismissed', 'true')
    } catch {
      // ignore storage failures
    }
    setShowGuide(false)
  }

  const [summaryHandles, setSummaryHandles] = useState<{
    budget: string
    committed: string
    available: string
  } | null>(null)
  const [summaryValues, setSummaryValues] = useState<{
    budget: string | null
    committed: string | null
    available: string | null
  }>({
    budget: null,
    committed: null,
    available: null
  })
  const [organizationInsights, setOrganizationInsights] = useState<OrganizationInsightsView>(defaultOrganizationInsights)
  const [treasuryAdapterDetails, setTreasuryAdapterDetails] = useState<TreasuryAdapterConfig>(defaultTreasuryAdapter)
  const [treasuryRouteMode, setTreasuryRouteMode] = useState<'wrapper' | 'direct'>('wrapper')
  const [treasuryRouteLabel, setTreasuryRouteLabel] = useState('cipherroll-wrapper-route')
  const [payrollFundingDeadlineInput, setPayrollFundingDeadlineInput] = useState('')
  const [payrollFundingAmount, setPayrollFundingAmount] = useState('8')
  const [treasuryDepositAmount, setTreasuryDepositAmount] = useState('8')
  const [selectedPayrollRunInput, setSelectedPayrollRunInput] = useState('may-2026-payroll')
  const [payrollRun, setPayrollRun] = useState<PayrollRunView>(defaultPayrollRun)
  const [auditorName, setAuditorName] = useState('Independent auditor')
  const [auditorRecipientAddress, setAuditorRecipientAddress] = useState('')
  const [auditorPermitName, setAuditorPermitName] = useState('CipherRoll auditor aggregate summary')
  const [auditorPermitExpirationInput, setAuditorPermitExpirationInput] = useState('')
  const [auditorSharingPermits, setAuditorSharingPermits] = useState<AuditorSharingPermitView[]>([])
  const [auditorExportPayload, setAuditorExportPayload] = useState('')

  useEffect(() => {
    if (auditorPermitExpirationInput) return

    const date = new Date()
    date.setDate(date.getDate() + 7)
    setAuditorPermitExpirationInput(formatDateTimeLocalInput(date))
  }, [auditorPermitExpirationInput])

  useEffect(() => {
    if (payrollFundingDeadlineInput) return

    const date = new Date()
    date.setDate(date.getDate() + 7)
    setPayrollFundingDeadlineInput(formatDateTimeLocalInput(date))
  }, [payrollFundingDeadlineInput])

  const orgId = useMemo(() => toBytes32Label(orgIdInput), [orgIdInput])
  const isConfigured = Boolean(CONTRACT_ADDRESS)
  const governanceConfigured = Boolean(GOVERNANCE_CONTRACT_ADDRESS)
  const isTargetChain = chainId === TARGET_CHAIN_ID
  const isAdmin = address && organization.admin
    ? address.toLowerCase() === organization.admin.toLowerCase()
    : false
  const budgetAmountInWei = useMemo(() => parseDecimalAmountToWei(budgetAmount), [budgetAmount])
  const paymentAmountInWei = useMemo(() => parseDecimalAmountToWei(paymentAmount), [paymentAmount])
  const payrollFundingAmountInWei = useMemo(() => parseDecimalAmountToWei(payrollFundingAmount), [payrollFundingAmount])
  const treasuryDepositAmountInWei = useMemo(() => parseDecimalAmountToWei(treasuryDepositAmount), [treasuryDepositAmount])
  const selectedPayrollRunId = useMemo(() => toBytes32Label(selectedPayrollRunInput), [selectedPayrollRunInput])
  const plannedHeadcountForCreate = payrollWorkflow === 'batch' ? Math.max(1, batchPayrollRows.length) : 1
  const treasuryRouteId = useMemo(() => toBytes32Label(treasuryRouteLabel), [treasuryRouteLabel])
  const auditorRecipientSafeAddress = useMemo(() => safeAddress(auditorRecipientAddress) ?? '', [auditorRecipientAddress])
  const selectedTreasuryAdapterAddress = useMemo(
    () => treasuryRouteMode === 'wrapper' ? WRAPPER_SETTLEMENT_ADAPTER_ADDRESS : DIRECT_SETTLEMENT_ADAPTER_ADDRESS,
    [treasuryRouteMode]
  )
  const payrollFundingDeadlineTimestamp = useMemo(() => {
    if (!payrollFundingDeadlineInput) return null
    const value = Math.floor(new Date(payrollFundingDeadlineInput).getTime() / 1000)
    return Number.isFinite(value) && value > 0 ? value : null
  }, [payrollFundingDeadlineInput])
  const vestingStartTimestamp = useMemo(() => {
    if (!vestingStartInput) return null
    const value = Math.floor(new Date(vestingStartInput).getTime() / 1000)
    return Number.isFinite(value) && value > 0 ? value : null
  }, [vestingStartInput])
  const vestingEndTimestamp = useMemo(() => {
    if (!vestingEndInput) return null
    const value = Math.floor(new Date(vestingEndInput).getTime() / 1000)
    return Number.isFinite(value) && value > 0 ? value : null
  }, [vestingEndInput])
  const auditorPermitExpirationTimestamp = useMemo(() => {
    if (!auditorPermitExpirationInput) return null
    const value = Math.floor(new Date(auditorPermitExpirationInput).getTime() / 1000)
    return Number.isFinite(value) && value > 0 ? value : null
  }, [auditorPermitExpirationInput])

  const loadBackendOperatorOutputs = useCallback(async () => {
    if (!organization.exists) return

    setIsBackendReportLoading(true)
    setBackendReportError(null)

    try {
      const backend = getCipherRollBackendClient()
      const status = await backend.getStatus()
      const report = await backend.getOrganizationReportSummary(orgId)
      const treasuryExposure = await backend.getTreasuryExposureSummary(orgId)
      const notifications = await backend.getNotifications({
        orgId,
        limit: 8,
        category: backendNotificationCategory === 'all' ? undefined : backendNotificationCategory
      })
      const activeRuns = await backend.getOrganizationRuns(orgId, { status: 2, limit: 5 })
      const pendingClaims = await backend.getOrganizationPayments(orgId, { claimState: 'pending', limit: 5 })
      const pendingFinalizations = await backend.getOrganizationPayments(orgId, { settlementState: 'requested', limit: 5 })

      setBackendStatus(status)
      setBackendReport(report)
      setBackendTreasuryExposure(treasuryExposure)
      setBackendNotifications(notifications)
      setBackendActiveRuns(activeRuns)
      setBackendPendingClaims(pendingClaims)
      setBackendPendingFinalizations(pendingFinalizations)
    } catch (error) {
      const message = extractCipherRollErrorMessage(error)
      setBackendReportError(message)
    } finally {
      setIsBackendReportLoading(false)
    }
  }, [backendNotificationCategory, orgId, organization.exists])

  const loadBatchPayrollManifests = useCallback(async () => {
    if (!organization.exists) {
      setBatchPayrollManifests([])
      return
    }

    try {
      const backend = getCipherRollBackendClient()
      const manifests = await backend.getBatchPayrollManifests(orgId, selectedPayrollRunId)
      setBatchPayrollManifests(manifests)
    } catch {
      setBatchPayrollManifests([])
    }
  }, [orgId, organization.exists, selectedPayrollRunId])

  const loadGovernanceState = useCallback(async () => {
    if (!provider || !organization.exists || !governanceConfigured || !isTargetChain) {
      setGovernanceOverview(null)
      setGovernanceAdmins([])
      setGovernanceProposals([])
      setGovernanceLinkedAddress('')
      setGovernanceError(null)
      return
    }

    setIsGovernanceLoading(true)
    setGovernanceError(null)

    try {
      const payrollContract = getCipherRollContract(signer ?? provider)
      const governanceContract = getCipherRollGovernanceContract(signer ?? provider)

      const [linkedExecutor, governance, admins, proposalIds] = await Promise.all([
        payrollContract.getOrganizationGovernanceExecutor(orgId),
        governanceContract.getOrganizationGovernance(orgId),
        governanceContract.getOrganizationAdmins(orgId).catch(() => [] as string[]),
        governanceContract.getOrganizationGovernanceProposalIds(orgId).catch(() => [] as string[])
      ])

      setGovernanceLinkedAddress(linkedExecutor)
      setGovernanceOverview({
        primaryAdmin: String(governance.primaryAdmin ?? ''),
        maxAdmins: Number(governance.maxAdmins ?? 0),
        quorum: Number(governance.quorum ?? 0),
        adminCount: Number(governance.adminCount ?? 0),
        nonce: Number(governance.nonce ?? 0),
        initialized: Boolean(governance.initialized)
      })
      setGovernanceAdmins(admins)

      const proposalEntries = await Promise.all(
        [...proposalIds].reverse().slice(0, 18).map(async (proposalId) => {
          const proposal = await governanceContract.getGovernanceProposal(proposalId)
          const approvedByCurrentAdmin =
            address
              ? await governanceContract.hasApprovedGovernanceProposal(proposalId, address).catch(() => false)
              : false

          const actionType = Number(proposal.actionType ?? 0)

          return {
            proposalId: String(proposalId),
            orgId: String(proposal.orgId ?? ''),
            actionType,
            actionLabel: governanceActionLabelsByType[actionType] ?? `Action ${actionType}`,
            payload: String(proposal.payload ?? '0x'),
            proposer: String(proposal.proposer ?? ''),
            createdAt: Number(proposal.createdAt ?? 0),
            expiresAt: Number(proposal.expiresAt ?? 0),
            approvalCount: Number(proposal.approvalCount ?? 0),
            executed: Boolean(proposal.executed),
            cancelled: Boolean(proposal.cancelled),
            approvedByCurrentAdmin,
            requiresWalletExecutor: governanceWalletActionTypes.has(actionType)
          } satisfies GovernanceProposalRecord
        })
      )

      setGovernanceProposals(proposalEntries)
      if (governance.initialized) {
        setNextGovernanceQuorum(String(Number(governance.quorum ?? 0) || 2))
      }
    } catch (error) {
      setGovernanceOverview(null)
      setGovernanceAdmins([])
      setGovernanceProposals([])
      setGovernanceLinkedAddress('')
      setGovernanceError(extractCipherRollErrorMessage(error))
    } finally {
      setIsGovernanceLoading(false)
    }
  }, [address, governanceConfigured, isTargetChain, orgId, organization.exists, provider, signer])

  useEffect(() => {
    if (!organization.exists) {
      setBackendReport(null)
      setBackendNotifications([])
      setBackendStatus(null)
      setBackendActiveRuns([])
      setBackendPendingClaims([])
      setBackendPendingFinalizations([])
      setBatchPayrollManifests([])
      setBackendReportError(null)
      return
    }

    if (activePortal !== 'overview' && activePortal !== 'auditor' && activePortal !== 'governance') {
      return
    }

    void loadBackendOperatorOutputs()
  }, [activePortal, organization.exists, loadBackendOperatorOutputs])

  useEffect(() => {
    if (!organization.exists || !governanceConfigured) {
      setGovernanceOverview(null)
      setGovernanceAdmins([])
      setGovernanceProposals([])
      setGovernanceLinkedAddress('')
      setGovernanceError(null)
      return
    }

    if (activePortal !== 'overview' && activePortal !== 'governance') {
      return
    }

    void loadGovernanceState()
  }, [activePortal, governanceConfigured, loadGovernanceState, organization.exists])

  useEffect(() => {
    if (activePortal !== 'payroll') return
    void loadBatchPayrollManifests()
  }, [activePortal, loadBatchPayrollManifests])
  const vestingWindowInvalid = Boolean(
    payrollMode === 'vesting' &&
    (!vestingStartTimestamp || !vestingEndTimestamp || vestingEndTimestamp <= vestingStartTimestamp)
  )
  const availableBudgetInWei = useMemo(
    () => parseDecimalAmountToWei(summaryValues.available ?? ''),
    [summaryValues.available]
  )
  const canReadState = Boolean(provider && isConfigured && isTargetChain)
  const canSubmitTransactions = Boolean(signer && isConfigured && isTargetChain)
  const canEncryptInputs = Boolean(canSubmitTransactions && cofheReady)
  const governanceInitialized = Boolean(governanceOverview?.initialized)
  const governanceQuorum = governanceOverview?.quorum ?? 0
  const governanceAdminCount = governanceOverview?.adminCount ?? 0
  const governanceActive = Boolean(
    governanceOverview?.initialized &&
    governanceQuorum > 1 &&
    governanceAdminCount >= governanceQuorum &&
    governanceLinkedAddress &&
    GOVERNANCE_CONTRACT_ADDRESS &&
    governanceLinkedAddress.toLowerCase() === GOVERNANCE_CONTRACT_ADDRESS.toLowerCase()
  )
  const connectedWalletIsGovernanceAdmin = Boolean(
    address && governanceAdmins.some((admin) => admin.toLowerCase() === address.toLowerCase())
  )
  const workspaceOwnedByAnotherAdmin = Boolean(
    organization.exists &&
    address &&
    !isAdmin &&
    !connectedWalletIsGovernanceAdmin
  )
  const bootstrapAdminSafeAddress = useMemo(() => safeAddress(bootstrapAdminAddress) ?? '', [bootstrapAdminAddress])
  const newGovernanceAdminSafeAddress = useMemo(() => safeAddress(newGovernanceAdminAddress) ?? '', [newGovernanceAdminAddress])
  const governanceAdminToRemoveSafeAddress = useMemo(() => safeAddress(governanceAdminToRemove) ?? '', [governanceAdminToRemove])
  const nextGovernanceQuorumValue = useMemo(() => {
    if (!nextGovernanceQuorum.trim()) return null
    const parsed = Number.parseInt(nextGovernanceQuorum, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [nextGovernanceQuorum])
  const payrollRunExists = payrollRun.exists && payrollRun.orgId === orgId
  const payrollRunStatusLabel = payrollRunExists
    ? ['Draft', 'Funded', 'Active', 'Finalized'][payrollRun.status] ?? 'Unknown'
    : 'Not created'
  const payrollRunOpenForAllocations = payrollRunExists && payrollRun.status < 2
  const payrollRunRemainingAllocationSlots = payrollRunOpenForAllocations
    ? Math.max(0, Number(payrollRun.plannedHeadcount) - Number(payrollRun.allocationCount))
    : 0
  const payrollRunClaimable = payrollRunExists && payrollRun.status === 2
  const treasuryAvailableFunds = useMemo(
    () => parseDecimalAmountToWei(treasuryAdapterDetails.availablePayrollFunds ?? ''),
    [treasuryAdapterDetails.availablePayrollFunds]
  )
  const treasuryAvailableFundsDisplay = useMemo(
    () => formatTreasuryTokenAmount(treasuryAdapterDetails.availablePayrollFunds),
    [treasuryAdapterDetails.availablePayrollFunds]
  )
  const treasuryReservedFundsDisplay = useMemo(
    () => formatTreasuryTokenAmount(treasuryAdapterDetails.reservedPayrollFunds),
    [treasuryAdapterDetails.reservedPayrollFunds]
  )
  const auditorPermitExpiresSoon = Boolean(
    auditorPermitExpirationTimestamp && auditorPermitExpirationTimestamp <= Math.floor(Date.now() / 1000) + 3600
  )
  const hasTreasuryRoute = Boolean(
    treasuryAdapterDetails.adapter &&
    treasuryAdapterDetails.adapter !== '0x0000000000000000000000000000000000000000'
  )
  useEffect(() => {
    if (organization.exists || showAdvancedWorkspaceSettings || orgIdInput !== DEFAULT_ORG_ID) return

    const storageKey = 'cipherroll-admin-generated-org-label'
    const stored = localStorage.getItem(storageKey)
    const nextLabel = stored || makeHighEntropyLabel('org', workspaceName.trim() || 'cipherroll-workspace')
    localStorage.setItem(storageKey, nextLabel)
    setOrgIdInput(nextLabel)
  }, [orgIdInput, organization.exists, showAdvancedWorkspaceSettings, workspaceName])

  useEffect(() => {
    if (hasTreasuryRoute || showAdvancedTreasurySettings || treasuryRouteLabel !== 'cipherroll-wrapper-route') return

    const storageKey = `cipherroll-admin-generated-route-label-${treasuryRouteMode}`
    const stored = localStorage.getItem(storageKey)
    const nextLabel = stored || makeHighEntropyLabel('route', treasuryRouteMode)
    localStorage.setItem(storageKey, nextLabel)
    setTreasuryRouteLabel(nextLabel)
  }, [hasTreasuryRoute, showAdvancedTreasurySettings, treasuryRouteLabel, treasuryRouteMode])
  const canConfigureTreasuryRoute = Boolean(
    selectedTreasuryAdapterAddress &&
    selectedTreasuryAdapterAddress !== '0x0000000000000000000000000000000000000000'
  )
  const payrollSettlementAssetId = useMemo(
    () => makeHighEntropyBytes32Label('settlement-asset', hasTreasuryRoute ? treasuryRouteMode : 'cipherroll-payroll'),
    [hasTreasuryRoute, treasuryRouteMode]
  )
  const payrollWouldZeroOut = Boolean(
    paymentAmountInWei !== null &&
    availableBudgetInWei !== null &&
    paymentAmountInWei > availableBudgetInWei
  )
  const batchRoleBySlug = useMemo(
    () => new Map(batchPayrollRoles.map((role) => [role.slug, role])),
    [batchPayrollRoles]
  )
  const batchPayrollValidation = useMemo(() => {
    return batchPayrollRows.map((row) => {
      const role = batchRoleBySlug.get(row.roleSlug)
      const isSealedRow = Boolean(row.encryptedAmount)
      const amount = row.amount.trim() || role?.baseSalary.trim() || ''
      const amountInWei = parseDecimalAmountToWei(amount)
      const employee = safeAddress(row.employeeAddress)
      const errors: string[] = []

      if (!employee) errors.push('Invalid employee address.')
      if (!role) errors.push('Unknown role.')
      if (!isSealedRow && !amount.trim()) errors.push('Missing salary.')
      if (!isSealedRow && amount.trim() && amountInWei === null) errors.push('Invalid salary amount.')

      return {
        id: row.id,
        employee,
        role,
        amount,
        amountInWei,
        errors
      }
    })
  }, [batchPayrollRows, batchRoleBySlug])
  const batchPayrollHasErrors = batchPayrollValidation.some((item) => item.errors.length > 0)
  const batchPayrollReadyRows = batchPayrollRows.filter((row) => row.status === 'sealed' || row.status === 'failed')
  const batchPayrollSubmittableRows = batchPayrollReadyRows.filter((row) => row.encryptedAmount && row.paymentId && row.memoHash)
  const batchPayrollConfirmedRows = batchPayrollRows.filter((row) => row.status === 'confirmed')
  const batchPayrollVisibleTotal = useMemo(() => {
    if (batchPayrollStage === 'sealed') return 'Sealed'
    const total = batchPayrollValidation.reduce((sum, item) => {
      return item.amountInWei == null ? sum : sum + item.amountInWei
    }, 0n)
    return formatTreasuryTokenAmount(total.toString())
  }, [batchPayrollStage, batchPayrollValidation])
  const suggestedPayrollAmountDisplay = useMemo(() => {
    const batchTotal = batchPayrollValidation.reduce((sum, item) => {
      return item.amountInWei == null ? sum : sum + item.amountInWei
    }, 0n)
    const estimate = batchTotal > 0n ? batchTotal : paymentAmountInWei
    return estimate && estimate > 0n ? formatTreasuryTokenAmount(estimate.toString()) : null
  }, [batchPayrollValidation, paymentAmountInWei])

  useEffect(() => {
    if (!suggestedPayrollAmountDisplay) return

    const previousSuggestion = lastSuggestedPayrollAmountRef.current
    setPayrollFundingAmount((current) => (current.trim() === '' || current === '8' || current === previousSuggestion ? suggestedPayrollAmountDisplay : current))
    setTreasuryDepositAmount((current) => (current.trim() === '' || current === '8' || current === previousSuggestion ? suggestedPayrollAmountDisplay : current))
    setBudgetAmount((current) => (current.trim() === '' || current === '25.5' || current === previousSuggestion ? suggestedPayrollAmountDisplay : current))
    lastSuggestedPayrollAmountRef.current = suggestedPayrollAmountDisplay
  }, [suggestedPayrollAmountDisplay])

  const portalTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'setup', label: 'Workspace' },
    { id: 'budget', label: 'Add Budget' },
    { id: 'payroll', label: 'Payroll' },
    { id: 'governance', label: 'Multi-Admin' },
    { id: 'auditor', label: 'Auditor Access' }
  ] as const satisfies ReadonlyArray<{
    id: AdminPortal
    label: string
  }>

  const clearSummaries = useCallback(() => {
    setSummaryHandles(null)
    setSummaryValues({
      budget: null,
      committed: null,
      available: null
    })
  }, [])

  const clearInsights = useCallback(() => {
    setOrganizationInsights(defaultOrganizationInsights)
  }, [])

  const clearTreasuryAdapter = useCallback(() => {
    setTreasuryAdapterDetails(defaultTreasuryAdapter)
  }, [])

  const clearPayrollRun = useCallback(() => {
    setPayrollRun(defaultPayrollRun)
  }, [])

  const loadPayrollRun = useCallback(async () => {
    if (!provider || !organization.exists || !isConfigured || !isTargetChain || !selectedPayrollRunInput.trim()) {
      clearPayrollRun()
      return
    }

    try {
      const contract = getCipherRollContract(signer ?? provider)
      const nextPayrollRun = await contract.getPayrollRun(selectedPayrollRunId)
      setPayrollRun(nextPayrollRun)
    } catch {
      clearPayrollRun()
    }
  }, [
    clearPayrollRun,
    isConfigured,
    isTargetChain,
    organization.exists,
    provider,
    selectedPayrollRunId,
    selectedPayrollRunInput,
    signer
  ])

  const loadOrganization = useCallback(async (reason: 'auto' | 'manual' | 'post-action' = 'manual') => {
    if (!provider) {
      clearSummaries()
      clearInsights()
      clearTreasuryAdapter()
      clearPayrollRun()
      setOrganization(defaultOrganization)
      setRefreshError('Connect an injected wallet to load the organization state.')
      return
    }

    if (!isConfigured) {
      clearSummaries()
      clearInsights()
      clearTreasuryAdapter()
      clearPayrollRun()
      setOrganization(defaultOrganization)
      setRefreshError('Set NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS before using the admin portal.')
      return
    }

    if (!isTargetChain) {
      clearSummaries()
      clearInsights()
      clearTreasuryAdapter()
      clearPayrollRun()
      setOrganization(defaultOrganization)
      setRefreshError(`Switch the wallet to ${TARGET_CHAIN_NAME} before refreshing organization state.`)
      return
    }

    setIsRefreshing(true)
    setRefreshError(null)

    try {
      const contract = getCipherRollContract(signer ?? provider)
      const org = await contract.getOrganization(orgId)

      const nextOrg: OrganizationView = {
        admin: org.admin,
        treasuryAdapter: org.treasuryAdapter,
        metadataHash: org.metadataHash,
        treasuryRouteId: org.treasuryRouteId,
        reservedAdminSlots: Number(org.reservedAdminSlots),
        reservedQuorum: Number(org.reservedQuorum),
        createdAt: Number(org.createdAt),
        updatedAt: Number(org.updatedAt),
        exists: org.exists
      }

      setOrganization(nextOrg)
      if (nextOrg.treasuryAdapter) {
        const nextAdapterLower = nextOrg.treasuryAdapter.toLowerCase()
        if (
          WRAPPER_SETTLEMENT_ADAPTER_ADDRESS &&
          nextAdapterLower === WRAPPER_SETTLEMENT_ADAPTER_ADDRESS.toLowerCase()
        ) {
          setTreasuryRouteMode('wrapper')
        } else if (
          DIRECT_SETTLEMENT_ADAPTER_ADDRESS &&
          nextAdapterLower === DIRECT_SETTLEMENT_ADAPTER_ADDRESS.toLowerCase()
        ) {
          setTreasuryRouteMode('direct')
        }
      }
      clearSummaries()
      clearInsights()
      clearTreasuryAdapter()
      clearPayrollRun()

      if (nextOrg.exists && nextOrg.treasuryAdapter && nextOrg.treasuryAdapter !== '0x0000000000000000000000000000000000000000') {
        try {
          const nextTreasuryAdapter = await contract.getTreasuryAdapterDetails(orgId)
          setTreasuryAdapterDetails(nextTreasuryAdapter)
        } catch {
          setTreasuryAdapterDetails(defaultTreasuryAdapter)
        }
      }

      if (!nextOrg.exists) {
        const detail = 'No workspace exists for the current organization id yet. Create it first, then refresh again.'
        setSurfaceStatus({
          tone: reason === 'post-action' ? 'success' : 'info',
          title: 'Workspace not created yet',
          detail
        })
      } else if (address && nextOrg.admin.toLowerCase() === address.toLowerCase()) {
        try {
          const nextInsights = await contract.getOrganizationInsights(orgId)
          setOrganizationInsights(nextInsights)
        } catch {
          setOrganizationInsights(defaultOrganizationInsights)
        }

        if (signer && cofheReady) {
          const nextHandles = await contract.getAdminBudgetHandles(orgId)
          setSummaryHandles(nextHandles)

          const [budgetValue, committedValue, availableValue] = await Promise.all([
            decryptUint128ForView(nextHandles.budget),
            decryptUint128ForView(nextHandles.committed),
            decryptUint128ForView(nextHandles.available)
          ])

          setSummaryValues({
            budget: budgetValue,
            committed: committedValue,
            available: availableValue
          })

          setSurfaceStatus({
            tone: 'success',
            title: 'Organization state refreshed',
            detail: 'Workspace details, payroll counts, and private budget info loaded successfully.'
          })
        } else {
          setSurfaceStatus({
            tone: 'info',
            title: 'Workspace loaded',
            detail: 'Payroll counts are available now. Turn on secure view to see private budget details.'
          })
        }
      } else if (address && nextOrg.exists && nextOrg.admin.toLowerCase() !== address.toLowerCase()) {
        setSurfaceStatus({
          tone: 'info',
          title: 'Connected wallet is not the primary admin',
          detail: 'Workspace info loaded. Budget details still require the main admin wallet, or a linked multi-admin signer once setup is complete.'
        })
      }

      setLastRefreshedAt(Date.now())
    } catch (error) {
      const message = extractCipherRollErrorMessage(error)
      clearSummaries()
      clearInsights()
      clearTreasuryAdapter()
      clearPayrollRun()
      setRefreshError(message)
      setSurfaceStatus({
        tone: 'error',
        title: 'Organization refresh failed',
        detail: message
      })

      if (reason !== 'auto') {
        toast.error(message)
      }
    } finally {
      setIsRefreshing(false)
    }
  }, [
    address,
    clearSummaries,
    clearInsights,
    clearTreasuryAdapter,
    clearPayrollRun,
    cofheReady,
    isConfigured,
    isTargetChain,
    orgId,
    provider,
    signer
  ])

  const refreshWorkspaceState = useCallback(async (reason: 'auto' | 'manual' | 'post-action' = 'manual') => {
    await loadOrganization(reason)
    await loadPayrollRun()
  }, [loadOrganization, loadPayrollRun])

  const loadAuditorPermits = useCallback(() => {
    if (!address || !chainId) {
      setAuditorSharingPermits([])
      return
    }

    const permits = getAuditorSharingPermits(chainId, address).filter(
      (permit) => permit.issuer.toLowerCase() === address.toLowerCase()
    )

    setAuditorSharingPermits(permits)
  }, [address, chainId])

  useEffect(() => {
    void refreshWorkspaceState('auto')
  }, [refreshWorkspaceState])

  useEffect(() => {
    loadAuditorPermits()
  }, [loadAuditorPermits])

  const initializeCofhe = async () => {
    if (!signer) {
      toast.error('Connect the admin wallet from the top navigation first.')
      return
    }

    if (!isTargetChain) {
      toast.error(`Switch the wallet to ${TARGET_CHAIN_NAME} before enabling privacy mode.`)
      return
    }

    setSurfaceStatus({
      tone: 'info',
      title: 'Setting up secure view',
      detail: 'Approve the wallet prompts to set up secure viewing.'
    })

    try {
      const provider = (window as any).ethereum || signer.provider
      await initCofhe(provider)
      setCofheReady(true)
      setSurfaceStatus({
        tone: 'success',
        title: 'Secure view ready',
        detail: 'You can now view encrypted budget and payroll details securely in your browser.'
      })
      toast.success('Secure view enabled for this admin wallet.')
      await refreshWorkspaceState('post-action')
    } catch (error: any) {
      const message = extractCipherRollErrorMessage(error)
      setSurfaceStatus({
        tone: 'error',
        title: 'Secure view setup failed',
        detail: message
      })
      toast.error(message)
    }
  }

  const withTransaction = useCallback(async (
    actionTitle: string,
    awaitingMessage: string,
    successMessage: string,
    work: () => Promise<{ hash?: string | null; wait: () => Promise<unknown> }>
  ) => {
    setIsBusy(true)

    try {
      setSurfaceStatus({
        tone: 'info',
        title: actionTitle,
        detail: awaitingMessage
      })

      let tx: { hash?: string | null; wait: () => Promise<unknown> }
      try {
        tx = await work()
      } catch (error) {
        if (!isRetryableWalletFeeError(error)) {
          throw error
        }

        setSurfaceStatus({
          tone: 'info',
          title: `${actionTitle} fee refreshed`,
          detail: 'The wallet fee quote changed before submission. Reopening the wallet prompt with fresh network pricing...'
        })
        toast.info('Refreshing the wallet fee quote. Please approve the new prompt.')
        await new Promise((resolve) => setTimeout(resolve, 900))
        tx = await work()
      }

      setSurfaceStatus({
        tone: 'info',
        title: `${actionTitle} submitted`,
        detail: 'Transaction broadcast to the network. Waiting for confirmation...',
        txHash: tx.hash ?? null
      })

      await tx.wait()
      await refreshWorkspaceState('post-action')
      if (governanceConfigured) {
        await loadGovernanceState()
      }
      setSurfaceStatus({
        tone: 'success',
        title: actionTitle,
        detail: successMessage,
        txHash: tx.hash ?? null
      })
      toast.success(successMessage)
    } catch (error: any) {
      const message = extractCipherRollErrorMessage(error)
      console.error(error)
      setSurfaceStatus({
        tone: 'error',
        title: `${actionTitle} failed`,
        detail: message
      })
      toast.error(message)
    } finally {
      setIsBusy(false)
    }
  }, [governanceConfigured, loadGovernanceState, refreshWorkspaceState])

  const findMatchingGovernanceProposal = useCallback(
    (actionType: number, payload: string) => {
      const now = Math.floor(Date.now() / 1000)
      return governanceProposals.find(
        (proposal) =>
          proposal.actionType === actionType &&
          proposal.payload.toLowerCase() === payload.toLowerCase() &&
          !proposal.executed &&
          !proposal.cancelled &&
          proposal.expiresAt > now
      )
    },
    [governanceProposals]
  )

  const handleGovernedAction = useCallback(
    async ({
      actionKey,
      payload,
      actionTitle,
      proposalSummary,
      directExecute,
      onExecuted
    }: {
      actionKey: GovernanceActionKey
      payload: string
      actionTitle: string
      proposalSummary: string
      directExecute?: () => Promise<{ hash?: string | null; wait: () => Promise<unknown> }>
      onExecuted?: () => void
    }) => {
      if (!canSubmitTransactions || !signer || !address) {
        toast.error(`Connect the admin wallet and switch to ${TARGET_CHAIN_NAME} before using governance.`)
        return
      }

      if (!governanceConfigured) {
        toast.error('This frontend does not have NEXT_PUBLIC_CIPHERROLL_GOVERNANCE_ADDRESS configured yet.')
        return
      }

      if (!governanceInitialized) {
        toast.error('Set up multi-admin first before routing sensitive actions through multi-admin approval.')
        return
      }

      if (!connectedWalletIsGovernanceAdmin) {
        toast.error('Only a registered admin can create, approve, or execute this action.')
        return
      }

      const definition = governanceActionDefinitions[actionKey]
      const governanceContract = getCipherRollGovernanceContract(signer)
      const existingProposal = findMatchingGovernanceProposal(definition.type, payload)

      if (
        governanceOverview &&
        governanceOverview.quorum > 1 &&
        governanceOverview.adminCount >= governanceOverview.quorum &&
        !governanceActive
      ) {
        toast.error('Link the payroll workspace to the configured multi-admin contract before relying on approval rules.')
        return
      }

      if (!existingProposal) {
        const expiresAt = Math.floor(Date.now() / 1000) + 3600
        await withTransaction(
          `${actionTitle} proposal`,
          'Approve the wallet transaction to propose this action for multi-admin approval.',
          `${proposalSummary} A matching proposal is now waiting for the remaining admin approvals.`,
          async () => governanceContract.proposeGovernanceAction(orgId, definition.type, payload, expiresAt)
        )
        return
      }

      if (!existingProposal.approvedByCurrentAdmin) {
        await withTransaction(
          `${actionTitle} approval`,
          'Approve the wallet transaction to add your approval to this proposal.',
          `${proposalSummary} Your approval has been recorded.`,
          async () => governanceContract.approveGovernanceProposal(existingProposal.proposalId)
        )
        return
      }

      if (existingProposal.approvalCount < governanceQuorum) {
        setSurfaceStatus({
          tone: 'info',
          title: `${actionTitle} waiting for approvals`,
          detail: `This proposal currently has ${existingProposal.approvalCount}/${governanceQuorum} approvals. Ask another registered admin to confirm the same action.`
        })
        toast.info(`Waiting for approvals: ${existingProposal.approvalCount}/${governanceQuorum} approvals collected.`)
        return
      }

      if (definition.requiresWalletExecutor) {
        if (!directExecute) {
          toast.error('This governed action still needs a wallet-executed payroll transaction, but no execution handler was provided.')
          return
        }

        if (existingProposal.proposer.toLowerCase() !== address.toLowerCase()) {
          setSurfaceStatus({
            tone: 'info',
            title: `${actionTitle} ready for proposer execution`,
            detail: `Quorum is met, but the admin who opened this proposal (${shortHash(existingProposal.proposer)}) must submit the final encrypted payroll transaction from their wallet.`
          })
          toast.info('Enough admins have approved. The proposing admin must submit the final wallet transaction.')
          return
        }

        await withTransaction(
          actionTitle,
          'Approve the final wallet transaction to carry out the approved payroll action.',
          `${proposalSummary} The approved action has been carried out successfully.`,
          directExecute
        )
        onExecuted?.()
        return
      }

      await withTransaction(
        `${actionTitle} execution`,
        'Approve the wallet transaction to carry out this approved action.',
        `${proposalSummary} The approved action was carried out successfully.`,
        async () => governanceContract.executeGovernanceProposal(existingProposal.proposalId)
      )
      onExecuted?.()
    },
    [
      address,
      canSubmitTransactions,
      connectedWalletIsGovernanceAdmin,
      findMatchingGovernanceProposal,
      governanceActive,
      governanceConfigured,
      governanceInitialized,
      governanceOverview,
      governanceQuorum,
      orgId,
      signer,
      withTransaction
    ]
  )

  const bootstrapGovernance = async () => {
    if (!canSubmitTransactions || !signer) {
      toast.error(`Connect the admin wallet and switch to ${TARGET_CHAIN_NAME} before bootstrapping governance.`)
      return
    }

    if (!organization.exists) {
      toast.error('Create the workspace first before setting up multi-admin.')
      return
    }

    await withTransaction(
      'Set up multi-admin',
      'Approve the wallet transaction to set up multi-admin approval for this workspace.',
      'Multi-admin set up. Add the remaining admin(s) and link to payroll next.',
      async () => getCipherRollGovernanceContract(signer).bootstrapOrganization(orgId)
    )
  }

  const bootstrapGovernanceAdmin = async () => {
    if (!bootstrapAdminSafeAddress) {
      toast.error('Enter a valid wallet address for the admin.')
      return
    }

    await withTransaction(
      'Add admin',
      'Approve the wallet transaction to add the next admin before the approval rules become active.',
      'Admin added. Once enough admins are registered, link payroll to enforce multi-admin approvals.',
      async () => getCipherRollGovernanceContract(signer!).bootstrapOrganizationAdmin(orgId, bootstrapAdminSafeAddress)
    )
  }

  const linkGovernanceExecutor = async () => {
    if (!canSubmitTransactions || !signer) {
      toast.error(`Connect the admin wallet and switch to ${TARGET_CHAIN_NAME} before linking governance.`)
      return
    }

    if (!governanceConfigured) {
      toast.error('NEXT_PUBLIC_CIPHERROLL_GOVERNANCE_ADDRESS is not configured in this frontend.')
      return
    }

    await withTransaction(
      'Link to multi-admin',
      'Approve the wallet transaction to route sensitive payroll actions through multi-admin approval.',
      'Payroll linked to multi-admin approval for treasury changes and payroll issuance.',
      async () => getCipherRollContract(signer).configureOrganizationGovernanceExecutor(orgId, GOVERNANCE_CONTRACT_ADDRESS)
    )
  }

  const proposeGovernanceAdminAddition = async () => {
    if (!newGovernanceAdminSafeAddress) {
      toast.error('Enter a valid wallet address before proposing a new admin.')
      return
    }

    const payload = abiCoder.encode(['address'], [newGovernanceAdminSafeAddress])
    await handleGovernedAction({
      actionKey: 'add_admin',
      payload,
      actionTitle: 'Add admin (requires approval)',
      proposalSummary: 'The admin change was routed through multi-admin approval.'
    })
  }

  const proposeGovernanceAdminRemoval = async () => {
    if (!governanceAdminToRemoveSafeAddress) {
      toast.error('Enter a valid wallet address before proposing an admin removal.')
      return
    }

    const payload = abiCoder.encode(['address'], [governanceAdminToRemoveSafeAddress])
    await handleGovernedAction({
      actionKey: 'remove_admin',
      payload,
      actionTitle: 'Remove admin (requires approval)',
      proposalSummary: 'The admin change was routed through multi-admin approval.'
    })
  }

  const proposeGovernanceQuorumUpdate = async () => {
    if (nextGovernanceQuorumValue === null) {
      toast.error('Enter a valid approval threshold before proposing the update.')
      return
    }

    const payload = abiCoder.encode(['uint64'], [nextGovernanceQuorumValue])
    await handleGovernedAction({
      actionKey: 'update_quorum',
      payload,
      actionTitle: 'Update approval threshold',
      proposalSummary: 'The approval threshold change was routed through multi-admin approval.'
    })
  }

  const approveGovernanceProposal = async (proposalId: string) => {
    await withTransaction(
      'Multi-admin approval',
      'Approve the wallet transaction to add your approval to this proposal.',
      'Approval recorded.',
      async () => getCipherRollGovernanceContract(signer!).approveGovernanceProposal(proposalId)
    )
  }

  const revokeGovernanceProposalApproval = async (proposalId: string) => {
    await withTransaction(
      'Withdraw approval',
      'Approve the wallet transaction to revoke your approval from this governance proposal.',
      'Approval revoked.',
      async () => getCipherRollGovernanceContract(signer!).revokeGovernanceApproval(proposalId)
    )
  }

  const executeGovernanceProposal = async (proposalId: string) => {
    await withTransaction(
      'Execute approved action',
      'Approve the wallet transaction to carry out this approved action.',
      'Action carried out successfully.',
      async () => getCipherRollGovernanceContract(signer!).executeGovernanceProposal(proposalId)
    )
  }

  const createAuditorPermit = async () => {
    if (!canSubmitTransactions) {
      toast.error(`Connect the admin wallet and switch to ${TARGET_CHAIN_NAME} before creating an auditor sharing permit.`)
      return
    }

    if (!cofheReady) {
      toast.error('Turn on secure view first so the auditor access code can be created.')
      return
    }

    if (!organization.exists) {
      toast.error('Create the workspace first so the disclosure scope matches a real organization.')
      return
    }

    if (!isAdmin) {
      toast.error('Only the workspace admin can create auditor access codes.')
      return
    }

    if (!auditorRecipientSafeAddress) {
      toast.error('Enter a valid auditor wallet address before creating the access code.')
      return
    }

    if (!auditorPermitExpirationTimestamp || auditorPermitExpirationTimestamp <= Math.floor(Date.now() / 1000)) {
      toast.error('Choose a future expiration date for the auditor access.')
      return
    }

    setIsBusy(true)
    try {
      setSurfaceStatus({
        tone: 'info',
        title: 'Creating auditor access code',
        detail: 'Approve the wallet signature to create an access code for the auditor.'
      })

      const { exportPayload, permitView } = await createAuditorSharingPermit({
        issuer: address!,
        recipient: auditorRecipientSafeAddress,
        name: auditorPermitName.trim() || `CipherRoll auditor share for ${auditorName.trim() || 'auditor'}`,
        expiration: auditorPermitExpirationTimestamp
      })

      setAuditorExportPayload(exportPayload)
      setAuditorSharingPermits((current) =>
        [permitView, ...current.filter((permit) => permit.hash !== permitView.hash)].sort(
          (left, right) => right.expiration - left.expiration
        )
      )
      setSurfaceStatus({
        tone: 'success',
        title: 'Auditor access code created',
        detail: 'The access code is ready to copy and share with the auditor.'
      })
      toast.success('Auditor sharing payload created. Copy it from the panel before handing it to the auditor.')
    } catch (error) {
      const message = extractCipherRollErrorMessage(error)
      setSurfaceStatus({
        tone: 'error',
        title: 'Auditor access setup failed',
        detail: message
      })
      toast.error(message)
    } finally {
      setIsBusy(false)
    }
  }

  const copyAuditorPayload = async (payload: string) => {
    if (!payload) {
      toast.error('Create or select an auditor access code first.')
      return
    }

    try {
      await navigator.clipboard.writeText(payload)
      toast.success('Auditor access code copied.')
    } catch {
      toast.error('Clipboard copy failed in this browser. You can still copy the code manually.')
    }
  }

  const deleteAuditorPermit = (hash: string) => {
    if (!address || !chainId) {
      return
    }

    removeAuditorSharingPermit(hash, chainId, address)
    const nextPermits = getAuditorSharingPermits(chainId, address).filter(
      (permit) => permit.issuer.toLowerCase() === address.toLowerCase()
    )
    setAuditorSharingPermits(nextPermits)
    if (auditorExportPayload && !nextPermits.some((permit) => permit.exportPayload === auditorExportPayload)) {
      setAuditorExportPayload('')
    }
    toast.success('Auditor access code removed from this browser.')
  }

  const createOrganization = async () => {
    if (!canSubmitTransactions) {
      toast.error(`Connect the admin wallet and switch to ${TARGET_CHAIN_NAME} before creating a workspace.`)
      return
    }

    if (organization.exists) {
      toast.error('This workspace already exists for the current workspace ID.')
      return
    }

    if (!workspaceName.trim()) {
      toast.error('Enter a workspace name before creating the organization.')
      return
    }

    await withTransaction(
      'Create workspace',
      'Approve the wallet transaction to create your workspace.',
      'Workspace created successfully.',
      async () => {
      const contract = getCipherRollContract(signer!)
      return contract.createOrganization(
        orgId,
        makeHighEntropyBytes32Label('workspace', workspaceName.trim() || 'CipherRoll Core'),
        3,
        2
      )
      }
    )
  }

  const configureTreasuryRoute = async () => {
    if (!canSubmitTransactions) {
      toast.error(`Connect the admin wallet and switch to ${TARGET_CHAIN_NAME} before configuring treasury settlement.`)
      return
    }

    if (!organization.exists) {
      toast.error('Create the workspace first, then set up the payout route.')
      return
    }

    if (!isAdmin && !governanceActive) {
      toast.error('Only the workspace admin can set up the payout route.')
      return
    }

    if (!treasuryRouteLabel.trim()) {
      toast.error('Enter a route label before setting up the payout route.')
      return
    }

    if (!canConfigureTreasuryRoute) {
      toast.error('The payout route address is not configured for the selected route.')
      return
    }

    if (governanceActive) {
      const payload = abiCoder.encode(['address', 'bytes32'], [selectedTreasuryAdapterAddress, treasuryRouteId])
      await handleGovernedAction({
        actionKey: 'configure_treasury',
        payload,
        actionTitle: 'Set up payout route',
        proposalSummary:
          treasuryRouteMode === 'wrapper'
            ? 'The treasury route change was routed through multi-admin approval.'
            : 'The direct route change was routed through multi-admin approval.'
      })
      return
    }

    await withTransaction(
      'Set up payout route',
      'Approve the wallet transaction to set up the selected payout route for this workspace.',
      treasuryRouteMode === 'wrapper'
        ? 'Two-step payout route configured.'
        : 'Direct payout route configured.',
      async () => {
        const contract = getCipherRollContract(signer!)
        return contract.configureTreasury(orgId, selectedTreasuryAdapterAddress, treasuryRouteId)
      }
    )
  }

  const depositBudget = async () => {
    if (!canEncryptInputs) {
      toast.error(`Connect the admin wallet, switch to ${TARGET_CHAIN_NAME}, and enable privacy mode before adding budget.`)
      return
    }

    if (!organization.exists) {
      toast.error('Create the workspace first before adding budget.')
      return
    }

    if (!isAdmin) {
      toast.error('Only the workspace admin can add private budget.')
      return
    }

    if (budgetAmountInWei === null) {
      toast.error('Enter a positive budget amount with up to 18 decimal places.')
      return
    }

    setPendingAdminAction('depositBudget')
    try {
      await withTransaction(
        'Add budget',
        'Preparing browser encryption. MetaMask will open when the encrypted payload is ready.',
        'Private payroll budget increased.',
        async () => {
          const contract = getCipherRollContract(signer!)
          const encryptedAmount = await encryptUint128(budgetAmountInWei)

          return contract.depositBudget(orgId, encryptedAmount, budgetAmountInWei)
        }
      )
    } finally {
      setPendingAdminAction(null)
    }
  }

  const createPayrollRun = async () => {
    if (!canSubmitTransactions) {
      toast.error(`Connect the admin wallet and switch to ${TARGET_CHAIN_NAME} before creating a payroll run.`)
      return
    }

    if (!organization.exists) {
      toast.error('Create the workspace first before opening a payroll run.')
      return
    }

    if (!isAdmin) {
      toast.error('Only the workspace admin can create payroll runs.')
      return
    }

    if (!selectedPayrollRunInput.trim()) {
      toast.error('Enter a payroll run label before creating the run.')
      return
    }

    if (payrollRunExists) {
      setSurfaceStatus({
        tone: 'info',
        title: 'Payroll run already exists',
        detail: 'This run label is already active for the current workspace. Continue with funding or choose a new label.'
      })
      toast.info('This payroll cycle already exists. Continue with funding or choose a new label.')
      await loadPayrollRun()
      return
    }

    if (!payrollFundingDeadlineTimestamp) {
      toast.error('Choose a funding deadline for this payroll run.')
      return
    }

    if (plannedHeadcountForCreate < 1 || plannedHeadcountForCreate > 500) {
      toast.error('CipherRoll can auto-size this run for 1 to 500 planned employees.')
      return
    }

    const minFundingDeadline = Math.floor(Date.now() / 1000) + MIN_PAYROLL_FUNDING_DEADLINE_BUFFER_SECONDS
    if (payrollFundingDeadlineTimestamp <= minFundingDeadline) {
      toast.error('Choose a funding deadline at least 10 minutes from now so the wallet transaction has time to confirm.')
      return
    }

    try {
      const contract = getCipherRollContract(signer!)
      await contract.previewCreatePayrollRun(
        orgId,
        selectedPayrollRunId,
        payrollSettlementAssetId,
        payrollFundingDeadlineTimestamp,
        plannedHeadcountForCreate
      )
    } catch (error) {
      toast.error(extractCipherRollErrorMessage(error))
      return
    }

    await withTransaction(
      'Create payroll cycle',
      'Approve the wallet transaction to create the payroll cycle.',
      'Payroll cycle created.',
      async () => {
        const contract = getCipherRollContract(signer!)
        return contract.createPayrollRun(
          orgId,
          selectedPayrollRunId,
          payrollSettlementAssetId,
          payrollFundingDeadlineTimestamp,
          plannedHeadcountForCreate
        )
      }
    )

    await loadPayrollRun()
  }

  const fundPayrollRun = async () => {
    if (!payrollRunExists) {
      toast.error('Create or load a payroll cycle before funding it.')
      return
    }

    if (payrollRun.allocationCount === 0) {
      toast.error('Add the employee payment to this payroll cycle before reserving treasury funds.')
      return
    }

    if (payrollFundingAmountInWei === null) {
      toast.error('Enter a positive funding amount with up to 18 decimal places.')
      return
    }

    const decryptedAvailableBudgetInWei = summaryValues.available ? parseDecimalAmountToWei(summaryValues.available) : null
    if (decryptedAvailableBudgetInWei !== null && payrollFundingAmountInWei > decryptedAvailableBudgetInWei) {
      toast.error('This payroll total is higher than the available private budget. Add budget or lower the payroll amount before reserving treasury funds.')
      return
    }

    if (hasTreasuryRoute) {
      if (!canSubmitTransactions) {
        toast.error(`Connect the admin wallet and switch to ${TARGET_CHAIN_NAME} before funding a payroll run from treasury.`)
        return
      }

      await withTransaction(
        'Fund payroll cycle',
        'Approve the wallet transaction to reserve treasury funds for this payroll cycle.',
        'Payroll cycle funded from treasury and ready for activation.',
        async () => {
          const contract = getCipherRollContract(signer!)
          return contract.fundPayrollRunFromTreasury(orgId, selectedPayrollRunId, payrollFundingAmountInWei)
        }
      )

      await loadPayrollRun()
      return
    }

    if (!canEncryptInputs) {
      toast.error(`Connect the admin wallet, switch to ${TARGET_CHAIN_NAME}, and enable privacy mode before funding a payroll run.`)
      return
    }

    await withTransaction(
      'Fund payroll cycle',
      'Approve the wallet transaction to lock payroll funding from the private budget.',
      'Payroll cycle funded and ready for activation.',
      async () => {
        const contract = getCipherRollContract(signer!)
        const encryptedAmount = await encryptUint128(payrollFundingAmountInWei)
        return contract.fundPayrollRun(orgId, selectedPayrollRunId, encryptedAmount)
      }
    )

    await loadPayrollRun()
  }

  const depositTreasuryFunds = async () => {
    if (!canSubmitTransactions) {
      toast.error(`Connect the admin wallet and switch to ${TARGET_CHAIN_NAME} before funding the payroll treasury.`)
      return
    }

    if (!organization.exists || !isAdmin) {
      toast.error('Only the workspace admin can fund the payroll treasury.')
      return
    }

    if (!hasTreasuryRoute || !treasuryAdapterDetails.settlementAsset) {
      toast.error('This workspace does not have a payout route set up yet.')
      return
    }

    if (treasuryDepositAmountInWei === null) {
      toast.error('Enter a positive treasury funding amount with up to 18 decimal places.')
      return
    }

    await withTransaction(
      'Fund treasury',
      'Approve the transactions to deposit funds into the payroll treasury.',
      'Payroll treasury funded successfully.',
      async () => {
        const contract = getCipherRollContract(signer!)
        await (await contract.approveSettlementToken(
          treasuryAdapterDetails.settlementAsset,
          treasuryAdapterDetails.adapter,
          treasuryDepositAmountInWei
        )).wait()

        return contract.depositPayrollFunds(
          treasuryAdapterDetails.adapter,
          orgId,
          treasuryDepositAmountInWei
        )
      }
    )
  }

  const activatePayrollRun = async () => {
    if (!canSubmitTransactions) {
      toast.error(`Connect the admin wallet and switch to ${TARGET_CHAIN_NAME} before activating a payroll run.`)
      return
    }

    if (!payrollRunExists) {
      toast.error('Create or load a payroll cycle before activating it.')
      return
    }

    await withTransaction(
      'Activate payroll',
      'Approve the wallet transaction to open the claim window for employees.',
      'Payroll cycle activated. Employees can now claim.',
      async () => {
        const contract = getCipherRollContract(signer!)
        return contract.activatePayrollRun(orgId, selectedPayrollRunId)
      }
    )

    await loadPayrollRun()
  }

  const issuePayroll = async () => {
    if (!canEncryptInputs) {
      toast.error(`Connect the admin wallet, switch to ${TARGET_CHAIN_NAME}, and enable privacy mode before issuing payroll.`)
      return
    }

    if (!organization.exists) {
      toast.error('Create the workspace first before issuing payroll.')
      return
    }

    if (!isAdmin && !governanceActive) {
      toast.error('Only the workspace admin can issue payroll for this organization.')
      return
    }

    const employee = safeAddress(employeeAddress)

    if (!employee) {
      toast.error('Enter a valid employee wallet address.')
      return
    }

    if (paymentAmountInWei === null) {
      toast.error(`Enter a positive payroll amount for ${TARGET_CHAIN_NAME} with up to 18 decimal places.`)
      return
    }

    if (payrollMode === 'vesting' && vestingWindowInvalid) {
      toast.error('Choose a valid vesting schedule with an end time after the start time.')
      return
    }

    if (!payrollRunExists) {
      toast.error('Create or load a payroll cycle before issuing payments.')
      return
    }

    if (!payrollRunOpenForAllocations) {
      toast.error('This payroll cycle is no longer accepting payments.')
      return
    }

    if (payrollWouldZeroOut) {
      toast.error('The requested amount exceeds the available budget. This payment would be set to zero, so it is blocked until the budget is increased.')
      return
    }

    const paymentId = makeHighEntropyBytes32Label('payment', employee)
    const memoHash = paymentMemo.trim()
      ? makeDeterministicLabel('memo', paymentMemo.trim())
      : makeHighEntropyBytes32Label('memo', 'cipherroll-payroll')

    setPendingAdminAction('issuePayroll')

    try {
      if (governanceActive) {
        const contract = getCipherRollContract(signer!)
        const intentKey = [
          orgId,
          selectedPayrollRunId,
          employee.toLowerCase(),
          paymentAmountInWei.toString(),
          payrollMode,
          paymentMemo.trim(),
          vestingStartTimestamp ?? 0,
          vestingEndTimestamp ?? 0
        ].join('|')

        let intent = pendingGovernedPayrollIntent?.key === intentKey
          ? pendingGovernedPayrollIntent
          : null

        if (!intent) {
          const encryptedAmount = await encryptUint128(paymentAmountInWei)
          const intentPaymentId = paymentId
          const intentMemoHash = memoHash
          const encryptedTuple = [
            encryptedAmount.ctHash,
            encryptedAmount.securityZone,
            encryptedAmount.utype,
            encryptedAmount.signature
          ]
          const actionKey = payrollMode === 'vesting'
            ? 'issue_vesting_allocation_to_run'
            : 'issue_confidential_payroll_to_run'
          const payload = payrollMode === 'vesting'
            ? abiCoder.encode(
              ['bytes32', 'address', '(uint256,uint8,uint8,bytes)', 'bytes32', 'bytes32', 'uint64', 'uint64'],
              [selectedPayrollRunId, employee, encryptedTuple, intentPaymentId, intentMemoHash, vestingStartTimestamp!, vestingEndTimestamp!]
            )
            : abiCoder.encode(
              ['bytes32', 'address', '(uint256,uint8,uint8,bytes)', 'bytes32', 'bytes32'],
              [selectedPayrollRunId, employee, encryptedTuple, intentPaymentId, intentMemoHash]
            )

          intent = {
            key: intentKey,
            actionKey,
            payload,
            encryptedAmount,
            paymentId: intentPaymentId,
            memoHash: intentMemoHash
          }
          setPendingGovernedPayrollIntent(intent)
        }

        const clearExecutedIntent = () => {
          setPendingGovernedPayrollIntent((current) => current?.key === intentKey ? null : current)
        }

        if (payrollMode === 'vesting') {
          await handleGovernedAction({
            actionKey: intent.actionKey,
            payload: intent.payload,
            actionTitle: 'Issue payroll',
            proposalSummary: 'The private vesting payment was routed through multi-admin approval.',
            directExecute: async () =>
              contract.issueVestingAllocationToRun(
                orgId,
                selectedPayrollRunId,
                employee,
                intent.encryptedAmount,
                intent.paymentId,
                intent.memoHash,
                vestingStartTimestamp!,
                vestingEndTimestamp!
              ),
            onExecuted: clearExecutedIntent
          })
        } else {
          await handleGovernedAction({
            actionKey: intent.actionKey,
            payload: intent.payload,
            actionTitle: 'Issue payroll',
            proposalSummary: 'The private payroll payment was routed through multi-admin approval.',
            directExecute: async () =>
              contract.issueConfidentialPayrollToRun(
                orgId,
                selectedPayrollRunId,
                employee,
                intent.encryptedAmount,
                intent.paymentId,
                intent.memoHash
              ),
            onExecuted: clearExecutedIntent
          })
        }
      } else {
        await withTransaction(
          'Issue payroll',
          'Preparing browser encryption. MetaMask will open when the encrypted payload is ready.',
          payrollMode === 'vesting'
            ? 'Private vesting payment issued.'
            : 'Private payroll payment issued.',
          async () => {
            const contract = getCipherRollContract(signer!)
            const encryptedAmount = await encryptUint128(paymentAmountInWei)

            if (payrollMode === 'vesting') {
              return contract.issueVestingAllocationToRun(
                orgId,
                selectedPayrollRunId,
                employee,
                encryptedAmount,
                paymentId,
                memoHash,
                vestingStartTimestamp!,
                vestingEndTimestamp!
              )
            }

            return contract.issueConfidentialPayrollToRun(
              orgId,
              selectedPayrollRunId,
              employee,
              encryptedAmount,
              paymentId,
              memoHash,
            )
          }
        )
      }

      await loadPayrollRun()
    } finally {
      setPendingAdminAction(null)
    }
  }

  const updateBatchPayrollRow = (rowId: string, updates: Partial<BatchPayrollRow>) => {
    setBatchPayrollRows((current) =>
      current.map((row) => row.id === rowId ? { ...row, ...updates } : row)
    )
  }

  const addBatchPayrollRow = () => {
    setBatchPayrollRows((current) => [
      ...current,
      {
        id: makeBatchRowId(),
        employeeAddress: '',
        roleSlug: batchPayrollRoles[0]?.slug ?? '',
        roleLabel: batchPayrollRoles[0]?.label ?? '',
        amount: '',
        memo: '',
        status: 'draft',
        error: null,
        txHash: null,
        paymentId: null,
        encryptedAmount: null,
        memoHash: null
      }
    ])
    setBatchPayrollStage('draft')
  }

  const removeBatchPayrollRow = (rowId: string) => {
    setBatchPayrollRows((current) => current.filter((row) => row.id !== rowId))
    setBatchPayrollStage('draft')
  }

  const addBatchPayrollRole = () => {
    const slug = `role-${batchPayrollRoles.length + 1}`
    setBatchPayrollRoles((current) => [
      ...current,
      {
        id: makeBatchRowId(),
        slug,
        label: `Role ${current.length + 1}`,
        baseSalary: ''
      }
    ])
    setBatchPayrollStage('draft')
  }

  const updateBatchPayrollRole = (roleId: string, updates: Partial<BatchPayrollRole>) => {
    setBatchPayrollRoles((current) =>
      current.map((role) => {
        if (role.id !== roleId) return role
        const nextLabel = updates.label ?? role.label
        const nextSlug = updates.slug ?? (updates.label ? slugifyRole(nextLabel) : role.slug)
        return {
          ...role,
          ...updates,
          slug: nextSlug || role.slug
        }
      })
    )
    setBatchPayrollStage('draft')
  }

  const prepareBatchPayrollReview = () => {
    if (governanceActive) {
      toast.error('Batch payroll v1 supports non-governed workspaces only. Use the one-row governed issuance flow for this workspace.')
      return
    }

    if (!organization.exists || !payrollRunOpenForAllocations) {
      toast.error('Create or load a draft/funded payroll run before preparing a batch.')
      return
    }

    if (batchPayrollRows.length === 0) {
      toast.error('Add at least one employee row before review.')
      return
    }

    if (batchPayrollMode === 'vesting' && vestingWindowInvalid) {
      toast.error('Choose a valid vesting schedule before reviewing a vesting batch.')
      return
    }

    if (batchPayrollHasErrors) {
      toast.error('Fix row validation errors before review.')
      setBatchPayrollRows((current) =>
        current.map((row) => {
          const validation = batchPayrollValidation.find((item) => item.id === row.id)
          return {
            ...row,
            error: validation?.errors.join(' ') || null,
            status: validation?.errors.length ? 'failed' : 'validated'
          }
        })
      )
      return
    }

    setBatchPayrollRows((current) =>
      current.map((row) => ({
        ...row,
        status: row.status === 'confirmed' ? 'confirmed' : 'validated',
        error: null
      }))
    )
    setBatchPayrollStage('review')
    toast.success('Batch review is ready. Confirm the rows before sealing salary amounts.')
  }

  const sealBatchPayroll = async () => {
    if (governanceActive) {
      toast.error('Batch payroll v1 is disabled for governed workspaces.')
      return
    }

    if (!canEncryptInputs) {
      toast.error(`Connect the admin wallet, switch to ${TARGET_CHAIN_NAME}, and enable privacy mode before sealing a batch.`)
      return
    }

    if (batchPayrollStage !== 'review') {
      toast.error('Review the batch before sealing encrypted salaries.')
      return
    }

    if (batchPayrollHasErrors) {
      toast.error('Fix row validation errors before sealing.')
      return
    }

    setIsBatchPayrollSealing(true)
    setBatchPayrollProgress('Preparing browser encryption...')

    try {
      await initCofhe((window as any).ethereum)
      const sealedRows: BatchPayrollRow[] = []

      for (let index = 0; index < batchPayrollRows.length; index += 1) {
        const row = batchPayrollRows[index]
        const validation = batchPayrollValidation.find((item) => item.id === row.id)
        if (!validation?.amountInWei || !validation.employee) {
          throw new Error(`Row ${index + 1} is missing a valid amount or employee address.`)
        }

        setBatchPayrollProgress(`Encrypting row ${index + 1} of ${batchPayrollRows.length}...`)
        const encryptedAmount = await encryptUint128(validation.amountInWei)
        const paymentId = makeHighEntropyBytes32Label('payment', validation.employee)
        const memoHash = row.memo.trim()
          ? makeDeterministicLabel('memo', row.memo.trim())
          : makeHighEntropyBytes32Label('memo', 'cipherroll-batch-payroll')

        sealedRows.push({
          ...row,
          employeeAddress: validation.employee,
          amount: '',
          status: 'sealed',
          error: null,
          encryptedAmount,
          paymentId,
          memoHash
        })
      }

      setBatchPayrollRows(sealedRows)
      setBatchPayrollRoles((current) => current.map((role) => ({ ...role, baseSalary: '' })))
      setBatchPayrollStage('sealed')
      setBatchPayrollProgress('Batch sealed. Plaintext salaries were removed from visible state.')
      toast.success('Batch salaries sealed. Salary amounts are hidden before submission.')
    } catch (error) {
      const message = extractCipherRollErrorMessage(error)
      setBatchPayrollProgress(message)
      toast.error(message)
    } finally {
      setIsBatchPayrollSealing(false)
    }
  }

  const submitBatchPayrollQueue = async () => {
    if (governanceActive) {
      toast.error('Batch payroll v1 supports non-governed workspaces only.')
      return
    }

    if (!canSubmitTransactions || !signer) {
      toast.error(`Connect the admin wallet and switch to ${TARGET_CHAIN_NAME} before submitting a batch.`)
      return
    }

    if (!organization.exists || !payrollRunOpenForAllocations) {
      toast.error('Create or load a draft/funded payroll run before submitting batch rows.')
      return
    }

    if (batchPayrollMode === 'vesting' && vestingWindowInvalid) {
      toast.error('Choose a valid vesting schedule before submitting a vesting batch.')
      return
    }

    const queue = batchPayrollRows
      .filter((row) => row.status === 'sealed' || row.status === 'failed')
      .filter((row) => row.encryptedAmount && row.paymentId && row.memoHash)

    if (queue.length === 0) {
      toast.info('No sealed or failed batch rows are ready to submit.')
      return
    }

    if (payrollRunRemainingAllocationSlots < queue.length) {
      toast.error(`This payroll run has ${payrollRunRemainingAllocationSlots} remaining slot(s), but this sealed batch has ${queue.length} payable row(s). Create a new payroll run after importing the CSV so CipherRoll can size the run correctly.`)
      setBatchPayrollProgress(`Run capacity mismatch: ${payrollRunRemainingAllocationSlots} slot(s) left for ${queue.length} sealed row(s). Use a new payroll run label and create the run after importing the CSV.`)
      return
    }

    setIsBatchPayrollSubmitting(true)

    try {
      const contract = getCipherRollContract(signer)
      const backend = getCipherRollBackendClient()

      for (let index = 0; index < queue.length; index += 1) {
        const row = queue[index]
        const role = batchRoleBySlug.get(row.roleSlug)
        const employee = safeAddress(row.employeeAddress)

        if (!employee || !row.encryptedAmount || !row.paymentId || !row.memoHash || !role) {
          updateBatchPayrollRow(row.id, {
            status: 'failed',
            error: 'Missing sealed row metadata. Rebuild and seal this row again.'
          })
          continue
        }

        setBatchPayrollProgress(`Opening wallet confirmation ${index + 1} of ${queue.length}: ${role.label}`)
        updateBatchPayrollRow(row.id, { status: 'submitting', error: null })

        try {
          const tx = batchPayrollMode === 'vesting'
            ? await contract.issueVestingAllocationToRun(
              orgId,
              selectedPayrollRunId,
              employee,
              row.encryptedAmount,
              row.paymentId,
              row.memoHash,
              vestingStartTimestamp!,
              vestingEndTimestamp!
            )
            : await contract.issueConfidentialPayrollToRun(
              orgId,
              selectedPayrollRunId,
              employee,
              row.encryptedAmount,
              row.paymentId,
              row.memoHash
            )
          await tx.wait()

          await backend.createBatchPayrollManifest({
            orgId,
            payrollRunId: selectedPayrollRunId,
            employee,
            roleSlug: role.slug,
            roleLabel: role.label,
            paymentId: row.paymentId,
            txHash: tx.hash ?? ''
          })

          updateBatchPayrollRow(row.id, {
            status: 'confirmed',
            txHash: tx.hash ?? null,
            error: null
          })
        } catch (error) {
          updateBatchPayrollRow(row.id, {
            status: 'failed',
            error: extractCipherRollErrorMessage(error)
          })
        }
      }

      await loadPayrollRun()
      await loadBatchPayrollManifests()
      setBatchPayrollProgress('Batch queue pass finished. Retry only failed rows if needed.')
    } finally {
      setIsBatchPayrollSubmitting(false)
    }
  }

  const importBatchPayrollCsv = async (file: File | null) => {
    if (!file) return

    try {
      const text = decodeBatchPayrollCsvBuffer(await file.arrayBuffer())
      const rows = parseBatchPayrollCsv(text)
      if (rows.length === 0) {
        toast.error('CSV did not contain any payroll rows.')
        return
      }

      const existingRoleSlugs = new Set(batchPayrollRoles.map((role) => role.slug))
      const importedRoles = new Map<string, BatchPayrollRole>()
      for (const row of rows) {
        if (!row.roleSlug || existingRoleSlugs.has(row.roleSlug) || importedRoles.has(row.roleSlug)) continue
        importedRoles.set(row.roleSlug, {
          id: makeBatchRowId(),
          slug: row.roleSlug,
          label: formatRoleLabel(row.roleLabel || row.roleSlug),
          baseSalary: row.amount.trim()
        })
      }

      if (importedRoles.size > 0) {
        setBatchPayrollRoles((current) => [...current, ...Array.from(importedRoles.values())])
        setShowBatchRoleEditor(Array.from(importedRoles.values()).some((role) => !role.baseSalary.trim()))
      }

      setBatchPayrollRows(rows)
      setBatchPayrollCsvName(file.name)
      setBatchPayrollStage('draft')
      setBatchPayrollProgress('CSV imported locally. No salary data was sent to the backend.')
      toast.success(`Imported ${rows.length} row(s) from CSV in this browser only.`)
    } catch (error) {
      toast.error(extractCipherRollErrorMessage(error))
    }
  }

  const summaryCards = [
    { label: 'Budget', value: summaryValues.budget, handle: summaryHandles?.budget ?? null },
    { label: 'Committed', value: summaryValues.committed, handle: summaryHandles?.committed ?? null },
    { label: 'Available', value: summaryValues.available, handle: summaryHandles?.available ?? null }
  ]


  const budgetNumber = Number(summaryValues.budget ?? '0')
  const committedNumber = Number(summaryValues.committed ?? '0')
  const availableNumber = Number(summaryValues.available ?? '0')
  const budgetUtilization = budgetNumber > 0 ? Math.min(100, (committedNumber / budgetNumber) * 100) : 0
  const availableRunway = budgetNumber > 0 ? Math.max(0, (availableNumber / budgetNumber) * 100) : 0
  const claimRate = organizationInsights.totalPayrollItems > 0
    ? Math.round((organizationInsights.claimedPayrollItems / organizationInsights.totalPayrollItems) * 100)
    : 0
  const analyticsCards = [
    { label: 'Payroll Items', value: String(organizationInsights.totalPayrollItems), detail: 'Total allocations issued' },
    { label: 'Active Items', value: String(organizationInsights.activePayrollItems), detail: 'Still pending employee claim' },
    { label: 'Claimed Items', value: String(organizationInsights.claimedPayrollItems), detail: `${claimRate}% claim completion` },
    { label: 'Recipients', value: String(organizationInsights.employeeRecipients), detail: 'Unique employee wallets paid' },
    { label: 'Vesting Items', value: String(organizationInsights.vestingPayrollItems), detail: 'Locked by schedule' },
    { label: 'Budget Utilization', value: summaryValues.budget ? `${budgetUtilization.toFixed(0)}%` : 'Locked', detail: 'Committed versus funded budget' }
  ]
  const overviewInsightCards = [
    ...analyticsCards,
    {
      label: 'Runway Left',
      value: summaryValues.budget ? `${availableRunway.toFixed(0)}%` : 'Locked',
      detail: 'Budget still available'
    },
    {
      label: 'Latest Activity',
      value: organizationInsights.lastIssuedAt
        ? new Date(organizationInsights.lastIssuedAt * 1000).toLocaleDateString()
        : 'None',
      detail: organizationInsights.lastClaimedAt
        ? `Last claim ${new Date(organizationInsights.lastClaimedAt * 1000).toLocaleDateString()}`
        : 'No claims yet'
    }
  ]
  const governancePendingProposals = governanceProposals.filter(
    (proposal) => !proposal.executed && !proposal.cancelled && proposal.expiresAt > Math.floor(Date.now() / 1000)
  )
  const governanceReadyProposals = governancePendingProposals.filter(
    (proposal) => proposal.approvalCount >= governanceQuorum
  )

  const operatorAlerts = [
    !isInstalled
      ? {
          tone: 'error' as const,
          title: 'No injected wallet detected',
          detail: 'Install MetaMask, Rabby, or another EVM wallet to operate CipherRoll.'
        }
      : null,
    address && !isTargetChain
      ? {
          tone: 'error' as const,
          title: `Wallet is on the wrong network`,
          detail: `This deployment is configured for ${TARGET_CHAIN_NAME}. Switch networks before creating, funding, or issuing payroll.`
        }
      : null,
    !isConfigured
      ? {
          tone: 'error' as const,
          title: 'Frontend contract address missing',
          detail: 'Set NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS so the admin portal can read and write on-chain state.'
        }
      : null,
    workspaceOwnedByAnotherAdmin
      ? {
          tone: 'error' as const,
          title: 'Workspace belongs to another admin',
          detail: `The current org id resolves to ${formatBytes32Preview(orgId)} and is owned by ${organization.admin}. Switch to the correct admin wallet or use a different org id.`
        }
      : null,
    organization.exists && isAdmin && !cofheReady
      ? {
          tone: 'info' as const,
          title: 'Turn on secure view',
          detail: 'Workspace info can load now. Private budget details and secure views need secure view turned on.'
        }
      : null,
    governanceInitialized && !governanceActive
      ? {
          tone: 'info' as const,
          title: 'Multi-admin is set up but not yet enforcing approvals',
          detail: governanceLinkedAddress
            ? 'Add enough admins to meet the threshold before expecting multi-admin enforcement on treasury or payroll actions.'
            : 'Link payroll to multi-admin after enough admins are added, so treasury and payroll actions stop going through a single admin.'
        }
      : null,
    payrollWouldZeroOut
      ? {
          tone: 'error' as const,
          title: 'Payroll amount exceeds decrypted available budget',
          detail: 'The contract would set this payment to zero. Increase the budget or lower the amount before submitting.'
        }
      : null,
    refreshError
      ? {
          tone: 'error' as const,
          title: 'Most recent refresh failed',
          detail: refreshError
        }
      : null
  ].filter(Boolean) as Array<{
    tone: 'info' | 'error'
    title: string
    detail: string
  }>

  const surfaceStatusStyles: Record<SurfaceStatusTone, string> = {
    neutral: 'border-white/10 bg-white/5 text-white',
    info: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-50',
    success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-50',
    error: 'border-rose-400/20 bg-rose-400/10 text-rose-50'
  }

  return (
    <main className="min-h-screen relative z-10 font-sans text-gray-100 bg-black selection:bg-white/20 pt-32">
      <div
        className="fixed inset-0 z-0 bg-[length:800px] md:bg-[length:1800px] bg-left bg-no-repeat bg-fixed opacity-40"
        style={{ backgroundImage: "url('/assets/milad-fakurian-7W3X1dAuKqg-unsplash.jpg')" }}
      />
      <div className="fixed inset-0 z-0 bg-black/60 backdrop-blur-[2px]" />

      <div className="w-full max-w-6xl mx-auto px-6 pb-24 relative z-10">
        <section className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 text-cyan-300 text-xs font-bold tracking-widest uppercase mb-5">
            Admin Access
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white mb-4">Admin Portal</h1>
        </section>

        <div className="mb-6">
          <div className="overflow-x-auto pb-2">
            <div className="flex justify-center min-w-max">
              <div className="inline-flex items-center rounded-full border border-white/10 bg-[#0b0b0c]/90 p-2 backdrop-blur-xl">
              {portalTabs.map((tab) => {
                const active = activePortal === tab.id

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActivePortal(tab.id)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-all duration-300 whitespace-nowrap ${
                      active
                        ? 'bg-white text-black shadow-[0_8px_30px_rgba(255,255,255,0.12)]'
                        : 'text-white/65 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
              </div>
            </div>
          </div>
        </div>

        <NetworkStatus />

        {activePortal === 'overview' && (
          <div className="space-y-6 mt-8">
            <GlassCard className="p-6 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
                    <Sparkles className="h-3.5 w-3.5" />
                    Workspace Status
                  </div>
                  <h2 className="mt-4 text-2xl font-bold text-white">{surfaceStatus.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#c9c9d0]">{surfaceStatus.detail}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {address && !isTargetChain && (
                    <button
                      onClick={() => {
                        void switchToTargetChain()
                          .then(() => {
                            setSurfaceStatus({
                              tone: 'success',
                              title: `Wallet switched to ${TARGET_CHAIN_NAME}`,
                              detail: 'Refresh the workspace or continue with the next action.'
                            })
                          })
                          .catch((error) => {
                            const message = extractCipherRollErrorMessage(error)
                            setSurfaceStatus({
                              tone: 'error',
                              title: 'Network switch failed',
                              detail: message
                            })
                            toast.error(message)
                          })
                      }}
                      className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/15"
                    >
                      Switch To {TARGET_CHAIN_NAME}
                    </button>
                  )}
                  <button
                    onClick={() => void refreshWorkspaceState('manual')}
                    disabled={!canReadState || isRefreshing}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {isRefreshing ? 'Refreshing...' : 'Refresh Organization'}
                  </button>
                </div>
              </div>

              {!organization.exists ? (
                <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-amber-50">Workspace not created</p>
                    <p className="mt-1 text-sm text-amber-100/85">Create the workspace first, then come back here for the full operator view.</p>
                  </div>
                  <button
                    onClick={() => setActivePortal('setup')}
                    className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-50 hover:bg-amber-300/15"
                  >
                    Open Workspace Setup
                  </button>
                </div>
              ) : (
                <div className={`mt-4 rounded-2xl border p-4 text-sm ${surfaceStatusStyles[surfaceStatus.tone]}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      {lastRefreshedAt
                        ? `Last successful refresh: ${new Date(lastRefreshedAt).toLocaleString()}`
                        : 'No successful refresh recorded in this session yet.'}
                    </span>
                    {surfaceStatus.txHash && (
                      <span className="font-mono text-xs uppercase tracking-[0.14em] opacity-90">
                        Tx {shortHash(surfaceStatus.txHash)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </GlassCard>

            {operatorAlerts.length > 0 && (
              <div className="grid gap-4">
                {operatorAlerts.map((alert) => (
                  <div
                    key={`${alert.title}-${alert.detail}`}
                    className={`rounded-3xl border p-5 ${alert.tone === 'error' ? 'border-rose-400/20 bg-rose-400/10' : 'border-cyan-400/20 bg-cyan-400/10'}`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${alert.tone === 'error' ? 'text-rose-200' : 'text-cyan-200'}`} />
                      <div>
                        <h3 className={`text-sm font-semibold ${alert.tone === 'error' ? 'text-rose-50' : 'text-cyan-50'}`}>{alert.title}</h3>
                        <p className={`mt-1 text-sm leading-relaxed ${alert.tone === 'error' ? 'text-rose-100/90' : 'text-cyan-100/90'}`}>{alert.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          <div className="grid lg:grid-cols-[0.92fr,1.08fr] gap-8">
            <div className="space-y-6">
              <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <Wallet className="w-5 h-5 text-cyan-300" />
                  <h2 className="text-2xl font-bold text-white tracking-tight">Admin access</h2>
                </div>

                <div className="grid sm:grid-cols-4 gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-white/55 uppercase tracking-[0.18em] text-xs font-bold mb-2">Wallet</p>
                    <p className="text-white">
                      {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connect from nav'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-white/55 uppercase tracking-[0.18em] text-xs font-bold mb-2">Admin role</p>
                    <p className="text-white">
                      {isAdmin
                        ? 'Primary admin'
                        : connectedWalletIsGovernanceAdmin
                          ? 'Multi-admin signer'
                          : 'Waiting'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-white/55 uppercase tracking-[0.18em] text-xs font-bold mb-2">Privacy mode</p>
                    <p className="text-white">{cofheReady ? 'Ready' : 'Not enabled'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-white/55 uppercase tracking-[0.18em] text-xs font-bold mb-2">Governance</p>
                    <p className="text-white">
                      {governanceActive
                        ? `${governanceAdminCount}-of-${governanceQuorum} active`
                        : governanceInitialized
                          ? `${governanceAdminCount}/${governanceQuorum} bootstrapped`
                          : 'Not initialized'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={initializeCofhe}
                    disabled={!canSubmitTransactions || isBusy}
                    className="rounded-2xl bg-white text-black px-5 py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                  >
                    Turn On Secure View
                  </button>
                  <button
                    onClick={() => void refreshWorkspaceState('manual')}
                    disabled={!canReadState || isRefreshing}
                    className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    {isRefreshing ? 'Refreshing...' : 'Refresh State'}
                  </button>
                </div>

                <div className="mt-6 rounded-2xl border border-cyan-400/15 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                  Configured {TARGET_CHAIN_NAME} payroll contract: <span className="font-mono break-all">{CONTRACT_ADDRESS || 'Not configured'}</span>
                </div>
                {governanceConfigured && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                    Governance executor target: <span className="font-mono break-all">{GOVERNANCE_CONTRACT_ADDRESS}</span>
                  </div>
                )}
              </GlassCard>
            </div>

            <div className="space-y-6">
              <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <ShieldCheck className="w-5 h-5 text-emerald-300" />
                  <h2 className="text-2xl font-bold text-white">Encrypted Budget Summary</h2>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {summaryCards.map((item) => (
                    <div key={item.label} className="relative min-w-0 rounded-2xl border border-white/10 bg-white/5 p-5 overflow-hidden">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/55 font-bold">{item.label}</p>
                        {item.value ? (
                          <div className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Decrypted</div>
                        ) : (
                          <div className="bg-white/10 text-white/50 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Locked</div>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-black text-white">{item.value ?? '***'}</p>
                        {item.value && <span className="text-sm text-white/50 font-semibold">ETH</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

            </div>
          </div>
          <GlassCard className="mt-8 p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="w-5 h-5 text-cyan-300" />
              <h2 className="text-2xl font-bold text-white">Workspace insights</h2>
            </div>

            <div className="grid gap-4 xl:grid-cols-4">
              {overviewInsightCards.map((item) => (
                <div key={item.label} className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/55 font-bold mb-3">{item.label}</p>
                  <p className="text-3xl font-black text-white break-words">{item.value}</p>
                  <p className="mt-2 text-sm text-[#a1a1aa]">{item.detail}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="mt-8 p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
                  <Sparkles className="h-3.5 w-3.5" />
                  Backend Operations
                </div>
                <h2 className="mt-4 text-2xl font-bold text-white">Reporting, exports, and workflow feed</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#c9c9d0]">
                  Aggregate-only reporting from the indexed backend: treasury posture, run-state counts, pending actions, and recent workflow notifications.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void loadBackendOperatorOutputs()}
                  disabled={!organization.exists || isBackendReportLoading}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                >
                  {isBackendReportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {isBackendReportLoading ? 'Refreshing…' : 'Refresh Feed'}
                </button>
                <button
                  type="button"
                  onClick={() => void downloadBackendJsonExport()}
                  disabled={!organization.exists}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={() => void downloadBackendCsvExport()}
                  disabled={!organization.exists}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              </div>
            </div>

            {backendReportError ? (
              <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                Backend report unavailable right now: {backendReportError}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 xl:grid-cols-4">
              {[
                { label: 'Pending claims', value: backendReport ? String(backendReport.pendingClaims) : '—', detail: 'Allocations still waiting for employee action.' },
                { label: 'Pending wrapper finalizes', value: backendReport ? String(backendReport.pendingSettlementRequests) : '—', detail: 'Settlement requests that still need a finalize leg.' },
                { label: 'Settled payouts', value: backendReport ? String(backendReport.settledPayments) : '—', detail: 'Payroll items that reached a final payout state.' },
                { label: 'Backend feed', value: backendReport ? String(backendNotifications.length) : '—', detail: 'Recent workflow events.' }
              ].map((item) => (
                <div key={item.label} className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/55 font-bold mb-3">{item.label}</p>
                  <p className="text-3xl font-black text-white break-words">{item.value}</p>
                  <p className="mt-2 text-sm text-[#a1a1aa]">{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/55 font-bold">Treasury exposure and payout policy</p>
                  <p className="mt-2 text-sm text-[#a1a1aa]">
                    Backend-safe treasury posture: route health, available/reserved inventory, wrapper finalize backlog, and active run exposure without plaintext salary rows.
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] ${
                  backendTreasuryExposure?.routeHealth === 'healthy'
                    ? 'bg-emerald-400/15 text-emerald-200'
                    : backendTreasuryExposure?.routeHealth === 'action_needed'
                      ? 'bg-amber-400/15 text-amber-100'
                      : backendTreasuryExposure?.routeHealth === 'depleted'
                        ? 'bg-rose-400/15 text-rose-100'
                        : 'bg-white/10 text-white/50'
                }`}>
                  {backendTreasuryExposure?.routeHealth?.replace(/_/g, ' ') ?? 'not loaded'}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                {[
                  ['Available', backendTreasuryExposure ? formatTreasuryTokenAmount(backendTreasuryExposure.availableTreasuryFunds) : '—'],
                  ['Reserved', backendTreasuryExposure ? formatTreasuryTokenAmount(backendTreasuryExposure.reservedTreasuryFunds) : '—'],
                  ['Payout backlog', backendTreasuryExposure ? String(backendTreasuryExposure.payoutBacklog) : '—'],
                  ['Active/funded runs', backendTreasuryExposure ? `${backendTreasuryExposure.activeRuns}/${backendTreasuryExposure.fundedRuns}` : '—']
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">{label}</p>
                    <p className="mt-2 text-2xl font-black text-white">{value}</p>
                  </div>
                ))}
              </div>

              {backendTreasuryExposure?.safetyNotes.length ? (
                <div className="mt-4 space-y-2">
                  {backendTreasuryExposure.safetyNotes.map((note) => (
                    <div key={note} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-50">
                      {note}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {(backendTreasuryExposure?.runExposures ?? []).slice(0, 6).map((run) => (
                  <div key={run.payrollRunId} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="font-semibold text-white">{formatBytes32Preview(run.payrollRunId)}</p>
                    <p className="mt-2 text-sm text-[#c9c9d0]">
                      {run.claimedCount}/{run.allocationCount} claimed · backlog {run.payoutBacklog}
                    </p>
                    <p className="mt-2 text-xs text-white/45">
                      {run.pendingSettlementRequests} finalize step(s), {run.settledPayments} settled
                    </p>
                  </div>
                ))}
                {backendTreasuryExposure && backendTreasuryExposure.runExposures.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-[#a1a1aa]">
                    No funded or active treasury-backed run exposure is currently indexed.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <button
                type="button"
                onClick={() => setShowBackendDebugDetails((current) => !current)}
                className="text-sm font-semibold text-white hover:text-cyan-100"
              >
                {showBackendDebugDetails ? 'Hide backend debug details' : 'Show backend debug details'}
              </button>
              {showBackendDebugDetails ? (
                <div className="mt-4 grid gap-4 xl:grid-cols-4">
                  {[
                    { label: 'Indexed block', value: backendStatus ? String(backendStatus.latestIndexedBlock) : '—', detail: 'Latest block stored in the backend index.' },
                    { label: 'Known chain head', value: backendStatus ? String(backendStatus.latestKnownBlock) : '—', detail: 'Latest chain height seen during backend sync.' },
                    { label: 'Organizations', value: backendStatus ? String(backendStatus.organizations) : '—', detail: 'Workspace records currently indexed.' },
                    { label: 'Notifications', value: backendStatus ? String(backendStatus.notifications) : '—', detail: 'Workflow notifications materialized from chain events.' }
                  ].map((item) => (
                    <div key={item.label} className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-5">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/55 font-bold mb-3">{item.label}</p>
                      <p className="text-3xl font-black text-white break-words">{item.value}</p>
                      <p className="mt-2 text-sm text-[#a1a1aa]">{item.detail}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-white/55 font-bold">Run-state summary</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    ['Draft runs', backendReport?.draftPayrollRuns ?? 0],
                    ['Funded runs', backendReport?.fundedPayrollRuns ?? 0],
                    ['Active runs', backendReport?.activePayrollRuns ?? 0],
                    ['Finalized runs', backendReport?.finalizedPayrollRuns ?? 0]
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">{label}</p>
                      <p className="mt-2 text-2xl font-black text-white">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/55 font-bold">Recent workflow notifications</p>
                  <div className="flex flex-wrap gap-2">
                {[
                  ['all', 'All'],
                  ['payroll_run', 'Runs'],
                  ['claim', 'Claims'],
                  ['settlement', 'Payouts'],
                  ['audit_receipt', 'Receipts'],
                  ['governance', 'Approvals']
                ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setBackendNotificationCategory(value as typeof backendNotificationCategory)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                          backendNotificationCategory === value
                            ? 'bg-white text-black'
                            : 'border border-white/10 bg-black/20 text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {backendNotifications.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-[#a1a1aa]">
                      No backend notifications are cached for this workspace yet.
                    </div>
                  ) : (
                    backendNotifications.map((notification) => (
                      <div key={notification.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-white">{notification.title}</p>
                          <span className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                            {new Date(notification.createdAt * 1000).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[#c9c9d0]">{notification.detail}</p>
                        <p className="mt-2 text-xs font-mono text-white/45">{notification.eventName}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-white/55 font-bold">Active payroll runs</p>
                <div className="mt-4 space-y-3">
                  {backendActiveRuns.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-[#a1a1aa]">
                      No active payroll runs are currently indexed for this workspace.
                    </div>
                  ) : (
                    backendActiveRuns.map((run) => (
                      <div key={run.payrollRunId} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="font-semibold text-white">{formatBytes32Preview(run.payrollRunId)}</p>
                        <p className="mt-2 text-sm text-[#c9c9d0]">
                          Claims active since {formatUnixTimestamp(run.activatedAt)}
                        </p>
                        <p className="mt-2 text-xs text-white/45">
                          {run.claimedCount}/{run.allocationCount} claims completed
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-white/55 font-bold">Pending employee claims</p>
                <div className="mt-4 space-y-3">
                  {backendPendingClaims.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-[#a1a1aa]">
                      No pending employee claims are currently indexed.
                    </div>
                  ) : (
                    backendPendingClaims.map((payment) => (
                      <div key={payment.paymentId} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="font-semibold text-white">{formatBytes32Preview(payment.paymentId)}</p>
                        <p className="mt-2 text-sm text-[#c9c9d0]">Issued {formatUnixTimestamp(payment.issuedAt)}</p>
                        <p className="mt-2 text-xs font-mono text-white/45">{payment.employee}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-white/55 font-bold">Wrapper finalize backlog</p>
                <div className="mt-4 space-y-3">
                  {backendPendingFinalizations.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-[#a1a1aa]">
                      No pending wrapper settlement finalizations are currently indexed.
                    </div>
                  ) : (
                    backendPendingFinalizations.map((payment) => (
                      <div key={payment.paymentId} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="font-semibold text-white">{formatBytes32Preview(payment.paymentId)}</p>
                        <p className="mt-2 text-sm text-[#c9c9d0]">Requested {formatUnixTimestamp(payment.requestedAt)}</p>
                        <p className="mt-2 text-xs text-white/45">Waiting for finalize step</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </GlassCard>
          </div>
        )}

        {activePortal === 'setup' && (
          <div className="grid lg:grid-cols-2 gap-8 mt-8">
            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="w-5 h-5 text-cyan-300" />
                <h2 className="text-2xl font-bold text-white">Create workspace</h2>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-[#c9c9d0]">
                  CipherRoll will use a safe default workspace ID. Edit it only if you need to recover or reuse a specific workspace.
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedWorkspaceSettings((current) => !current)}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                >
                  {showAdvancedWorkspaceSettings ? 'Hide advanced settings' : 'Advanced settings'}
                </button>
                {showAdvancedWorkspaceSettings ? (
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <input
                      value={workspaceName}
                      onChange={(event) => setWorkspaceName(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                      placeholder="Workspace name"
                    />
                    <input
                      value={orgIdInput}
                      onChange={(event) => setOrgIdInput(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                      placeholder="Organization id"
                    />
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-[#a1a1aa]">
                      <p>Advanced privacy note: memorable labels are easier to guess. Use a safer ID for production demos.</p>
                      <button
                        type="button"
                        onClick={assignHighEntropyOrgLabel}
                        className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-white transition-colors hover:bg-white/10"
                      >
                        Use safer ID
                      </button>
                    </div>
                  </div>
                ) : null}
                {!showAdvancedWorkspaceSettings ? (
                  <button
                    type="button"
                    onClick={assignHighEntropyOrgLabel}
                    className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    Generate safer ID
                  </button>
                ) : null}
                <button
                  onClick={createOrganization}
                  disabled={!canSubmitTransactions || isBusy || organization.exists || !workspaceName.trim()}
                  className="w-full rounded-2xl bg-white text-black px-4 py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                >
                  Create CipherRoll Workspace
                </button>
              </div>

              {organization.exists && (
                <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-50">
                  Workspace already exists for this org id. You can move straight to budget or payroll.
                </div>
              )}

              {!organization.exists && !canSubmitTransactions && (
                <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                  Connect the admin wallet and switch to {TARGET_CHAIN_NAME} before creating the workspace.
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <ShieldCheck className="w-5 h-5 text-cyan-300" />
                <h2 className="text-2xl font-bold text-white">Attach treasury route</h2>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/5 p-2">
                  {[
                    { id: 'wrapper', label: 'Two-step payout' },
                    { id: 'direct', label: 'Direct treasury' }
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTreasuryRouteMode(option.id as 'wrapper' | 'direct')}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                        treasuryRouteMode === option.id
                          ? 'bg-white text-black'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvancedTreasurySettings((current) => !current)}
                  className="w-fit rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                >
                  {showAdvancedTreasurySettings ? 'Hide advanced settings' : 'Advanced settings'}
                </button>
                {showAdvancedTreasurySettings ? (
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <input
                      value={treasuryRouteLabel}
                      onChange={(event) => setTreasuryRouteLabel(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                      placeholder="Treasury route label"
                    />
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-[#a1a1aa]">
                      <p>Advanced privacy note: memorable route labels are easier to guess.</p>
                      <button
                        type="button"
                        onClick={assignHighEntropyRouteLabel}
                        className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-white transition-colors hover:bg-white/10"
                      >
                        Use safer name
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-[#c9c9d0] space-y-2">
                  <p className="text-white font-semibold">
                    {treasuryRouteMode === 'wrapper' ? 'Recommended two-step payout' : 'Direct payout route'}
                  </p>
                  <p>
                    {treasuryRouteMode === 'wrapper'
                      ? 'Employees will request payout first, then complete a final step. The amount may become visible on the network before the token is released.'
                      : 'Employees will claim once and receive the treasury payout token immediately.'}
                  </p>
                  {showAdvancedTreasurySettings ? (
                    <>
                      <p className="font-mono break-all text-xs text-white/55">
                        Adapter: {selectedTreasuryAdapterAddress || 'Not configured in frontend env'}
                      </p>
                      {organization.treasuryAdapter && organization.treasuryAdapter !== '0x0000000000000000000000000000000000000000' ? (
                        <p className="font-mono break-all text-xs text-emerald-300">
                          Current workspace adapter: {organization.treasuryAdapter}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>

                <button
                  onClick={configureTreasuryRoute}
                  disabled={
                    !canSubmitTransactions ||
                    !organization.exists ||
                    isBusy ||
                    !canConfigureTreasuryRoute ||
                    (!isAdmin && !governanceActive)
                  }
                  className="w-full rounded-2xl bg-white text-black px-4 py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                >
                  Configure Treasury Route
                </button>
              </div>

              {!organization.exists && (
                <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                  Create the workspace first, then attach the treasury route from this same tab.
                </div>
              )}
            </GlassCard>
          </div>
        )}

        {activePortal === 'governance' && (
          <div className="space-y-8 mt-8">
            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Multi-Admin Approval
                  </div>
                  <h2 className="mt-4 text-2xl font-bold text-white">Multi-Admin Controls</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#c9c9d0]">
                    Set up M-of-N approval for sensitive payroll and treasury actions. Operational actions still stay usable from the admin wallet.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadGovernanceState()}
                  disabled={!organization.exists || !governanceConfigured || isGovernanceLoading}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                >
                  {isGovernanceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {isGovernanceLoading ? 'Refreshing…' : 'Refresh Multi-Admin'}
                </button>
              </div>

              {!governanceConfigured ? (
                <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                  This frontend is missing <span className="font-mono">NEXT_PUBLIC_CIPHERROLL_GOVERNANCE_ADDRESS</span>, so the governance portal cannot talk to the companion contract yet.
                </div>
              ) : null}

              {governanceError ? (
                <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                  Governance state is unavailable right now: {governanceError}
                </div>
              ) : null}

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: 'Status',
                    value: governanceActive ? 'Active' : governanceInitialized ? 'Bootstrapping' : 'Not initialized',
                    detail: governanceActive
                      ? 'Sensitive actions now follow approval rules.'
                      : 'Single-admin control remains active until setup is finished.'
                  },
                  {
                    label: 'Approval threshold',
                    value: governanceInitialized ? `${governanceAdminCount}/${governanceQuorum}` : '—',
                    detail: governanceInitialized ? 'Registered admins versus required approvals.' : 'Set up multi-admin first.'
                  },
                  {
                    label: 'Payroll executor',
                    value: governanceLinkedAddress
                      ? governanceLinkedAddress.toLowerCase() === (GOVERNANCE_CONTRACT_ADDRESS || '').toLowerCase()
                        ? 'Linked'
                        : 'Custom'
                      : 'Not linked',
                    detail: governanceLinkedAddress ? shortHash(governanceLinkedAddress) : 'Payroll has not been bound to multi-admin yet.'
                  },
                  {
                    label: 'Ready approvals',
                    value: String(governanceReadyProposals.length),
                    detail: governanceReadyProposals.length
                      ? 'Ready for execution or final proposer action.'
                      : 'No approval-ready actions right now.'
                  }
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/55 font-bold">{item.label}</p>
                    <p className="mt-3 text-3xl font-black text-white">{item.value}</p>
                    <p className="mt-2 text-sm leading-5 text-[#a1a1aa]">{item.detail}</p>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Setup order</p>
                    <p className="mt-1 text-xs leading-5 text-[#a1a1aa]">Follow these from left to right. Once linked, sensitive actions move into the approval queue.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">1 Bootstrap</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">2 Add signers</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">3 Link payroll</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">4 Propose changes</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">5 Approve / execute</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Step 1</p>
                    <p className="mt-2 text-sm font-semibold text-white">Bootstrap multi-admin</p>
                    <p className="mt-1 text-xs leading-5 text-[#a1a1aa]">Initialize governance using the workspace reserved admin slots and quorum.</p>
                  </div>
                  <button
                    type="button"
                    onClick={bootstrapGovernance}
                    disabled={!canSubmitTransactions || !organization.exists || isBusy || governanceInitialized || !isAdmin}
                    className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
                  >
                    Set Up Multi-Admin
                  </button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Step 2</p>
                    <p className="mt-2 text-sm font-semibold text-white">Add bootstrap admin</p>
                    <p className="mt-1 text-xs leading-5 text-[#a1a1aa]">Use before governance is active to add the next signer without already needing quorum.</p>
                  </div>
                  <input
                    value={bootstrapAdminAddress}
                    onChange={(event) => setBootstrapAdminAddress(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/35"
                    placeholder="0x... admin wallet"
                  />
                  <button
                    type="button"
                    onClick={bootstrapGovernanceAdmin}
                    disabled={!canSubmitTransactions || !organization.exists || isBusy || !governanceInitialized || governanceActive || !bootstrapAdminSafeAddress || !isAdmin}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    Add Bootstrap Admin
                  </button>
                </div>

                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-50/65">Step 3</p>
                    <p className="mt-2 text-sm font-semibold text-cyan-50">Link payroll executor</p>
                    <p className="mt-1 text-xs leading-5 text-cyan-50/75">Bind this payroll workspace to governance so sensitive actions stop bypassing approval rules.</p>
                  </div>
                  <button
                    type="button"
                    onClick={linkGovernanceExecutor}
                    disabled={!canSubmitTransactions || !organization.exists || isBusy || !governanceInitialized || !isAdmin}
                    className="w-full rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/15 disabled:opacity-50"
                  >
                    Link Governance Executor
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Current signers</p>
                      <p className="mt-2 text-sm font-semibold text-white">Governance admins</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white/65">{governanceAdmins.length} admin{governanceAdmins.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {governanceAdmins.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-[#a1a1aa]">
                        No governance admins are registered yet.
                      </div>
                    ) : (
                      governanceAdmins.map((admin) => (
                        <div key={admin} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="font-mono text-sm text-white break-all">{admin}</p>
                            <span className="shrink-0 text-[11px] uppercase tracking-[0.16em] text-white/45">
                              {governanceOverview?.primaryAdmin?.toLowerCase() === admin.toLowerCase() ? 'Primary' : 'Signer'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Step 4</p>
                    <p className="mt-2 text-sm font-semibold text-white">Propose governance changes</p>
                    <p className="mt-1 text-xs leading-5 text-[#a1a1aa]">After multi-admin is active, admin and quorum changes enter the approval queue.</p>
                  </div>
                  <div className="mt-4 grid gap-3 xl:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                      <p className="text-sm font-semibold text-white">Add admin</p>
                      <input
                        value={newGovernanceAdminAddress}
                        onChange={(event) => setNewGovernanceAdminAddress(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/35"
                        placeholder="0x... new admin"
                      />
                      <button
                        type="button"
                        onClick={proposeGovernanceAdminAddition}
                        disabled={!canSubmitTransactions || !governanceActive || isBusy || !newGovernanceAdminSafeAddress}
                        className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
                      >
                        Propose Add
                      </button>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                      <p className="text-sm font-semibold text-white">Remove admin</p>
                      <input
                        value={governanceAdminToRemove}
                        onChange={(event) => setGovernanceAdminToRemove(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/35"
                        placeholder="0x... admin"
                      />
                      <button
                        type="button"
                        onClick={proposeGovernanceAdminRemoval}
                        disabled={!canSubmitTransactions || !governanceActive || isBusy || !governanceAdminToRemoveSafeAddress}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                      >
                        Propose Remove
                      </button>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                      <p className="text-sm font-semibold text-white">Update quorum</p>
                      <input
                        value={nextGovernanceQuorum}
                        onChange={(event) => setNextGovernanceQuorum(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/35"
                        placeholder="2"
                      />
                      <button
                        type="button"
                        onClick={proposeGovernanceQuorumUpdate}
                        disabled={!canSubmitTransactions || !governanceActive || isBusy || nextGovernanceQuorumValue === null}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                      >
                        Propose Quorum
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                  <FolderCog className="mt-1 h-5 w-5 text-cyan-300" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Step 5</p>
                    <h2 className="mt-2 text-2xl font-bold text-white">Pending approvals</h2>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-[#a1a1aa]">Approve, revoke, or execute governance proposals once enough admins have signed. Encrypted proposals may require the original proposer to return for the final wallet action.</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
                  {governanceProposals.length} proposal{governanceProposals.length === 1 ? '' : 's'}
                </div>
              </div>

              {governanceProposals.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-[#a1a1aa]">
                  No governance proposals have been created for this workspace yet.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {governanceProposals.map((proposal) => {
                    const expired = proposal.expiresAt <= Math.floor(Date.now() / 1000)
                    const quorumMet = governanceQuorum > 0 && proposal.approvalCount >= governanceQuorum
                    const canApprove = connectedWalletIsGovernanceAdmin && !proposal.executed && !proposal.cancelled && !expired && !proposal.approvedByCurrentAdmin
                    const canRevoke = connectedWalletIsGovernanceAdmin && !proposal.executed && !proposal.cancelled && proposal.approvedByCurrentAdmin
                    const canExecute = connectedWalletIsGovernanceAdmin && quorumMet && !proposal.requiresWalletExecutor && !proposal.executed && !proposal.cancelled && !expired

                    return (
                      <div key={proposal.proposalId} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold text-white">{proposal.actionLabel}</p>
                              {proposal.executed ? (
                                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300">Executed</span>
                              ) : proposal.cancelled ? (
                                <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-300">Cancelled</span>
                              ) : expired ? (
                                <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">Expired</span>
                              ) : quorumMet ? (
                                <span className="rounded-full bg-cyan-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
                                  {proposal.requiresWalletExecutor ? 'Ready for proposer' : 'Ready to execute'}
                                </span>
                              ) : (
                                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">Collecting approvals</span>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-[#c9c9d0]">
                              Proposed by <span className="font-mono text-white/80 break-all">{proposal.proposer}</span>
                            </p>
                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Approvals</p>
                                <p className="mt-2 text-xl font-black text-white">{proposal.approvalCount}/{governanceQuorum || '—'}</p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Created</p>
                                <p className="mt-2 text-sm text-white">{formatUnixTimestamp(proposal.createdAt)}</p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Expires</p>
                                <p className="mt-2 text-sm text-white">{formatUnixTimestamp(proposal.expiresAt)}</p>
                              </div>
                            </div>
                            <p className="mt-3 text-xs font-mono text-white/45 break-all">Proposal ID: {proposal.proposalId}</p>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-3 xl:w-[330px] xl:grid-cols-1">
                            <button
                              type="button"
                              onClick={() => void approveGovernanceProposal(proposal.proposalId)}
                              disabled={!canApprove || isBusy}
                              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => void revokeGovernanceProposalApproval(proposal.proposalId)}
                              disabled={!canRevoke || isBusy}
                              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                            >
                              Revoke
                            </button>
                            <button
                              type="button"
                              onClick={() => void executeGovernanceProposal(proposal.proposalId)}
                              disabled={!canExecute || isBusy}
                              className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/15 disabled:opacity-50"
                            >
                              Execute
                            </button>
                          </div>
                        </div>

                        {proposal.requiresWalletExecutor && quorumMet && !proposal.executed && !proposal.cancelled && !expired ? (
                          <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                            Final wallet execution is required. Return to the matching payroll action and have the <span className="font-mono">{shortHash(proposal.proposer)}</span> proposer submit the encrypted transaction from their wallet so CipherRoll can consume this approved intent.
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </GlassCard>
          </div>
        )}

        {activePortal === 'auditor' && (
          <div className="grid lg:grid-cols-[0.95fr,1.05fr] gap-8 mt-8">
            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <FileKey2 className="w-5 h-5 text-cyan-300" />
                <h2 className="text-2xl font-bold text-white">Create auditor sharing payload</h2>
              </div>

              <div className="space-y-4">
                <input
                  value={auditorName}
                  onChange={(event) => setAuditorName(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                  placeholder="Auditor name"
                />
                <input
                  value={auditorRecipientAddress}
                  onChange={(event) => setAuditorRecipientAddress(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                  placeholder="Auditor wallet address"
                />
                <input
                  value={auditorPermitName}
                  onChange={(event) => setAuditorPermitName(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                  placeholder="Access code name"
                />
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-white/55">Permit expiration</label>
                  <input
                    type="datetime-local"
                    value={auditorPermitExpirationInput}
                    onChange={(event) => setAuditorPermitExpirationInput(event.target.value)}
                    className="cipherroll-date-input w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                  />
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-cyan-400/15 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                <p className="font-semibold text-white">Aggregate-only share</p>
                <p className="mt-2 text-cyan-50/90">Budget, committed payroll, runway, run counts, and funding status. No employee salary rows.</p>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-[#c9c9d0]">
                <p className="font-semibold text-white">Share preview</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Recipient</p>
                    <p className="mt-1 text-white">{auditorRecipientSafeAddress || 'Add address'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Expires</p>
                    <p className="mt-1 text-white">{auditorPermitExpirationTimestamp ? new Date(auditorPermitExpirationTimestamp * 1000).toLocaleString() : 'Pick a time'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Scope</p>
                    <p className="mt-1 text-white">Audit review</p>
                  </div>
                </div>
              </div>

              {auditorPermitExpiresSoon && (
                <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                  This permit expires in under one hour. That is allowed, but make sure the auditor will import it immediately.
                </div>
              )}

              <button
                onClick={createAuditorPermit}
                disabled={!canSubmitTransactions || !cofheReady || !organization.exists || !isAdmin || isBusy || !auditorRecipientSafeAddress || !auditorPermitExpirationTimestamp}
                className="mt-6 w-full rounded-2xl bg-white text-black px-4 py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
              >
                Create Auditor Access Code
              </button>
            </GlassCard>

            <div className="space-y-6">
              <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <ShieldCheck className="w-5 h-5 text-emerald-300" />
                  <div>
                    <h2 className="text-2xl font-bold text-white">Current sharing permits</h2>
                    
                  </div>
                </div>

                <div className="space-y-3">
                  {auditorSharingPermits.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-[#a1a1aa]">
                      No auditor sharing permits have been created in this browser session yet.
                    </div>
                  ) : (
                    auditorSharingPermits.map((permit) => (
                      <div key={permit.hash} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="font-semibold text-white">{permit.name}</p>
                            <p className="mt-2 text-sm text-[#c9c9d0]">Recipient: <span className="font-mono text-white/85">{permit.recipient}</span></p>
                            <p className="mt-1 text-sm text-[#c9c9d0]">Expires: {new Date(permit.expiration * 1000).toLocaleString()}</p>
                            <p className="mt-1 text-xs text-white/45 font-mono break-all">Hash: {permit.hash}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setAuditorExportPayload(permit.exportPayload)}
                              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
                            >
                              View Payload
                            </button>
                            <button
                              type="button"
                              onClick={() => void copyAuditorPayload(permit.exportPayload)}
                              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
                            >
                              <Copy className="h-4 w-4" />
                              Copy
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteAuditorPermit(permit.hash)}
                              className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-400/15"
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>

              <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <KeyRound className="w-5 h-5 text-cyan-300" />
                  <div>
                    <h2 className="text-2xl font-bold text-white">Export payload</h2>
                  </div>
                </div>

                <textarea
                  readOnly
                  value={auditorExportPayload}
                  className="min-h-[280px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/85 font-mono"
                  placeholder="Create or select an auditor access code to reveal the export code here."
                />

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void copyAuditorPayload(auditorExportPayload)}
                    disabled={!auditorExportPayload}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Payload
                  </button>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#c9c9d0]">
                    Share this with the auditor.
                  </div>
                </div>
                
              </GlassCard>
            </div>
          </div>
        )}

        {activePortal === 'budget' && (
          <div className="grid lg:grid-cols-[1.08fr,0.92fr] gap-8 mt-8">
            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <FolderCog className="w-5 h-5 text-cyan-300" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Prepare payroll budget</h2>
                  
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                  <input
                  value={budgetAmount}
                  onChange={(event) => setBudgetAmount(event.target.value)}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                  placeholder={suggestedPayrollAmountDisplay ?? '25.5'}
                />
                <button
                  onClick={depositBudget}
                  disabled={!canEncryptInputs || !organization.exists || !isAdmin || isBusy || budgetAmountInWei === null}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-black px-5 py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                >
                  {pendingAdminAction === 'depositBudget' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {pendingAdminAction === 'depositBudget' ? 'Preparing MetaMask…' : 'Deposit Budget'}
                </button>
              </div>

              {!organization.exists && (
                <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                  Create or load a workspace first; CipherRoll will guide the next funding step here.
                </div>
              )}

              {organization.exists && !cofheReady && (
                <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                  Enable privacy mode before budget funding so the amount can be encrypted in this browser.
                </div>
              )}

              {budgetAmount.trim() && budgetAmountInWei === null && (
                <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-50">
                  Budget input must be a positive decimal number with up to 18 decimal places.
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <ShieldCheck className="w-5 h-5 text-emerald-300" />
                  <div>
                    <h2 className="text-2xl font-bold text-white">Private budget summary</h2>
                  </div>
                </div>

              <div className="grid gap-4 sm:grid-cols-3">
                  {summaryCards.map((item) => (
                    <div key={item.label} className="relative min-w-0 rounded-2xl border border-white/10 bg-white/5 p-5 overflow-hidden">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs uppercase tracking-[0.16em] text-white/55 font-bold">{item.label}</p>
                        {item.value ? (
                          <div className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Decrypted</div>
                        ) : (
                          <div className="bg-white/10 text-white/50 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Locked</div>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-black text-white">{item.value ?? '***'}</p>
                        {item.value && <span className="text-sm text-white/50 font-semibold">ETH</span>}
                      </div>
                    </div>
                  ))}
              </div>
            </GlassCard>
          </div>
        )}

        {activePortal === 'payroll' && (
          <div className="space-y-8 mt-8">
            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                <h2 className="text-xl font-bold text-white">Run snapshot</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-[1.2fr,1fr,1fr]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-[#c9c9d0]">
                  <p className="text-white font-semibold">Status: {payrollRunStatusLabel}</p>
                  {!payrollRunExists && <p className="mt-3 text-amber-200">No payroll run yet.</p>}
                  {payrollRunExists && payrollRun.allocationCount === 0 && (
                    <p className="mt-3 text-amber-200">Add the employee allocation before funding.</p>
                  )}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Allocations</p>
                  <p className="mt-2 text-3xl font-black text-white">
                    {payrollRunExists ? payrollRun.allocationCount : 0}
                    <span className="ml-2 text-sm font-semibold text-white/45">/ {payrollRunExists ? payrollRun.plannedHeadcount : 0}</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Claims</p>
                  <p className="mt-2 text-3xl font-black text-white">{payrollRunExists ? payrollRun.claimedCount : 0}</p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-5 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  {
                    id: 'single',
                    title: 'Pay One Employee',
                    detail: 'One wallet, one encrypted allocation, then fund and activate.'
                  },
                  {
                    id: 'batch',
                    title: 'Pay Multiple Employees',
                    detail: 'Import CSV, create an auto-sized run, seal rows, then submit the batch.'
                  }
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPayrollWorkflow(option.id as 'single' | 'batch')}
                    className={`rounded-2xl border px-5 py-4 text-left transition-colors ${
                      payrollWorkflow === option.id
                        ? 'border-white/30 bg-white text-black'
                        : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                    }`}
                  >
                    <span className="block text-sm font-bold">{option.title}</span>
                    <span className={`mt-1 block text-xs leading-5 ${payrollWorkflow === option.id ? 'text-black/65' : 'text-white/55'}`}>
                      {option.detail}
                    </span>
                  </button>
                ))}
              </div>
            </GlassCard>

            {payrollWorkflow === 'single' ? (
            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <KeyRound className="w-5 h-5 text-cyan-300" />
                <h2 className="text-2xl font-bold text-white">Pay one employee</h2>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
                  <p className="text-sm font-semibold text-white">Step 1: Create the payroll run</p>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-[#a1a1aa]">
                    Run size is auto-set to 1 employee for this single-payment flow.
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedRunSettings((current) => !current)}
                    className="w-fit rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                  >
                    {showAdvancedRunSettings ? 'Hide advanced run settings' : 'Advanced run settings'}
                  </button>
                  {showAdvancedRunSettings ? (
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <label className="space-y-2 text-sm block">
                        <span className="text-white/70">Payroll run label</span>
                        <input
                          value={selectedPayrollRunInput}
                          onChange={(event) => setSelectedPayrollRunInput(event.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/35"
                          placeholder="may-2026-payroll"
                        />
                      </label>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-[#a1a1aa]">
                        <p>Advanced privacy note: readable run labels are easier to guess. Use a safer run ID when that matters.</p>
                        <button
                          type="button"
                          onClick={assignHighEntropyPayrollRunLabel}
                          className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-white transition-colors hover:bg-white/10"
                        >
                          Use safer run ID
                        </button>
                      </div>
                      <label className="space-y-2 text-sm block">
                        <span className="text-white/70">Funding deadline</span>
                        <input
                          type="datetime-local"
                          value={payrollFundingDeadlineInput}
                          onChange={(event) => setPayrollFundingDeadlineInput(event.target.value)}
                          className="cipherroll-date-input w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white"
                        />
                      </label>
                    </div>
                  ) : null}
                  {!showAdvancedRunSettings ? (
                    <button
                      type="button"
                      onClick={assignHighEntropyPayrollRunLabel}
                      className="w-fit rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      Generate safer run ID
                    </button>
                  ) : null}
                  <button
                    onClick={createPayrollRun}
                    disabled={!canSubmitTransactions || isBusy || !organization.exists || plannedHeadcountForCreate > 500}
                    className="w-full rounded-2xl bg-white text-black px-4 py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                  >
                    Create Run
                  </button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                  <p className="text-sm font-semibold text-white">Step 2: Add the employee allocation</p>
                  <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/5 p-2">
                    {[
                      { id: 'instant', label: 'Instant payroll' },
                      { id: 'vesting', label: 'Vesting payroll' }
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setPayrollMode(option.id as 'instant' | 'vesting')}
                        className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                          payrollMode === option.id
                            ? 'bg-white text-black'
                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <input
                    value={employeeAddress}
                    onChange={(event) => setEmployeeAddress(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                    placeholder="Employee wallet address"
                  />
                  <div className="grid gap-3 md:grid-cols-[1fr,0.8fr]">
                    <input
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                      placeholder={`3.5 (${TARGET_CHAIN_NAME})`}
                    />
                    {showPaymentMemoInput ? (
                      <input
                        value={paymentMemo}
                        onChange={(event) => setPaymentMemo(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                        placeholder="Optional memo"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowPaymentMemoInput(true)}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
                      >
                        Add memo
                      </button>
                    )}
                  </div>
                  {payrollMode === 'vesting' && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-sm">
                        <span className="text-white/70">Vesting start</span>
                        <input
                          type="datetime-local"
                          value={vestingStartInput}
                          onChange={(event) => setVestingStartInput(event.target.value)}
                          className="cipherroll-date-input w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="text-white/70">Vesting end</span>
                        <input
                          type="datetime-local"
                          value={vestingEndInput}
                          onChange={(event) => setVestingEndInput(event.target.value)}
                          className="cipherroll-date-input w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                        />
                      </label>
                    </div>
                  )}
                  <button
                    onClick={issuePayroll}
                    disabled={
                      !canEncryptInputs ||
                      !organization.exists ||
                      (!isAdmin && !governanceActive) ||
                      isBusy ||
                      !payrollRunOpenForAllocations ||
                      paymentAmountInWei === null ||
                      !safeAddress(employeeAddress) ||
                      payrollWouldZeroOut ||
                      vestingWindowInvalid
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white text-black px-4 py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                  >
                    {pendingAdminAction === 'issuePayroll' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {pendingAdminAction === 'issuePayroll'
                      ? 'Preparing MetaMask…'
                      : payrollMode === 'vesting'
                        ? 'Issue Vesting Payroll'
                        : 'Issue Private Payroll'}
                  </button>
                </div>

                {hasTreasuryRoute && (
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5 space-y-3">
                    <p className="text-sm font-semibold text-emerald-50">Step 3: Fund treasury</p>
                    <div className="grid gap-3 md:grid-cols-[1fr,auto]">
                      <input
                        value={treasuryDepositAmount}
                        onChange={(event) => setTreasuryDepositAmount(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/35"
                      placeholder={suggestedPayrollAmountDisplay ?? 'Treasury deposit amount'}
                      />
                      <button
                        onClick={depositTreasuryFunds}
                        disabled={!canSubmitTransactions || isBusy || treasuryDepositAmountInWei === null}
                        className="rounded-2xl bg-white text-black px-4 py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                      >
                        Fund Treasury
                      </button>
                    </div>
                    <div className="grid gap-2 text-sm text-emerald-50 sm:grid-cols-2">
                      <p>Available: {treasuryAvailableFundsDisplay}</p>
                      <p>Reserved: {treasuryReservedFundsDisplay}</p>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-3">
                  <p className="text-sm font-semibold text-white">
                    {hasTreasuryRoute ? 'Step 4: Reserve funds' : 'Step 3: Fund the run'}
                  </p>
                  <div className="grid gap-3 md:grid-cols-[1fr,auto]">
                    <input
                      value={payrollFundingAmount}
                      onChange={(event) => setPayrollFundingAmount(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/35"
                      placeholder={suggestedPayrollAmountDisplay ?? 'Funding amount'}
                    />
                    <button
                      onClick={fundPayrollRun}
                      disabled={
                        !(hasTreasuryRoute ? canSubmitTransactions : canEncryptInputs) ||
                        isBusy ||
                        !payrollRunExists ||
                        payrollFundingAmountInWei === null
                      }
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                    >
                      {hasTreasuryRoute ? 'Reserve Treasury Funds' : 'Fund Run'}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5 space-y-3">
                  <p className="text-sm font-semibold text-cyan-50">
                    {hasTreasuryRoute ? 'Step 5: Activate employee claims' : 'Step 4: Activate employee claims'}
                  </p>
                  <button
                    onClick={activatePayrollRun}
                    disabled={!canSubmitTransactions || isBusy || !payrollRunExists || payrollRun.status !== 1}
                    className="w-full rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/15 disabled:opacity-50"
                  >
                    Activate Claim Window
                  </button>
                </div>
              </div>

              {paymentAmount.trim() && paymentAmountInWei === null && (
                <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-50">
                  Payroll amount must be a positive decimal number with up to 18 decimal places.
                </div>
              )}

              {payrollWouldZeroOut && (
                <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-50">
                  The decrypted available budget is lower than this request. To avoid the contract&apos;s zero-allocation fallback, the portal blocks submission until the budget is increased or the amount is reduced.
                </div>
              )}

              {payrollMode === 'vesting' && vestingWindowInvalid && (
                <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-50">
                  Choose a vesting start and end time, and make sure the end time is later than the start time.
                </div>
              )}

              {organization.exists && !cofheReady && (
                <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                  Enable privacy mode before issuing payroll so the amount can be encrypted in this browser.
                </div>
              )}
            </GlassCard>
            ) : null}

            {payrollWorkflow === 'batch' ? (
            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <FolderCog className="w-5 h-5 text-violet-300" />
                    <h2 className="text-2xl font-bold text-white">Batch payroll workspace</h2>
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[#a1a1aa]">
                    Build multiple payroll rows locally, review them, seal encrypted salaries in the browser, then submit retryable row transactions against the existing contract surface. CSV data and role salaries never leave this browser.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
                  Stage: <span className="font-semibold capitalize">{batchPayrollStage}</span>
                </div>
              </div>

              {governanceActive ? (
                <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                  Batch payroll is paused for governed workspaces because each encrypted issuance requires quorum approval. Use the one-employee governed flow for now.
                </div>
              ) : null}

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Execution order</p>
                    <p className="mt-1 text-xs leading-5 text-[#a1a1aa]">
                      Import and clean rows, create the run, review and seal salaries, submit the batch, then fund and activate claims.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">1 Import</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">2 Create run</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">3 Review</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">4 Seal</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">5 Submit</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">6 Fund</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">7 Activate</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr,0.85fr]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 lg:order-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Optional setup</p>
                      <p className="mt-2 text-sm font-semibold text-white">Role salaries</p>
                      {!showBatchRoleEditor ? (
                        <p className="mt-1 text-xs text-[#a1a1aa]">Only edit when CSV rows use role salaries or validation asks for cleanup.</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBatchRoleEditor((current) => !current)}
                      className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                    >
                      {showBatchRoleEditor ? 'Hide editor' : 'Edit roles'}
                    </button>
                  </div>
                  {!showBatchRoleEditor ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {batchPayrollRoles.map((role) => (
                        <span key={role.id} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/70">
                          {role.label}{role.baseSalary ? ` · ${role.baseSalary}` : ''}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <button
                        type="button"
                        onClick={addBatchPayrollRole}
                        disabled={batchPayrollStage === 'sealed'}
                        className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                      >
                        Add role
                      </button>
                      {batchPayrollRoles.map((role) => (
                        <div key={role.id} className="grid gap-3 md:grid-cols-[1fr,0.75fr]">
                          <input
                            value={role.label}
                            onChange={(event) => updateBatchPayrollRole(role.id, { label: event.target.value })}
                            disabled={batchPayrollStage === 'sealed'}
                            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/35 disabled:opacity-60"
                            placeholder="Role label"
                          />
                          <input
                            value={batchPayrollStage === 'sealed' ? '★★★★★' : role.baseSalary}
                            onChange={(event) => updateBatchPayrollRole(role.id, { baseSalary: event.target.value })}
                            disabled={batchPayrollStage === 'sealed'}
                            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/35 disabled:opacity-60"
                            placeholder="Base salary"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 lg:order-1">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Step 1</p>
                      <p className="mt-2 text-sm font-semibold text-white">Import employee CSV</p>
                      <p className="mt-1 text-xs text-[#a1a1aa]">
                        CSV columns: <span className="font-semibold text-white/80">employee, role, salary, memo</span>. Headers and role names are case-insensitive; save Excel files as CSV UTF-8 first.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">
                        Browser-only CSV import
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          className="hidden"
                          onChange={(event) => {
                            void importBatchPayrollCsv(event.target.files?.[0] ?? null)
                            event.currentTarget.value = ''
                          }}
                        />
                      </label>
                      <div className="group relative">
                        <button
                          type="button"
                          aria-label="CSV import format help"
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 hover:bg-white/10 hover:text-white"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                        <div className="pointer-events-none absolute right-0 top-12 z-20 hidden w-80 rounded-2xl border border-white/10 bg-[#101010] p-4 text-xs leading-5 text-white/75 shadow-2xl group-hover:block">
                          Import a real <span className="font-semibold text-white">.csv</span> file, not <span className="font-semibold text-white">.xlsx</span>. Required columns are <span className="font-semibold text-white">employee</span> and <span className="font-semibold text-white">role</span>; optional columns are <span className="font-semibold text-white">salary</span> and <span className="font-semibold text-white">memo</span>. Headers and role matching are case-insensitive. Employee must be an EVM <span className="font-semibold text-white">0x...</span> address. Role must match the local role table. Leave salary empty to use that role&apos;s base salary.
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-[#71717a]">
                    Example: <span className="font-mono text-white/70">employee,role,salary,memo</span> then <span className="font-mono text-white/70">0xabc...,Engineer,,January payroll</span>.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Rows</p>
                      <p className="mt-2 text-xl font-black text-white">{batchPayrollRows.length}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Visible total</p>
                      <p className="mt-2 text-xl font-black text-white">{batchPayrollVisibleTotal}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Confirmed</p>
                      <p className="mt-2 text-xl font-black text-white">{batchPayrollConfirmedRows.length}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Ready / slots</p>
                      <p className="mt-2 text-xl font-black text-white">{batchPayrollSubmittableRows.length} / {payrollRunRemainingAllocationSlots}</p>
                    </div>
                  </div>
                  {batchPayrollCsvName ? (
                    <p className="mt-3 text-xs text-white/45">Imported locally: {batchPayrollCsvName}</p>
                  ) : null}
                  {payrollRunOpenForAllocations && batchPayrollSubmittableRows.length > payrollRunRemainingAllocationSlots ? (
                    <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs leading-5 text-amber-50">
                      This selected run has {payrollRunRemainingAllocationSlots} remaining slot(s), but the sealed batch has {batchPayrollSubmittableRows.length} payable row(s). Create a new run after importing the CSV so all employees can submit in one pass.
                    </div>
                  ) : null}
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Batch allocation mode</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {[
                        { id: 'instant', label: 'Instant' },
                        { id: 'vesting', label: 'Vesting' }
                      ].map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setBatchPayrollMode(option.id as 'instant' | 'vesting')}
                          disabled={batchPayrollStage === 'sealed'}
                          className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                            batchPayrollMode === option.id ? 'bg-white text-black' : 'bg-white/5 text-white/70'
                          } disabled:opacity-50`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    {batchPayrollMode === 'vesting' ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        <input
                          type="datetime-local"
                          value={vestingStartInput}
                          onChange={(event) => setVestingStartInput(event.target.value)}
                          disabled={batchPayrollStage === 'sealed'}
                          className="cipherroll-date-input rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white disabled:opacity-50"
                        />
                        <input
                          type="datetime-local"
                          value={vestingEndInput}
                          onChange={(event) => setVestingEndInput(event.target.value)}
                          disabled={batchPayrollStage === 'sealed'}
                          className="cipherroll-date-input rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white disabled:opacity-50"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Step 2</p>
                    <p className="mt-2 text-sm font-semibold text-white">Create the payroll run</p>
                    <p className="mt-1 text-xs leading-5 text-[#a1a1aa]">
                      The run is auto-sized to {plannedHeadcountForCreate} employee{plannedHeadcountForCreate === 1 ? '' : 's'} from the current batch rows.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedRunSettings((current) => !current)}
                      className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
                    >
                      {showAdvancedRunSettings ? 'Hide Advanced' : 'Advanced Run Settings'}
                    </button>
                    <button
                      onClick={createPayrollRun}
                      disabled={!canSubmitTransactions || isBusy || !organization.exists || plannedHeadcountForCreate > 500}
                      className="rounded-2xl bg-white text-black px-6 py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                    >
                      Create Run
                    </button>
                  </div>
                </div>

                {showAdvancedRunSettings ? (
                  <div className="mt-4 grid gap-3 lg:grid-cols-[1fr,1fr]">
                    <label className="space-y-2 text-sm block">
                      <span className="text-white/70">Payroll run label</span>
                      <input
                        value={selectedPayrollRunInput}
                        onChange={(event) => setSelectedPayrollRunInput(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/35"
                        placeholder="may-2026-payroll"
                      />
                    </label>
                    <label className="space-y-2 text-sm block">
                      <span className="text-white/70">Funding deadline</span>
                      <input
                        type="datetime-local"
                        value={payrollFundingDeadlineInput}
                        onChange={(event) => setPayrollFundingDeadlineInput(event.target.value)}
                        className="cipherroll-date-input w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white"
                      />
                    </label>
                    <div className="lg:col-span-2 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-[#a1a1aa]">
                      <p>Advanced privacy note: readable run labels are easier to guess. Use a safer run ID when that matters.</p>
                      <button
                        type="button"
                        onClick={assignHighEntropyPayrollRunLabel}
                        className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-white transition-colors hover:bg-white/10"
                      >
                        Use safer run ID
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Employee rows</p>
                    <p className="mt-1 text-xs leading-5 text-[#a1a1aa]">Check imported addresses, roles, optional salary overrides, and memos before reviewing the batch.</p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold capitalize text-white/65">
                    Stage: {batchPayrollStage}
                  </div>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="min-w-[900px] w-full text-left text-sm">
                  <thead className="bg-white/5 text-[11px] uppercase tracking-[0.16em] text-white/45">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Salary / Override</th>
                      <th className="px-4 py-3">Memo</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {batchPayrollRows.map((row) => {
                      const validation = batchPayrollValidation.find((item) => item.id === row.id)
                      const rowRoleExists = batchPayrollRoles.some((role) => role.slug === row.roleSlug)
                      return (
                        <tr key={row.id} className="bg-black/15">
                          <td className="px-4 py-3">
                            <input
                              value={row.employeeAddress}
                              onChange={(event) => updateBatchPayrollRow(row.id, { employeeAddress: event.target.value, status: 'draft' })}
                              disabled={batchPayrollStage === 'sealed'}
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white disabled:opacity-60"
                              placeholder="0x..."
                            />
                            {validation?.errors.includes('Invalid employee address.') ? <p className="mt-1 text-xs text-rose-300">Invalid employee address</p> : null}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={row.roleSlug}
                              onChange={(event) => {
                                const nextRole = batchPayrollRoles.find((role) => role.slug === event.target.value)
                                updateBatchPayrollRow(row.id, { roleSlug: event.target.value, roleLabel: nextRole?.label ?? event.target.value, status: 'draft' })
                              }}
                              disabled={batchPayrollStage === 'sealed'}
                              className="w-full rounded-xl border border-white/10 bg-[#101018] px-3 py-2 text-white disabled:opacity-60"
                            >
                              {!rowRoleExists && row.roleSlug ? (
                                <option value={row.roleSlug}>Unknown role: {row.roleSlug}</option>
                              ) : null}
                              {batchPayrollRoles.map((role) => (
                                <option key={role.id} value={role.slug}>{role.label}</option>
                              ))}
                            </select>
                            {validation?.errors.includes('Unknown role.') ? <p className="mt-1 text-xs text-rose-300">Unknown role. Add it to the local role table or choose an existing role.</p> : null}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              value={batchPayrollStage === 'sealed' ? '★★★★★' : row.amount}
                              onChange={(event) => updateBatchPayrollRow(row.id, { amount: event.target.value, status: 'draft' })}
                              disabled={batchPayrollStage === 'sealed'}
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white disabled:opacity-60"
                              placeholder="Uses role salary"
                            />
                            {validation?.errors.some((error) => error.includes('salary')) ? (
                              <p className="mt-1 text-xs text-rose-300">
                                {validation.errors.filter((error) => error.includes('salary')).join(' ')}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              value={row.memo}
                              onChange={(event) => updateBatchPayrollRow(row.id, { memo: event.target.value, status: 'draft' })}
                              disabled={batchPayrollStage === 'sealed'}
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white disabled:opacity-60"
                              placeholder="Optional"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs capitalize text-white/75">{row.status}</span>
                            {row.txHash ? <p className="mt-1 text-xs text-emerald-300">Tx {shortHash(row.txHash)}</p> : null}
                            {row.error ? <p className="mt-1 text-xs text-rose-300">{row.error}</p> : null}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => removeBatchPayrollRow(row.id)}
                              disabled={batchPayrollStage === 'sealed' || batchPayrollRows.length <= 1}
                              className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-40"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Steps 3–5</p>
                    <p className="mt-2 text-sm font-semibold text-white">Review, seal, and submit allocations</p>
                    <p className="mt-1 text-xs leading-5 text-[#a1a1aa]">
                      Review validates rows, seal encrypts salaries in-browser, and submit sends one wallet transaction per payable employee.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addBatchPayrollRow}
                    disabled={batchPayrollStage === 'sealed'}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    Add Manual Row
                  </button>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <button
                    type="button"
                    onClick={prepareBatchPayrollReview}
                    disabled={governanceActive || isBusy || batchPayrollRows.length === 0}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    Step 3: Review Batch
                  </button>
                  <button
                    type="button"
                    onClick={() => void sealBatchPayroll()}
                    disabled={governanceActive || isBatchPayrollSealing || batchPayrollStage !== 'review' || !canEncryptInputs}
                    className="rounded-2xl bg-white px-4 py-4 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
                  >
                    {isBatchPayrollSealing ? 'Sealing...' : 'Step 4: Seal Salaries'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitBatchPayrollQueue()}
                    disabled={governanceActive || isBatchPayrollSubmitting || batchPayrollStage !== 'sealed' || !payrollRunOpenForAllocations || payrollRunRemainingAllocationSlots <= 0 || batchPayrollSubmittableRows.length === 0 || batchPayrollSubmittableRows.length > payrollRunRemainingAllocationSlots}
                    className="rounded-2xl border border-violet-400/20 bg-violet-400/10 px-4 py-4 text-sm font-semibold text-violet-50 hover:bg-violet-400/15 disabled:opacity-50"
                  >
                    {isBatchPayrollSubmitting ? 'Submitting...' : 'Step 5: Submit Batch'}
                  </button>
                </div>
              </div>

              {batchPayrollProgress ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-[#c9c9d0]">
                  {batchPayrollProgress}
                </div>
              ) : null}

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                    {hasTreasuryRoute ? 'Steps 6–8' : 'Steps 6–7'}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">{hasTreasuryRoute ? 'Fund treasury, reserve, and activate claims' : 'Fund run and activate claims'}</p>
                  <p className="mt-1 text-xs leading-5 text-[#a1a1aa]">
                    These final actions happen after batch row transactions are confirmed.
                  </p>
                </div>
                <div className={`mt-4 grid gap-3 ${hasTreasuryRoute ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
                  {hasTreasuryRoute ? (
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 space-y-3">
                      <p className="text-sm font-semibold text-emerald-50">Step 6: Fund treasury</p>
                      <input
                        value={treasuryDepositAmount}
                        onChange={(event) => setTreasuryDepositAmount(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/35"
                        placeholder={suggestedPayrollAmountDisplay ?? 'Treasury deposit amount'}
                      />
                      <button
                        onClick={depositTreasuryFunds}
                        disabled={!canSubmitTransactions || isBusy || treasuryDepositAmountInWei === null}
                        className="w-full rounded-2xl bg-white text-black px-4 py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                      >
                        Fund Treasury
                      </button>
                    </div>
                  ) : null}
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                    <p className="text-sm font-semibold text-white">{hasTreasuryRoute ? 'Step 7: Reserve funds' : 'Step 6: Fund run'}</p>
                    <input
                      value={payrollFundingAmount}
                      onChange={(event) => setPayrollFundingAmount(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/35"
                      placeholder={suggestedPayrollAmountDisplay ?? 'Funding amount'}
                    />
                    <button
                      onClick={fundPayrollRun}
                      disabled={
                        !(hasTreasuryRoute ? canSubmitTransactions : canEncryptInputs) ||
                        isBusy ||
                        !payrollRunExists ||
                        payrollFundingAmountInWei === null
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                    >
                      {hasTreasuryRoute ? 'Reserve Treasury Funds' : 'Fund Run'}
                    </button>
                  </div>
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 space-y-3">
                    <p className="text-sm font-semibold text-cyan-50">{hasTreasuryRoute ? 'Step 8: Activate claims' : 'Step 7: Activate claims'}</p>
                    <p className="text-xs leading-5 text-cyan-50/70">Open the employee claim window once the run is funded.</p>
                    <button
                      onClick={activatePayrollRun}
                      disabled={!canSubmitTransactions || isBusy || !payrollRunExists || payrollRun.status !== 1}
                      className="w-full rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/15 disabled:opacity-50"
                    >
                      Activate Claim Window
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Audit/debug details</p>
                    <p className="mt-1 text-xs text-[#a1a1aa]">Safe role labels and tx refs. No salary amounts are stored here.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBatchAuditDetails((current) => !current)}
                      className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                    >
                      {showBatchAuditDetails ? 'Hide' : 'Show'}
                    </button>
                    {showBatchAuditDetails ? (
                      <button
                        type="button"
                        onClick={() => void loadBatchPayrollManifests()}
                        className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                      >
                        Refresh
                      </button>
                    ) : null}
                  </div>
                </div>
                {showBatchAuditDetails ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {batchPayrollManifests.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-[#a1a1aa]">
                        No batch manifests are stored for this payroll run yet.
                      </div>
                    ) : (
                      batchPayrollManifests.slice(0, 6).map((manifest) => (
                        <div key={manifest.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-[#c9c9d0]">
                          <p className="font-semibold text-white">{manifest.roleLabel}</p>
                          <p className="mt-1 font-mono text-xs text-white/55">{manifest.employee}</p>
                          <p className="mt-2 text-xs text-white/45">Payment {formatBytes32Preview(manifest.paymentId)}</p>
                          <p className="mt-1 text-xs text-emerald-300">Tx {shortHash(manifest.txHash)}</p>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            </GlassCard>
            ) : null}
          </div>
        )}

      </div>

      <AnimatePresence>
        {showGuide && (
          <div className="fixed inset-0 z-[10000] overflow-y-auto bg-black/76 p-5 pt-24 md:pt-28">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative mx-auto mt-2 flex max-h-[calc(100vh-7rem)] w-full max-w-[720px] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#080808] shadow-2xl md:mt-4 md:max-h-[calc(100vh-8rem)]"
            >
              <div className="overflow-y-auto p-6 md:p-7">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                      <Zap className="w-4.5 h-4.5 text-white/85" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white leading-tight">Admin guide</h2>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">CipherRoll flow</p>
                    </div>
                  </div>
                </div>

                <p className="mb-5 max-w-2xl text-[13px] leading-6 text-white/42">
                  Follow this sequence for the cleanest operator experience. It reflects the real Wave 5 product flow from workspace creation through settlement review and covers governance, batch payroll, treasury exposure, and compliance exports.
                </p>

                <div className="space-y-3">
                  {[
                    {
                      step: "01",
                      title: "Connect the admin wallet on Arbitrum Sepolia",
                      desc: "Connect your admin wallet and confirm the network. CipherRoll will initialize the CoFHE client automatically.",
                      icon: Wallet
                    },
                    {
                      step: "02",
                      title: "Enable secure view before any encrypted operations",
                      desc: "Turn on secure view before funding budget, viewing summaries, or performing any action that depends on encrypted data. This authorizes your browser to decrypt ciphertext handles locally.",
                      icon: KeyRound
                    },
                    {
                      step: "03",
                      title: "Create the workspace and configure the treasury route",
                      desc: "Register the organization, set up the treasury route (direct or FHERC20 wrapper-backed), and refresh until workspace details and admin role appear correctly.",
                      icon: Building2
                    },
                    {
                      step: "04",
                      title: "Set up M-of-N governance for sensitive actions",
                      desc: "If this workspace needs governed execution, add governance admins and set the quorum before any payroll issuance, treasury route changes, or quorum updates require approval. Operational actions like funding and activation remain single-admin.",
                      icon: ShieldCheck
                    },
                    {
                      step: "05",
                      title: "Fund the encrypted budget and confirm summary refresh",
                      desc: "Deposit payroll funds into the treasury, then refresh the dashboard so the encrypted budget, committed payroll, and available runway update correctly.",
                      icon: FolderCog
                    },
                    {
                      step: "06",
                      title: "Create a payroll run, issue allocations, fund, and activate claims",
                      desc: "Create the payroll cycle. Use single-row issuance for governed workspaces or the batch workspace for browser-local CSV import with sealed salaries. Reserve treasury funds, then activate claims so employees can self-claim.",
                      icon: ShieldCheck
                    },
                    {
                      step: "07",
                      title: "Review treasury exposure, reporting, and auditor access",
                      desc: "Check the treasury exposure panel for route health, payout backlog, and reserve posture. Export reports, review workflow notifications, and set up auditor permit sharing only after payroll is in the state you want to disclose.",
                      icon: FileKey2
                    }
                  ].map((item) => (
                    <div key={item.step} className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-[9px] font-black text-white/55">
                        {item.step}
                      </div>
                      <div>
                        <div className="mb-0.5 flex items-center gap-2">
                           <item.icon className="w-3.5 h-3.5 text-white/38" />
                           <h4 className="text-[13px] font-semibold text-white">{item.title}</h4>
                        </div>
                        <p className="text-[12px] leading-relaxed text-white/42">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/8 pt-5">
                  <button
                    onClick={remindGuideLater}
                    className="text-sm font-medium text-white/38 transition-colors hover:text-white/62"
                  >
                    Remind me later
                  </button>

                  <button
                    onClick={dismissGuideForever}
                    className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-all hover:bg-white/92 active:scale-[0.98]"
                  >
                    Ok, I understand
                    {" "}
                    don&apos;t show again
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <CipherBotWidget
        scope="admin"
        headline="Your contextual guide for CipherRoll admin operations."
        intro="Ask about workspace setup, treasury funding, payroll activation, wrapper settlement, or auditor sharing. I will keep the answer practical and aligned with the current admin flow."
        organizationId={orgId}
        liveContext={{
          reportSummary: backendReport
            ? {
                pendingClaims: backendReport.pendingClaims,
                pendingSettlementRequests: backendReport.pendingSettlementRequests,
                activePayrollRuns: backendReport.activePayrollRuns,
                settledPayments: backendReport.settledPayments,
                availableTreasuryFunds: backendReport.availableTreasuryFunds,
                reservedTreasuryFunds: backendReport.reservedTreasuryFunds,
                treasuryRouteConfigured: backendReport.treasuryRouteConfigured,
                supportsConfidentialSettlement: backendReport.supportsConfidentialSettlement,
                draftPayrollRuns: backendReport.draftPayrollRuns,
                fundedPayrollRuns: backendReport.fundedPayrollRuns,
                finalizedPayrollRuns: backendReport.finalizedPayrollRuns,
                totalPayments: backendReport.totalPayments,
                employeeRecipients: backendReport.employeeRecipients
              }
            : undefined,
          indexerStatus: backendStatus
            ? {
                latestIndexedBlock: backendStatus.latestIndexedBlock,
                latestKnownBlock: backendStatus.latestKnownBlock,
                organizations: backendStatus.organizations,
                payrollRuns: backendStatus.payrollRuns,
                payments: backendStatus.payments,
                notifications: backendStatus.notifications,
                lastSyncError: backendStatus.lastSyncError
              }
            : undefined,
          portalSummary: [
            organization.exists ? 'Workspace is loaded in the admin portal.' : 'No workspace is loaded in the admin portal yet.',
            governanceActive
              ? `Governance is active with ${governanceAdminCount}-of-${governanceQuorum} approvals required for sensitive actions.`
              : governanceInitialized
                ? 'Governance is bootstrapped but not fully active yet, so sensitive actions may still need setup before relying on quorum.'
                : 'Governance is not initialized for this workspace yet.',
            isTargetChain
              ? `Wallet is on ${TARGET_CHAIN_NAME}.`
              : `Wallet is not on ${TARGET_CHAIN_NAME}, so transaction actions are blocked.`
          ]
        }}
      />
    </main>
  )
}
