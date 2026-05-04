'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Building2,
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
  AuditorAggregateDisclosureMetric,
  AuditorBatchEvidenceReceiptView,
  AuditorEvidenceMode,
  AuditorEvidenceReceiptView,
  AuditorOrganizationSummaryView,
  AuditorRecipientPermitView
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
    detail: 'Total encrypted organization budget shared for audit review.'
  },
  committed: {
    label: 'Committed Payroll',
    summaryKey: 'committed',
    detail: 'Aggregate payroll commitments without employee-level rows.'
  },
  available: {
    label: 'Available Runway',
    summaryKey: 'available',
    detail: 'Aggregate budget remaining after commitments.'
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
  const [activeTab, setActiveTab] = useState<AuditorPortalTab>('access')
  const [status, setStatus] = useState<AuditorStatus>({
    tone: 'neutral',
    title: 'Waiting for auditor access',
    detail: `Connect the auditor wallet, switch to ${TARGET_CHAIN_NAME}, then import a shared permit payload from the admin before reviewing aggregate payroll summaries.`
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
  }, [address, chainId])

  useEffect(() => {
    loadRecipientPermits()
  }, [loadRecipientPermits])

  const initializeCofhe = async () => {
    if (!signer) {
      toast.error('Connect the auditor wallet first.')
      return
    }

    if (!isTargetChain) {
      toast.error(`Switch to ${TARGET_CHAIN_NAME} before enabling auditor access.`)
      return
    }

    setStatus({
      tone: 'info',
      title: 'Preparing auditor session',
      detail: 'Approve the wallet prompts so CipherRoll can import recipient permits and decrypt shared aggregate summaries in the browser.'
    })

    try {
      await initCofhe((window as any).ethereum || signer.provider)
      setCofheReady(true)
      loadRecipientPermits()
      setStatus({
        tone: 'success',
        title: 'Auditor privacy mode ready',
        detail: 'This wallet can now import shared permits and decrypt aggregate summaries that an admin explicitly shared.'
      })
      toast.success('Auditor access is ready for this wallet.')
    } catch (error) {
      const message = extractCipherRollErrorMessage(error)
      setStatus({
        tone: 'error',
        title: 'Auditor setup failed',
        detail: message
      })
      toast.error(message)
    }
  }

  const importSharedPermitPayload = async () => {
    if (!signer) {
      toast.error('Connect the auditor wallet first.')
      return
    }

    if (!isTargetChain) {
      toast.error(`Switch to ${TARGET_CHAIN_NAME} before importing the shared permit.`)
      return
    }

    if (!cofheReady) {
      toast.error('Enable auditor access first so the current SDK can import the shared permit for this wallet.')
      return
    }

    if (!sharedPayload.trim()) {
      toast.error('Paste the sharing payload from the admin portal first.')
      return
    }

    setIsBusy(true)
    try {
      setStatus({
        tone: 'info',
        title: 'Importing shared permit',
        detail: 'Approve the wallet signature so the imported sharing payload becomes an active recipient permit for this auditor wallet.'
      })

      const permit = await importAuditorSharingPermit(sharedPayload, chainId ?? undefined, connectedAddress)
      selectAuditorRecipientPermit(permit.hash, chainId ?? undefined, connectedAddress)
      loadRecipientPermits()
      setActiveRecipientPermitHash(permit.hash)
      setSharedPayload('')
      setStatus({
        tone: 'success',
        title: 'Shared permit imported',
        detail: 'The auditor wallet now has a recipient permit for aggregate payroll review. Refresh the workspace to decrypt the shared summary handles.'
      })
      toast.success(`Imported recipient permit ${shortHash(permit.hash) ?? permit.hash}.`)
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
      toast.error('Connect the auditor wallet first.')
      return
    }

    if (!isTargetChain) {
      toast.error(`Switch to ${TARGET_CHAIN_NAME} before refreshing auditor disclosures.`)
      return
    }

    if (!cofheReady) {
      toast.error('Enable auditor access first.')
      return
    }

    const activePermit = getActiveAuditorRecipientPermit(chainId ?? undefined, address)
    if (!activePermit) {
      toast.error('Import and activate an auditor recipient permit first.')
      return
    }

    setIsBusy(true)
    try {
      setStatus({
        tone: 'info',
        title: 'Refreshing auditor summary',
        detail: 'Loading compliance-safe organization data and decrypting only the shared aggregate budget handles.'
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
        title: 'Auditor summary loaded',
        detail: 'CipherRoll decrypted only the aggregate budget, committed payroll, and available runway values shared through the active recipient permit.'
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
        title: 'Auditor refresh failed',
        detail: message
      })
      toast.error(message)
    } finally {
      setIsBusy(false)
    }
  }

  const createAuditEvidence = async (mode: AuditorEvidenceMode) => {
    if (!provider || !address) {
      toast.error('Connect the auditor wallet first.')
      return
    }

    if (!isTargetChain) {
      toast.error(`Switch to ${TARGET_CHAIN_NAME} before generating audit evidence.`)
      return
    }

    if (!cofheReady) {
      toast.error('Enable auditor access first.')
      return
    }

    const activePermit = getActiveAuditorRecipientPermit(chainId ?? undefined, address)
    if (!activePermit) {
      toast.error('Import and activate an auditor recipient permit first.')
      return
    }

    const selectedMetricMeta = evidenceMetricDetails[selectedEvidenceMetric]
    const selectedValue = summaryValues[selectedMetricMeta.summaryKey]
    if (!selectedValue) {
      toast.error('Refresh the auditor summary first so CipherRoll can prove the selected shared metric.')
      return
    }

    setIsBusy(true)
    try {
      setStatus({
        tone: 'info',
        title: mode === 'verify' ? 'Generating audit receipt' : 'Publishing decrypt result',
        detail:
          mode === 'verify'
            ? 'CipherRoll is preparing a threshold-signed decrypt result for the selected shared metric, then verifying it on-chain to produce defensible audit evidence.'
            : 'CipherRoll is preparing a threshold-signed decrypt result for the selected shared metric, then publishing that result on-chain for downstream contract consumers.'
      })

      const contract = getCipherRollAuditorContract(signer ?? provider)
      const handle = await contract.getAuditorAggregateHandle(orgId, selectedEvidenceMetric)
      const decryptResult = await decryptUint128ForTx(handle, activePermit)

      if (!decryptResult) {
        throw new Error('CipherRoll could not prepare an auditor decrypt proof for this metric.')
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
        title: mode === 'verify' ? 'Audit receipt created' : 'Decrypt result published',
        detail:
          mode === 'verify'
            ? 'CipherRoll verified the threshold-network signature on-chain and emitted a narrow receipt for the selected aggregate metric.'
            : 'CipherRoll published the decrypt result on-chain and emitted a narrow receipt for the selected aggregate metric.'
      })
      toast.success(
        mode === 'verify'
          ? 'Audit evidence verified on-chain.'
          : 'Decrypt result published on-chain.'
      )
    } catch (error) {
      const message = extractCipherRollErrorMessage(error)
      setStatus({
        tone: 'error',
        title: 'Audit evidence failed',
        detail: message
      })
      toast.error(message)
    } finally {
      setIsBusy(false)
    }
  }

  const createBatchAuditEvidence = async (mode: AuditorEvidenceMode) => {
    if (!provider || !address) {
      toast.error('Connect the auditor wallet first.')
      return
    }

    if (!isTargetChain) {
      toast.error(`Switch to ${TARGET_CHAIN_NAME} before generating batched audit evidence.`)
      return
    }

    if (!cofheReady) {
      toast.error('Enable auditor access first.')
      return
    }

    const activePermit = getActiveAuditorRecipientPermit(chainId ?? undefined, address)
    if (!activePermit) {
      toast.error('Import and activate an auditor recipient permit first.')
      return
    }

    if (selectedBatchMetrics.length === 0) {
      toast.error('Choose at least one aggregate metric for the batch receipt.')
      return
    }

    const missingMetric = selectedBatchMetrics.find((metric) => !summaryValues[evidenceMetricDetails[metric].summaryKey])
    if (missingMetric) {
      toast.error(`Refresh the auditor summary first so CipherRoll can prove ${evidenceMetricDetails[missingMetric].label}.`)
      return
    }

    setIsBusy(true)
    try {
      setStatus({
        tone: 'info',
        title: mode === 'verify' ? 'Generating batched audit receipt' : 'Publishing batched decrypt results',
        detail:
          mode === 'verify'
            ? 'CipherRoll is preparing threshold-signed decrypt results for the selected shared aggregate metrics, then verifying the whole set on-chain as one receipt.'
            : 'CipherRoll is preparing threshold-signed decrypt results for the selected shared aggregate metrics, then publishing the whole set on-chain for downstream contract consumers.'
      })

      const contract = getCipherRollAuditorContract(signer ?? provider)
      const handles = await Promise.all(
        selectedBatchMetrics.map((metric) => contract.getAuditorAggregateHandle(orgId, metric))
      )
      const decryptResults = await Promise.all(
        handles.map((handle) => decryptUint128ForTx(handle, activePermit))
      )

      if (decryptResults.some((result: DecryptForTxResult | null) => !result)) {
        throw new Error('CipherRoll could not prepare one or more batch decrypt proofs for the selected metrics.')
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
        title: mode === 'verify' ? 'Batched audit receipt created' : 'Batched decrypt results published',
        detail:
          mode === 'verify'
            ? 'CipherRoll verified the threshold-network signatures for the selected aggregate metrics on-chain and emitted one batch receipt.'
            : 'CipherRoll published the threshold-network decrypt results for the selected aggregate metrics on-chain and emitted one batch receipt.'
      })
      toast.success(
        mode === 'verify'
          ? 'Batched audit evidence verified on-chain.'
          : 'Batched decrypt results published on-chain.'
      )
    } catch (error) {
      const message = extractCipherRollErrorMessage(error)
      setStatus({
        tone: 'error',
        title: 'Batched audit evidence failed',
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
      title: 'Recipient permit removed',
      detail: 'CipherRoll cleared the imported recipient permit from this auditor browser. This stops local decrypts here, but does not invalidate any other wallet session that may already have imported the same payload.'
    })
    toast.success('Recipient permit removed from this auditor browser.')
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
    { label: 'Treasury', value: summary.treasuryRouteConfigured ? treasuryAvailable : 'No route' }
  ]
  const auditSummaryCards = [
    ...analyticsCards,
    { label: 'Status', value: solvencyLabel, detail: summaryValues.available ? `${runwayPercent.toFixed(0)}% runway left` : 'Refresh to load values' },
    { label: 'Settlement', value: summary.supportsConfidentialSettlement ? 'Wrapper' : summary.treasuryRouteConfigured ? 'Direct' : 'No route', detail: summary.treasuryRouteConfigured ? 'Route configured' : 'No treasury route' }
  ]
  const auditorTabs: Array<{ id: AuditorPortalTab; label: string }> = [
    { id: 'access', label: 'Access' },
    { id: 'review', label: 'Review' },
    { id: 'receipts', label: 'Receipts' }
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
            Shared-Permit Review
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
                  Enable Auditor Access
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
                  Active permit: {activePermit ? shortHash(activePermit.hash) : 'None selected'}
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
                    Import Shared Permit
                  </button>
                </div>
                <textarea
                  value={sharedPayload}
                  onChange={(event) => setSharedPayload(event.target.value)}
                  className="min-h-[236px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-mono text-white/85 placeholder:text-white/35"
                  placeholder="Paste the shared payload"
                />
              </div>

            </GlassCard>
          </div>

          <div className="space-y-6">
            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl min-h-[318px]">
              <div className="flex items-center gap-3 mb-6">
                <KeyRound className="w-5 h-5 text-emerald-300" />
                <h2 className="text-2xl font-bold text-white">Recipient permits</h2>
              </div>

              <div className="space-y-3">
                {recipientPermits.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-[#a1a1aa]">
                    No recipient permits are stored for this wallet yet.
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
                                toast.success('Recipient permit activated for this auditor session.')
                              }}
                              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
                            >
                              {isActive ? 'Active Permit' : 'Use Permit'}
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
                  <p className="text-white/55 uppercase tracking-[0.18em] text-xs font-bold mb-2">Treasury path</p>
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
              Verify keeps disclosure narrower than publish.
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
                  Ciphertext handle: <span className="font-mono">{shortHash(lastEvidenceReceipt.ctHash) ?? lastEvidenceReceipt.ctHash}</span>
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
          </div>
        </GlassCard>
        ) : null}

      </div>
      <CipherBotWidget
        scope="auditor"
        headline="Your contextual guide for CipherRoll auditor review."
        intro="I can help with permit import, aggregate-only review, verify versus publish receipts, disclosure boundaries, and common auditor-side refresh errors. Ask me what you need."
      />
    </div>
  )
}
