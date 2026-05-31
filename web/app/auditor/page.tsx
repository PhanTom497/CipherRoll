'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Building2,
  Download,
  Eye,
  FileKey2,
  KeyRound,
  Loader2,
  RefreshCw,
  Trash2,
  ShieldCheck,
  Wallet
} from 'lucide-react'
import { toast } from 'sonner'
import type { DecryptForTxResult } from '@cofhe/sdk'
import CipherBotWidget from '@/components/CipherBotWidget'
import GlassCard from '@/components/GlassCard'
import NetworkStatus from '@/components/NetworkStatus'
import { useCipherRollWallet } from '@/components/EvmWalletProvider'
import {
  DEFAULT_ORG_ID,
  TARGET_CHAIN_ID,
  TARGET_CHAIN_NAME,
  formatBytes32Preview,
  toBytes32Label
} from '@/lib/cipherroll-config'
import { extractCipherRollErrorMessage, shortHash } from '@/lib/admin-portal-utils'
import { getCipherRollBackendClient } from '@/lib/cipherroll-backend'
import { getCipherRollAuditorContract } from '@/lib/cipherroll-client'
import {
  decryptUint128ForTx,
  decryptUint128ForView,
  getActiveAuditorRecipientPermit,
  getAuditorRecipientPermits,
  importAuditorSharingPermit,
  initCofhe,
  removeAuditorRecipientPermit,
  selectAuditorRecipientPermit
} from '@/lib/fhenix-permits'
import type {
  AuditReceiptRecord,
  AuditorAggregateDisclosureMetric,
  AuditorBatchEvidenceReceiptView,
  AuditorEvidenceMode,
  AuditorEvidenceReceiptView,
  AuditorOrganizationSummaryView,
  AuditorRecipientPermitView,
  NotificationRecord,
  OrganizationAuditPackage
} from '@/lib/cipherroll-types'

type AuditorStatusTone = 'neutral' | 'info' | 'success' | 'error'

type AuditorStatus = {
  tone: AuditorStatusTone
  title: string
  detail: string
}

type AuditorPortalTab = 'access' | 'review' | 'receipts'

const statusStyles: Record<AuditorStatusTone, string> = {
  neutral: 'border-white/10 bg-white/5 text-white/80',
  info: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-50',
  success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-50',
  error: 'border-rose-400/20 bg-rose-400/10 text-rose-50'
}

const defaultSummary: AuditorOrganizationSummaryView = {
  treasuryRouteConfigured: false,
  supportsConfidentialSettlement: false,
  settlementAsset: '',
  confidentialSettlementAsset: '',
  availableTreasuryFunds: '0',
  reservedTreasuryFunds: '0',
  totalPayrollRuns: 0,
  draftPayrollRuns: 0,
  fundedPayrollRuns: 0,
  activePayrollRuns: 0,
  finalizedPayrollRuns: 0,
  totalPayrollItems: 0,
  activePayrollItems: 0,
  claimedPayrollItems: 0,
  vestingPayrollItems: 0,
  employeeRecipients: 0,
  lastIssuedAt: 0,
  lastClaimedAt: 0
}

const evidenceMetricDetails: Record<
  AuditorAggregateDisclosureMetric,
  { label: string; summaryKey: 'budget' | 'committed' | 'available'; detail: string }
> = {
  budget: {
    label: 'Budget',
    summaryKey: 'budget',
    detail: 'Total organization budget shared for review.'
  },
  committed: {
    label: 'Committed Payroll',
    summaryKey: 'committed',
    detail: 'Total payroll commitments (no individual salary details).',
  },
  available: {
    label: 'Available Runway',
    summaryKey: 'available',
    detail: 'Budget remaining after commitments.'
  }
}

function formatTokenAmount(value?: string | null): string {
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

function formatTimestamp(value: number) {
  if (!value) return 'Not recorded yet'
  return new Date(value * 1000).toLocaleString()
}

export default function AuditorPage() {
  const { address, provider, signer, chainId } = useCipherRollWallet()
  const connectedAddress = address ?? undefined
  const [orgIdInput, setOrgIdInput] = useState(DEFAULT_ORG_ID)
  const [sharedPayload, setSharedPayload] = useState('')
  const [cofheReady, setCofheReady] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [recipientPermits, setRecipientPermits] = useState<AuditorRecipientPermitView[]>([])
  const [activeRecipientPermitHash, setActiveRecipientPermitHash] = useState<string | null>(null)
  const [summary, setSummary] = useState<AuditorOrganizationSummaryView>(defaultSummary)
  const [summaryValues, setSummaryValues] = useState<{
    budget: string | null
    committed: string | null
    available: string | null
  }>({
    budget: null,
    committed: null,
    available: null
  })
  const [selectedEvidenceMetric, setSelectedEvidenceMetric] = useState<AuditorAggregateDisclosureMetric>('available')
  const [selectedBatchMetrics, setSelectedBatchMetrics] = useState<AuditorAggregateDisclosureMetric[]>([
    'budget',
    'committed',
    'available'
  ])
  const [lastEvidenceReceipt, setLastEvidenceReceipt] = useState<AuditorEvidenceReceiptView | null>(null)
  const [lastBatchEvidenceReceipt, setLastBatchEvidenceReceipt] = useState<AuditorBatchEvidenceReceiptView | null>(null)
  const [backendAuditPackage, setBackendAuditPackage] = useState<OrganizationAuditPackage | null>(null)
  const [backendAuditNotifications, setBackendAuditNotifications] = useState<NotificationRecord[]>([])
  const [backendVerifiedReceipts, setBackendVerifiedReceipts] = useState<AuditReceiptRecord[]>([])
  const [backendPublishedReceipts, setBackendPublishedReceipts] = useState<AuditReceiptRecord[]>([])
  const [backendAuditError, setBackendAuditError] = useState<string | null>(null)
  const [isBackendAuditLoading, setIsBackendAuditLoading] = useState(false)
  const [showAdvancedEvidencePackage, setShowAdvancedEvidencePackage] = useState(false)
  const [activeTab, setActiveTab] = useState<AuditorPortalTab>('access')
  const [status, setStatus] = useState<AuditorStatus>({
    tone: 'neutral',
    title: 'Getting started',
    detail: `Connect the auditor wallet, switch to ${TARGET_CHAIN_NAME}, then import an access code from the admin to review the payroll summaries.`
  })

  const orgId = useMemo(() => toBytes32Label(orgIdInput), [orgIdInput])
  const isTargetChain = chainId === TARGET_CHAIN_ID

  const loadRecipientPermits = useCallback(() => {
    if (!address || !chainId) {
      setRecipientPermits([])
      setActiveRecipientPermitHash(null)
      return
    }

    const nextPermits = getAuditorRecipientPermits(chainId, address).filter(
      (permit) => permit.recipient.toLowerCase() === address.toLowerCase()
    )
    const activePermit = getActiveAuditorRecipientPermit(chainId, address)

    setRecipientPermits(nextPermits)
    setActiveRecipientPermitHash(activePermit?.hash ?? null)
  }, [address, chainId])

  useEffect(() => {
    setCofheReady(false)
    setRecipientPermits([])
    setActiveRecipientPermitHash(null)
    setSummary(defaultSummary)
    setSummaryValues({
      budget: null,
      committed: null,
      available: null
    })
    setLastEvidenceReceipt(null)
    setLastBatchEvidenceReceipt(null)
    setBackendAuditPackage(null)
    setBackendAuditNotifications([])
    setBackendVerifiedReceipts([])
    setBackendPublishedReceipts([])
    setBackendAuditError(null)
  }, [address, chainId])

  useEffect(() => {
    loadRecipientPermits()
  }, [loadRecipientPermits])

  const loadBackendAuditPackage = useCallback(async () => {
    setIsBackendAuditLoading(true)
    setBackendAuditError(null)

    try {
      const backend = getCipherRollBackendClient()
      const [auditPackage, verifiedReceipts, publishedReceipts] = await Promise.all([
        backend.getOrganizationAuditPackage(orgId),
        backend.getAuditReceipts({ orgId, published: false, limit: 6 }),
        backend.getAuditReceipts({ orgId, published: true, limit: 6 })
      ])
      setBackendAuditPackage(auditPackage)
      setBackendAuditNotifications(auditPackage.recentNotifications)
      setBackendVerifiedReceipts(verifiedReceipts)
      setBackendPublishedReceipts(publishedReceipts)
    } catch (error) {
      const message = extractCipherRollErrorMessage(error)
      setBackendAuditError(message)
    } finally {
      setIsBackendAuditLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    if (activeTab !== 'receipts') return
    void loadBackendAuditPackage()
  }, [activeTab, loadBackendAuditPackage])

  const downloadBackendAuditPackage = async () => {
    try {
      const backend = getCipherRollBackendClient()
      const auditPackage = await backend.getOrganizationAuditPackage(orgId)
      const blob = new Blob([JSON.stringify(auditPackage, null, 2)], {
        type: 'application/json;charset=utf-8'
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `cipherroll-${orgId}-audit-package.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(extractCipherRollErrorMessage(error))
    }
  }

  const initializeCofhe = async () => {
    if (!signer) {
      toast.error('Connect your wallet first.')
      return
    }

    if (!isTargetChain) {
      toast.error(`Switch to ${TARGET_CHAIN_NAME} before enabling auditor access.`)
      return
    }

    setStatus({
      tone: 'info',
      title: 'Setting up auditor access',
      detail: 'Approve the wallet prompts to import your access code and view the shared summary.'
    })

    try {
      await initCofhe((window as any).ethereum || signer.provider)
      setCofheReady(true)
      loadRecipientPermits()
      setStatus({
        tone: 'success',
        title: 'Auditor access ready',
        detail: 'You can now import access codes and view the summaries that the admin shared with you.'
      })
      toast.success('Auditor access is ready.')
    } catch (error) {
      const message = extractCipherRollErrorMessage(error)
      setStatus({
        tone: 'error',
        title: 'Auditor access setup failed',
        detail: message
      })
      toast.error(message)
    }
  }

  const importSharedPermitPayload = async () => {
    if (!signer) {
      toast.error('Connect your wallet first.')
      return
    }

    if (!isTargetChain) {
      toast.error(`Switch to ${TARGET_CHAIN_NAME} before importing the shared permit.`)
      return
    }

    if (!cofheReady) {
      toast.error('Turn on auditor access first so the access code can be imported.')
      return
    }

    if (!sharedPayload.trim()) {
      toast.error('Paste the access code shared by the admin.')
      return
    }

    setIsBusy(true)
    try {
      setStatus({
        tone: 'info',
        title: 'Importing access code',
        detail: 'Approve the wallet signature to activate this access code.'
      })

      const permit = await importAuditorSharingPermit(sharedPayload, chainId ?? undefined, connectedAddress)
      selectAuditorRecipientPermit(permit.hash, chainId ?? undefined, connectedAddress)
      loadRecipientPermits()
      setActiveRecipientPermitHash(permit.hash)
      setSharedPayload('')
      setStatus({
        tone: 'success',
        title: 'Access code imported',
        detail: 'Auditor access is now active. Refresh the workspace to view the shared summary.'
      })
      toast.success(`Imported access code ${shortHash(permit.hash) ?? permit.hash}.`)
    } catch (error) {
      const message = extractCipherRollErrorMessage(error)
      setStatus({
        tone: 'error',
        title: 'Shared permit import failed',
        detail: message
      })
      toast.error(message)
    } finally {
      setIsBusy(false)
    }
  }

  const loadAuditorSummary = async () => {
    if (!provider || !address) {
      toast.error('Connect your wallet first.')
      return
    }

    if (!isTargetChain) {
      toast.error(`Switch to ${TARGET_CHAIN_NAME} before refreshing auditor disclosures.`)
      return
    }

    if (!cofheReady) {
      toast.error('Turn on auditor access first.')
      return
    }

    const activePermit = getActiveAuditorRecipientPermit(chainId ?? undefined, address)
    if (!activePermit) {
      toast.error('Import and activate an access code first.')
      return
    }

    setIsBusy(true)
    try {
      setStatus({
        tone: 'info',
        title: 'Refreshing summary',
        detail: 'Loading the organization summary and viewing only the shared budget details.'
      })

      const contract = getCipherRollAuditorContract(signer ?? provider)
      const [nextSummary, handles] = await Promise.all([
        contract.getAuditorOrganizationSummary(orgId),
        contract.getAuditorEncryptedSummaryHandles(orgId)
      ])

      const [budget, committed, available] = await Promise.all([
        decryptUint128ForView(handles.budget, activePermit),
        decryptUint128ForView(handles.committed, activePermit),
        decryptUint128ForView(handles.available, activePermit)
      ])

      setSummary(nextSummary)
      setSummaryValues({
        budget,
        committed,
        available
      })
      setStatus({
        tone: 'success',
        title: 'Summary loaded',
        detail: 'You can now see the budget, committed payroll, and available runway values that the admin shared with you.'
      })
    } catch (error) {
      const message = extractCipherRollErrorMessage(error)
      setSummary(defaultSummary)
      setSummaryValues({
        budget: null,
        committed: null,
        available: null
      })
      setLastEvidenceReceipt(null)
      setLastBatchEvidenceReceipt(null)
      setStatus({
        tone: 'error',
        title: 'Summary refresh failed',
        detail: message
      })
      toast.error(message)
    } finally {
      setIsBusy(false)
    }
  }

  const createAuditEvidence = async (mode: AuditorEvidenceMode) => {
    if (!provider || !address) {
      toast.error('Connect your wallet first.')
      return
    }

    if (!isTargetChain) {
      toast.error(`Switch to ${TARGET_CHAIN_NAME} before generating audit evidence.`)
      return
    }

    if (!cofheReady) {
      toast.error('Turn on auditor access first.')
      return
    }

    const activePermit = getActiveAuditorRecipientPermit(chainId ?? undefined, address)
    if (!activePermit) {
      toast.error('Import and activate an access code first.')
      return
    }

    const selectedMetricMeta = evidenceMetricDetails[selectedEvidenceMetric]
    const selectedValue = summaryValues[selectedMetricMeta.summaryKey]
    if (!selectedValue) {
      toast.error('Refresh the summary first so CipherRoll can verify the selected shared metric.')
      return
    }

    setIsBusy(true)
    try {
      setStatus({
        tone: 'info',
        title: mode === 'verify' ? 'Creating audit record' : 'Publishing audit result',
        detail:
          mode === 'verify'
            ? 'Preparing a verified result for the selected metric, then recording it on the network as audit evidence.'
            : 'Preparing a verified result for the selected metric, then publishing it on the network for downstream use.'
      })

      const contract = getCipherRollAuditorContract(signer ?? provider)
      const handle = await contract.getAuditorAggregateHandle(orgId, selectedEvidenceMetric)
      const decryptResult = await decryptUint128ForTx(handle, activePermit)

      if (!decryptResult) {
        throw new Error('CipherRoll could not prepare a verification for this metric.')
      }

      const tx =
        mode === 'verify'
          ? await contract.verifyAuditorAggregateDisclosure(
              orgId,
              selectedEvidenceMetric,
              decryptResult.decryptedValue,
              decryptResult.signature
            )
          : await contract.publishAuditorAggregateDisclosure(
              orgId,
              selectedEvidenceMetric,
              decryptResult.decryptedValue,
              decryptResult.signature
            )

      await tx.wait()

      setLastEvidenceReceipt({
        orgId,
        metric: selectedEvidenceMetric,
        mode,
        cleartextValue: formatTokenAmount(decryptResult.decryptedValue.toString()),
        txHash: tx.hash,
        ctHash: String(handle)
      })
      setLastBatchEvidenceReceipt(null)
      setStatus({
        tone: 'success',
        title: mode === 'verify' ? 'Audit record created' : 'Audit result published',
        detail:
          mode === 'verify'
            ? 'The verified result was recorded on the network as an audit record for the selected metric.'
            : 'The result was published on the network as an audit record for the selected metric.'
      })
      toast.success(
        mode === 'verify'
          ? 'Audit record verified.'
          : 'Audit result published.'
      )
    } catch (error) {
      const message = extractCipherRollErrorMessage(error)
      setStatus({
        tone: 'error',
        title: 'Audit record failed',
        detail: message
      })
      toast.error(message)
    } finally {
      setIsBusy(false)
    }
  }

  const createBatchAuditEvidence = async (mode: AuditorEvidenceMode) => {
    if (!provider || !address) {
      toast.error('Connect your wallet first.')
      return
    }

    if (!isTargetChain) {
      toast.error(`Switch to ${TARGET_CHAIN_NAME} before generating batched audit evidence.`)
      return
    }

    if (!cofheReady) {
      toast.error('Turn on auditor access first.')
      return
    }

    const activePermit = getActiveAuditorRecipientPermit(chainId ?? undefined, address)
    if (!activePermit) {
      toast.error('Import and activate an access code first.')
      return
    }

    if (selectedBatchMetrics.length === 0) {
      toast.error('Choose at least one metric for the batch record.')
      return
    }

    const missingMetric = selectedBatchMetrics.find((metric) => !summaryValues[evidenceMetricDetails[metric].summaryKey])
    if (missingMetric) {
      toast.error(`Refresh the summary first so CipherRoll can verify ${evidenceMetricDetails[missingMetric].label}.`)
      return
    }

    setIsBusy(true)
    try {
      setStatus({
        tone: 'info',
        title: mode === 'verify' ? 'Creating batch audit record' : 'Publishing batch audit results',
        detail:
          mode === 'verify'
            ? 'Preparing verified results for the selected metrics, then recording them on the network as one audit record.'
            : 'Preparing verified results for the selected metrics, then publishing them on the network for downstream use.'
      })

      const contract = getCipherRollAuditorContract(signer ?? provider)
      const handles = await Promise.all(
        selectedBatchMetrics.map((metric) => contract.getAuditorAggregateHandle(orgId, metric))
      )
      const decryptResults = await Promise.all(
        handles.map((handle) => decryptUint128ForTx(handle, activePermit))
      )

      if (decryptResults.some((result: DecryptForTxResult | null) => !result)) {
        throw new Error('CipherRoll could not prepare one or more verifications for the selected metrics.')
      }

      const resolvedResults = decryptResults as NonNullable<typeof decryptResults[number]>[]
      const tx =
        mode === 'verify'
          ? await contract.verifyAuditorAggregateDisclosureBatch(
              orgId,
              selectedBatchMetrics,
              resolvedResults.map((result) => result.decryptedValue),
              resolvedResults.map((result) => result.signature)
            )
          : await contract.publishAuditorAggregateDisclosureBatch(
              orgId,
              selectedBatchMetrics,
              resolvedResults.map((result) => result.decryptedValue),
              resolvedResults.map((result) => result.signature)
            )

      await tx.wait()

      setLastBatchEvidenceReceipt({
        orgId,
        metrics: [...selectedBatchMetrics],
        mode,
        cleartextValues: Object.fromEntries(
          selectedBatchMetrics.map((metric, index) => [
            metric,
            formatTokenAmount(resolvedResults[index].decryptedValue.toString())
          ])
        ) as Record<AuditorAggregateDisclosureMetric, string>,
        txHash: tx.hash,
        ctHashes: Object.fromEntries(
          selectedBatchMetrics.map((metric, index) => [metric, String(handles[index])])
        ) as Record<AuditorAggregateDisclosureMetric, string>
      })
      setLastEvidenceReceipt(null)
      setStatus({
        tone: 'success',
        title: mode === 'verify' ? 'Batch audit record created' : 'Batch audit results published',
        detail:
          mode === 'verify'
            ? 'The verified results were recorded on the network as one batch audit record.'
            : 'The results were published on the network as one batch audit record.'
      })
      toast.success(
        mode === 'verify'
          ? 'Batch audit record verified.'
          : 'Batch audit results published.'
      )
    } catch (error) {
      const message = extractCipherRollErrorMessage(error)
      setStatus({
        tone: 'error',
        title: 'Batch audit record failed',
        detail: message
      })
      toast.error(message)
    } finally {
      setIsBusy(false)
    }
  }

  const removeRecipientPermit = (hash: string) => {
    if (!address || !chainId) return

    removeAuditorRecipientPermit(hash, chainId, address)
    loadRecipientPermits()
    setSummary(defaultSummary)
    setSummaryValues({
      budget: null,
      committed: null,
      available: null
    })
    setLastEvidenceReceipt(null)
    setLastBatchEvidenceReceipt(null)
    setStatus({
      tone: 'info',
      title: 'Access code removed',
      detail: 'The access code was removed from this browser. This stops local viewing here, but does not affect any other session that may already have the same code.'
    })
    toast.success('Access code removed from this browser.')
  }

  const activePermit = recipientPermits.find((permit) => permit.hash === activeRecipientPermitHash) ?? null
  const selectedEvidenceMeta = evidenceMetricDetails[selectedEvidenceMetric]
  const selectedEvidenceValue = summaryValues[selectedEvidenceMeta.summaryKey]
  const treasuryAvailable = useMemo(() => formatTokenAmount(summary.availableTreasuryFunds), [summary.availableTreasuryFunds])
  const treasuryReserved = useMemo(() => formatTokenAmount(summary.reservedTreasuryFunds), [summary.reservedTreasuryFunds])
  const availableBudget = Number(summaryValues.available ?? '0')
  const committedBudget = Number(summaryValues.committed ?? '0')
  const budgetValue = Number(summaryValues.budget ?? '0')
  const solvencyLabel = budgetValue > 0 && availableBudget >= 0 ? 'Funded' : 'Needs review'
  const runwayPercent = budgetValue > 0 ? Math.max(0, Math.min(100, (availableBudget / budgetValue) * 100)) : 0

  const analyticsCards = [
    { label: 'Budget', value: summaryValues.budget ?? '***' },
    { label: 'Committed', value: summaryValues.committed ?? '***' },
    { label: 'Available', value: summaryValues.available ?? '***' },
    { label: 'Runs', value: String(summary.totalPayrollRuns) },
    { label: 'Employees', value: String(summary.employeeRecipients) },
    { label: 'Treasury', value: summary.treasuryRouteConfigured ? treasuryAvailable : 'Not set up' }
  ]
  const auditSummaryCards = [
    ...analyticsCards,
    { label: 'Status', value: solvencyLabel, detail: summaryValues.available ? `${runwayPercent.toFixed(0)}% runway left` : 'Refresh to load values' },
    { label: 'Settlement', value: summary.supportsConfidentialSettlement ? 'Two-step' : summary.treasuryRouteConfigured ? 'Direct' : 'Not set up', detail: summary.treasuryRouteConfigured ? 'Set up' : 'No treasury set up' }
  ]
  const auditorTabs: Array<{ id: AuditorPortalTab; label: string }> = [
    { id: 'access', label: 'Access' },
    { id: 'review', label: 'Review' },
    { id: 'receipts', label: 'Records' }
  ]

  return (
    <div className="min-h-screen bg-black text-white pb-24 pt-32">
      <div
        className="fixed inset-0 z-0 bg-[length:800px] md:bg-[length:1800px] bg-right bg-no-repeat bg-fixed opacity-35"
        style={{ backgroundImage: "url('/assets/milad-fakurian-7W3X1dAuKqg-unsplash.jpg')" }}
      />
      <div className="fixed inset-0 z-0 bg-black/70 backdrop-blur-[2px]" />

      <div className="w-full max-w-6xl mx-auto px-6 pb-24 relative z-10">
        <section className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 text-cyan-300 text-xs font-bold tracking-widest uppercase mb-5">
            Auditor Review
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white mb-4">Auditor Portal</h1>
        </section>

        <NetworkStatus />

        <div className="mt-8 grid gap-4">
          <GlassCard className="p-6 border-white/5 bg-[#0a0a0a] rounded-3xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Auditor
                </div>
                <h2 className="mt-4 text-2xl font-bold text-white">{status.title}</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={initializeCofhe}
                  disabled={!signer || isBusy}
                  className="rounded-2xl bg-white text-black px-5 py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                >
                  Turn On Auditor Access
                </button>
                <button
                  onClick={() => void loadAuditorSummary()}
                  disabled={!provider || isBusy}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh Auditor Summary
                </button>
              </div>
            </div>

            <div className={`mt-4 rounded-2xl border p-4 text-sm ${statusStyles[status.tone]}`}>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <span>
                  Active workspace: <span className="font-mono">{formatBytes32Preview(orgId)}</span>
                </span>
                <span>
                  Active code: {activePermit ? shortHash(activePermit.hash) : 'None'}
                </span>
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
            {auditorTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-white text-black shadow-[0_0_0_1px_rgba(255,255,255,0.18)]'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'access' ? (
        <div className="grid lg:grid-cols-[0.95fr,1.05fr] gap-8 mt-8 items-start">
          <div>
            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl min-h-[392px]">
              <div className="flex items-center gap-3 mb-6">
                <FileKey2 className="w-5 h-5 text-cyan-300" />
                <h2 className="text-2xl font-bold text-white">Access</h2>
              </div>

              <div className="grid gap-4 xl:grid-cols-[0.76fr,1.24fr]">
                <div className="space-y-4">
                  <input
                    value={orgIdInput}
                    onChange={(event) => setOrgIdInput(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                    placeholder="Organization id"
                  />
                  <button
                    onClick={importSharedPermitPayload}
                    disabled={!signer || !cofheReady || isBusy || !sharedPayload.trim()}
                    className="w-full rounded-2xl bg-white text-black px-4 py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                  >
                    Import Access Code
                  </button>
                </div>
                <textarea
                  value={sharedPayload}
                  onChange={(event) => setSharedPayload(event.target.value)}
                  className="min-h-[236px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-mono text-white/85 placeholder:text-white/35"
                  placeholder="Paste the access code"
                />
              </div>

            </GlassCard>
          </div>

          <div className="space-y-6">
            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl min-h-[318px]">
              <div className="flex items-center gap-3 mb-6">
                <KeyRound className="w-5 h-5 text-emerald-300" />
                <h2 className="text-2xl font-bold text-white">Access codes</h2>
              </div>

              <div className="space-y-3">
                {recipientPermits.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-[#a1a1aa]">
                    No access codes are stored for this wallet yet.
                  </div>
                ) : (
                  recipientPermits.map((permit) => {
                    const isActive = permit.hash === activeRecipientPermitHash
                    return (
                      <div
                        key={permit.hash}
                        className={`w-full rounded-2xl border p-4 transition-colors ${
                          isActive
                            ? 'border-emerald-400/20 bg-emerald-400/10'
                            : 'border-white/10 bg-white/5'
                        }`}
                      >
                        <div className="grid gap-4 lg:grid-cols-1">
                          <div className="space-y-4">
                            <div>
                              <p className="font-semibold text-white">{permit.name}</p>
                            </div>
                            <div className="space-y-3">
                              <div className="grid gap-2 md:grid-cols-[92px,1fr] md:items-start">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Issuer</p>
                                <p className="text-sm text-white/85 break-words" title={permit.issuer}>{permit.issuer}</p>
                              </div>
                              <div className="grid gap-2 md:grid-cols-[92px,1fr] md:items-start">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Recipient</p>
                                <p className="text-sm text-white/85 break-words" title={permit.recipient}>{permit.recipient}</p>
                              </div>
                              <div className="grid gap-2 md:grid-cols-[92px,1fr] md:items-start">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Expires</p>
                                <p className="text-sm text-white/85">
                                  {new Date(permit.expiration * 1000).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (!chainId || !address) return
                                selectAuditorRecipientPermit(permit.hash, chainId, address)
                                loadRecipientPermits()
                                toast.success('Access code activated for this session.')
                              }}
                              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
                            >
                              {isActive ? 'Active' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRecipientPermit(permit.hash)}
                              className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-400/15"
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </GlassCard>

            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl min-h-[304px]">
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="w-5 h-5 text-cyan-300" />
                <h2 className="text-2xl font-bold text-white">Organization</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/55 uppercase tracking-[0.18em] text-xs font-bold mb-2">Workspace</p>
                  <p className="font-mono text-white">{formatBytes32Preview(orgId)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/55 uppercase tracking-[0.18em] text-xs font-bold mb-2">Payout route</p>
                  <p className="text-white">{summary.treasuryRouteConfigured ? 'Configured' : 'Not configured'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/55 uppercase tracking-[0.18em] text-xs font-bold mb-2">Last payroll issued</p>
                  <p className="text-white">{formatTimestamp(summary.lastIssuedAt)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/55 uppercase tracking-[0.18em] text-xs font-bold mb-2">Last employee claim</p>
                  <p className="text-white">{formatTimestamp(summary.lastClaimedAt)}</p>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
        ) : null}

        {activeTab === 'review' ? (
        <GlassCard className="mt-8 p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
          <div className="flex items-center gap-3 mb-6">
            <Eye className="w-5 h-5 text-cyan-300" />
            <h2 className="text-2xl font-bold text-white">Audit summary</h2>
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            {auditSummaryCards.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-white/55 font-bold mb-3">{item.label}</p>
                <p className="text-3xl font-black text-white break-words">{item.value}</p>
                {'detail' in item ? <p className="mt-2 text-sm text-[#a1a1aa]">{item.detail}</p> : null}
              </div>
            ))}
          </div>
        </GlassCard>
        ) : null}

        {activeTab === 'receipts' ? (
        <GlassCard className="mt-8 p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
          <div className="flex items-center gap-3 mb-6">
            <ShieldCheck className="w-5 h-5 text-emerald-300" />
            <h2 className="text-2xl font-bold text-white">Audit receipt</h2>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              {(Object.entries(evidenceMetricDetails) as Array<[AuditorAggregateDisclosureMetric, (typeof evidenceMetricDetails)[AuditorAggregateDisclosureMetric]]>).map(([metric, meta]) => {
                const selected = metric === selectedEvidenceMetric
                const value = summaryValues[meta.summaryKey]
                return (
                  <button
                    key={metric}
                    type="button"
                    onClick={() => setSelectedEvidenceMetric(metric)}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      selected
                        ? 'border-emerald-400/20 bg-emerald-400/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-white/55 font-bold">{meta.label}</p>
                    <p className="mt-3 text-2xl font-black text-white">{value ?? '***'}</p>
                  </button>
                )
              })}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-[#c9c9d0]">
              <p className="font-semibold text-white">Selected metric: {selectedEvidenceMeta.label}</p>
              <p className="mt-2">
                {selectedEvidenceValue
                  ? `Current shared value: ${selectedEvidenceValue}.`
                  : 'Refresh the summary first.'}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-[#c9c9d0]">
              <p className="font-semibold text-white">Batch metrics</p>
              <div className="mt-4 grid gap-2 md:grid-cols-3">
                {(Object.entries(evidenceMetricDetails) as Array<[AuditorAggregateDisclosureMetric, (typeof evidenceMetricDetails)[AuditorAggregateDisclosureMetric]]>).map(([metric, meta]) => {
                  const selected = selectedBatchMetrics.includes(metric)
                  return (
                    <button
                      key={`batch-${metric}`}
                      type="button"
                      onClick={() =>
                        setSelectedBatchMetrics((current) =>
                          current.includes(metric)
                            ? current.filter((entry) => entry !== metric)
                            : [...current, metric]
                        )
                      }
                      className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                        selected
                          ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-50'
                          : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                      }`}
                    >
                      <p className="text-xs uppercase tracking-[0.18em] font-bold">{meta.label}</p>
                      <p className="mt-2 text-sm">{summaryValues[meta.summaryKey] ?? '***'}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => void createAuditEvidence('verify')}
                disabled={!activePermit || !selectedEvidenceValue || isBusy}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
              >
                Verify On-Chain Receipt
              </button>
              <button
                type="button"
                onClick={() => void createAuditEvidence('publish')}
                disabled={!activePermit || !selectedEvidenceValue || isBusy}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
              >
                Publish Decrypt Result
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => void createBatchAuditEvidence('verify')}
                disabled={!activePermit || selectedBatchMetrics.length === 0 || isBusy}
                className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-black hover:bg-cyan-200 disabled:opacity-50"
              >
                Verify Batch Receipt
              </button>
              <button
                type="button"
                onClick={() => void createBatchAuditEvidence('publish')}
                disabled={!activePermit || selectedBatchMetrics.length === 0 || isBusy}
                className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/15 disabled:opacity-50"
              >
                Publish Batch Results
              </button>
            </div>

            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
              Creating a record keeps the disclosure narrower than publishing.
            </div>

            {lastEvidenceReceipt ? (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5 text-sm text-emerald-50">
                <p className="font-semibold text-white">Latest audit receipt</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <p>Metric: <span className="font-semibold">{evidenceMetricDetails[lastEvidenceReceipt.metric].label}</span></p>
                  <p>Mode: <span className="font-semibold uppercase">{lastEvidenceReceipt.mode}</span></p>
                  <p>Value: <span className="font-semibold">{lastEvidenceReceipt.cleartextValue}</span></p>
                  <p>Tx: <span className="font-mono text-white/90">{shortHash(lastEvidenceReceipt.txHash) ?? lastEvidenceReceipt.txHash}</span></p>
                </div>
                <p className="mt-3 text-white/80">
                  Encrypted reference: <span className="font-mono">{shortHash(lastEvidenceReceipt.ctHash) ?? lastEvidenceReceipt.ctHash}</span>
                </p>
              </div>
            ) : null}

            {lastBatchEvidenceReceipt ? (
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5 text-sm text-cyan-50">
                <p className="font-semibold text-white">Latest batch audit receipt</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <p>Mode: <span className="font-semibold uppercase">{lastBatchEvidenceReceipt.mode}</span></p>
                  <p>Tx: <span className="font-mono text-white/90">{shortHash(lastBatchEvidenceReceipt.txHash) ?? lastBatchEvidenceReceipt.txHash}</span></p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {lastBatchEvidenceReceipt.metrics.map((metric) => (
                    <div key={`receipt-${metric}`} className="rounded-2xl border border-cyan-300/20 bg-black/20 p-4">
                      <p className="font-semibold text-white">{evidenceMetricDetails[metric].label}</p>
                      <p className="mt-2">{lastBatchEvidenceReceipt.cleartextValues[metric]}</p>
                      <p className="mt-2 text-xs text-white/70 font-mono">
                        {shortHash(lastBatchEvidenceReceipt.ctHashes[metric]) ?? lastBatchEvidenceReceipt.ctHashes[metric]}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-[#c9c9d0]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold text-white">Advanced details</p>
                  <p className="mt-2">
                    Backend evidence package, receipt streams, and workflow activity.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedEvidencePackage((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    {showAdvancedEvidencePackage ? 'Hide Advanced Details' : 'Show Advanced Details'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadBackendAuditPackage()}
                    disabled={!showAdvancedEvidencePackage || isBackendAuditLoading}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    {isBackendAuditLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {isBackendAuditLoading ? 'Refreshing…' : 'Refresh Package'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadBackendAuditPackage()}
                    disabled={!showAdvancedEvidencePackage}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    Export JSON
                  </button>
                </div>
              </div>

              {showAdvancedEvidencePackage ? (
                <>
              {backendAuditError ? (
                <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-amber-50">
                  Backend audit package unavailable right now: {backendAuditError}
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Verified receipts</p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {backendAuditPackage ? String(backendVerifiedReceipts.length) : '—'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Published receipts</p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {backendAuditPackage ? String(backendPublishedReceipts.length) : '—'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Recent notifications</p>
                  <p className="mt-2 text-2xl font-black text-white">{backendAuditPackage ? String(backendAuditNotifications.length) : '—'}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Verified receipt stream</p>
                  <div className="mt-3 space-y-3">
                    {backendVerifiedReceipts.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-[#a1a1aa]">
                        No verified records found for this workspace.
                      </div>
                    ) : (
                      backendVerifiedReceipts.map((receipt) => (
                        <div key={receipt.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="font-semibold text-white">{receipt.receiptKind === 'batch' ? 'Batch record' : 'Single record'}</p>
                          <p className="mt-2 text-sm text-[#c9c9d0]">Block {receipt.blockNumber}</p>
                          <p className="mt-2 text-xs font-mono text-white/45">{shortHash(receipt.txHash) ?? receipt.txHash}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Published receipt stream</p>
                  <div className="mt-3 space-y-3">
                    {backendPublishedReceipts.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-[#a1a1aa]">
                        No published records found for this workspace.
                      </div>
                    ) : (
                      backendPublishedReceipts.map((receipt) => (
                        <div key={receipt.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="font-semibold text-white">{receipt.receiptKind === 'batch' ? 'Published batch' : 'Published record'}</p>
                          <p className="mt-2 text-sm text-[#c9c9d0]">Block {receipt.blockNumber}</p>
                          <p className="mt-2 text-xs font-mono text-white/45">{shortHash(receipt.txHash) ?? receipt.txHash}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Notification trail</p>
                  <div className="mt-3 space-y-3">
                    {backendAuditNotifications.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-[#a1a1aa]">
                        No recent activity found for this workspace.
                      </div>
                    ) : (
                      backendAuditNotifications.slice(0, 4).map((notification) => (
                        <div key={notification.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold text-white">{notification.title}</p>
                            <span className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                              {new Date(notification.createdAt * 1000).toLocaleString()}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-[#c9c9d0]">{notification.detail}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
                </>
              ) : null}
            </div>
          </div>
        </GlassCard>
        ) : null}

      </div>
      <CipherBotWidget
        scope="auditor"
        headline="Your guide for reviewing payroll as an auditor."
        intro="Ask about importing access codes, reviewing summaries, audit records, or what you can and can't see. I'll keep the answer focused on your auditor workflow."
        organizationId={orgId}
        liveContext={{
          reportSummary: backendAuditPackage
            ? {
                pendingClaims: backendAuditPackage.summary.pendingClaims,
                pendingSettlementRequests: backendAuditPackage.summary.pendingSettlementRequests,
                activePayrollRuns: backendAuditPackage.summary.activePayrollRuns,
                settledPayments: backendAuditPackage.summary.settledPayments,
                availableTreasuryFunds: backendAuditPackage.summary.availableTreasuryFunds,
                reservedTreasuryFunds: backendAuditPackage.summary.reservedTreasuryFunds,
                treasuryRouteConfigured: backendAuditPackage.summary.treasuryRouteConfigured,
                supportsConfidentialSettlement: backendAuditPackage.summary.supportsConfidentialSettlement,
                draftPayrollRuns: backendAuditPackage.summary.draftPayrollRuns,
                fundedPayrollRuns: backendAuditPackage.summary.fundedPayrollRuns,
                finalizedPayrollRuns: backendAuditPackage.summary.finalizedPayrollRuns,
                totalPayments: backendAuditPackage.summary.totalPayments,
                employeeRecipients: backendAuditPackage.summary.employeeRecipients
              }
            : undefined,
          portalSummary: [
            activeRecipientPermitHash
              ? 'An auditor access code is active in this session.'
              : 'No auditor access code is active in this session.',
            summaryValues.available
              ? 'Summary values have been refreshed and are visible locally.'
              : 'Summary values have not been refreshed yet.',
            `${backendVerifiedReceipts.length} verified record(s) and ${backendPublishedReceipts.length} published record(s) are loaded from the supporting documents.`
          ]
        }}
      />
    </div>
  )
}
