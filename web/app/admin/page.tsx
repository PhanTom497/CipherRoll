'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Copy,
  FileKey2,
  FolderCog,
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
import { getCipherRollContract, formatHandle } from '@/lib/cipherroll-client'
import {
  CONTRACT_ADDRESS,
  DEFAULT_ORG_ID,
  DIRECT_SETTLEMENT_ADAPTER_ADDRESS,
  formatBytes32Preview,
  makeHighEntropyBytes32Label,
  makeHighEntropyLabel,
  makeDeterministicLabel,
  safeAddress,
  TARGET_CHAIN_ID,
  TARGET_CHAIN_NAME,
  WRAPPER_SETTLEMENT_ADAPTER_ADDRESS,
  toBytes32Label
} from '@/lib/cipherroll-config'
import {
  extractCipherRollErrorMessage,
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
  OrganizationInsightsView,
  PayrollRunView,
  TreasuryAdapterConfig
} from '@/lib/cipherroll-types'

type OrganizationView = {
  admin: string
  treasuryAdapter: string
  metadataHash: string
  treasuryRouteId: string
  reservedAdminSlots: number
  reservedQuorum: number
  createdAt: number
  updatedAt: number
  exists: boolean
}

type AdminPortal = 'overview' | 'setup' | 'budget' | 'payroll' | 'auditor'

type SurfaceStatusTone = 'neutral' | 'info' | 'success' | 'error'

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

export default function AdminPage() {
  const { address, signer, provider, chainId, isInstalled, switchToTargetChain } = useCipherRollWallet()
  const [activePortal, setActivePortal] = useState<AdminPortal>('overview')
  const [orgIdInput, setOrgIdInput] = useState(DEFAULT_ORG_ID)
  const [workspaceName, setWorkspaceName] = useState('CipherRoll Core')
  const [budgetAmount, setBudgetAmount] = useState('25.5')
  const [employeeAddress, setEmployeeAddress] = useState('')
  const [payrollMode, setPayrollMode] = useState<'instant' | 'vesting'>('instant')
  const [paymentAmount, setPaymentAmount] = useState('3.5')
  const [paymentMemo, setPaymentMemo] = useState('')
  const [vestingStartInput, setVestingStartInput] = useState('')
  const [vestingEndInput, setVestingEndInput] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [cofheReady, setCofheReady] = useState(false)
  const [organization, setOrganization] = useState<OrganizationView>(defaultOrganization)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [surfaceStatus, setSurfaceStatus] = useState<SurfaceStatus>({
    tone: 'neutral',
    title: 'Awaiting operator input',
    detail: 'Connect the admin wallet, confirm the target network, and refresh the workspace state.'
  })
  const [showGuide, setShowGuide] = useState(false)

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

  const orgId = useMemo(() => toBytes32Label(orgIdInput), [orgIdInput])
  const isConfigured = Boolean(CONTRACT_ADDRESS)
  const isTargetChain = chainId === TARGET_CHAIN_ID
  const isAdmin = address && organization.admin
    ? address.toLowerCase() === organization.admin.toLowerCase()
    : false
  const budgetAmountInWei = useMemo(() => parseDecimalAmountToWei(budgetAmount), [budgetAmount])
  const paymentAmountInWei = useMemo(() => parseDecimalAmountToWei(paymentAmount), [paymentAmount])
  const payrollFundingAmountInWei = useMemo(() => parseDecimalAmountToWei(payrollFundingAmount), [payrollFundingAmount])
  const treasuryDepositAmountInWei = useMemo(() => parseDecimalAmountToWei(treasuryDepositAmount), [treasuryDepositAmount])
  const selectedPayrollRunId = useMemo(() => toBytes32Label(selectedPayrollRunInput), [selectedPayrollRunInput])
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
  const workspaceOwnedByAnotherAdmin = Boolean(organization.exists && address && !isAdmin)
  const payrollRunExists = payrollRun.exists && payrollRun.orgId === orgId
  const payrollRunStatusLabel = payrollRunExists
    ? ['Draft', 'Funded', 'Active', 'Finalized'][payrollRun.status] ?? 'Unknown'
    : 'Not created'
  const payrollRunOpenForAllocations = payrollRunExists && payrollRun.status < 2
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

  const portalTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'setup', label: 'Workspace' },
    { id: 'budget', label: 'Add Budget' },
    { id: 'payroll', label: 'Pay One Employee' },
    { id: 'auditor', label: 'Auditor Sharing' }
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
            detail: 'Workspace metadata, payroll counters, and encrypted admin summaries were loaded successfully.'
          })
        } else {
          setSurfaceStatus({
            tone: 'info',
            title: 'Workspace loaded with aggregate activity',
            detail: 'Payroll counts are available now. Initialize CoFHE to unlock the encrypted budget summaries as well.'
          })
        }
      } else if (address && nextOrg.exists && nextOrg.admin.toLowerCase() !== address.toLowerCase()) {
        setSurfaceStatus({
          tone: 'error',
          title: 'Connected wallet is not the workspace admin',
          detail: 'Refresh succeeded, but admin-only budget handles remain unavailable for this wallet.'
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
      toast.error(`Switch the wallet to ${TARGET_CHAIN_NAME} before initializing CoFHE.`)
      return
    }

    setSurfaceStatus({
      tone: 'info',
      title: 'Initializing CoFHE',
      detail: 'Approve the wallet prompts so CipherRoll can prepare local encryption and permit-backed reads.'
    })

    try {
      const provider = (window as any).ethereum || signer.provider
      await initCofhe(provider)
      setCofheReady(true)
      setSurfaceStatus({
        tone: 'success',
        title: 'CoFHE ready',
        detail: 'Admin encryption and decryptForView reads are now available for this wallet.'
      })
      toast.success('CoFHE encryption initialized for this admin wallet.')
      await refreshWorkspaceState('post-action')
    } catch (error: any) {
      const message = extractCipherRollErrorMessage(error)
      setSurfaceStatus({
        tone: 'error',
        title: 'CoFHE initialization failed',
        detail: message
      })
      toast.error(message)
    }
  }

  const withTransaction = async (
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

      const tx = await work()

      setSurfaceStatus({
        tone: 'info',
        title: `${actionTitle} submitted`,
        detail: 'Transaction broadcast to the network. Waiting for confirmation...',
        txHash: tx.hash ?? null
      })

      await tx.wait()
      await refreshWorkspaceState('post-action')
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
  }

  const createAuditorPermit = async () => {
    if (!canSubmitTransactions) {
      toast.error(`Connect the admin wallet and switch to ${TARGET_CHAIN_NAME} before creating an auditor sharing permit.`)
      return
    }

    if (!cofheReady) {
      toast.error('Initialize CoFHE first so the current @cofhe/sdk sharing-permit flow can sign and store the disclosure locally.')
      return
    }

    if (!organization.exists) {
      toast.error('Create the workspace first so the disclosure scope matches a real organization.')
      return
    }

    if (!isAdmin) {
      toast.error('Only the workspace admin can create auditor sharing permits for this organization.')
      return
    }

    if (!auditorRecipientSafeAddress) {
      toast.error('Enter a valid auditor wallet address before creating the sharing permit.')
      return
    }

    if (!auditorPermitExpirationTimestamp || auditorPermitExpirationTimestamp <= Math.floor(Date.now() / 1000)) {
      toast.error('Choose an expiration time in the future before sharing auditor access.')
      return
    }

    setIsBusy(true)
    try {
      setSurfaceStatus({
        tone: 'info',
        title: 'Creating auditor sharing permit',
        detail: 'Approve the wallet signature so CipherRoll can create a scoped sharing permit for aggregate auditor access.'
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
        title: 'Auditor sharing permit created',
        detail: 'The non-sensitive payload is ready to copy or hand off to the named auditor recipient.'
      })
      toast.success('Auditor sharing payload created. Copy it from the panel before handing it to the auditor.')
    } catch (error) {
      const message = extractCipherRollErrorMessage(error)
      setSurfaceStatus({
        tone: 'error',
        title: 'Auditor sharing setup failed',
        detail: message
      })
      toast.error(message)
    } finally {
      setIsBusy(false)
    }
  }

  const copyAuditorPayload = async (payload: string) => {
    if (!payload) {
      toast.error('Create or select an auditor sharing permit first.')
      return
    }

    try {
      await navigator.clipboard.writeText(payload)
      toast.success('Auditor sharing payload copied.')
    } catch {
      toast.error('Clipboard copy failed in this browser. You can still copy the payload manually.')
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
    toast.success('Auditor sharing permit removed from this admin browser.')
  }

  const createOrganization = async () => {
    if (!canSubmitTransactions) {
      toast.error(`Connect the admin wallet and switch to ${TARGET_CHAIN_NAME} before creating a workspace.`)
      return
    }

    if (organization.exists) {
      toast.error('This workspace already exists on-chain for the current organization id.')
      return
    }

    if (!workspaceName.trim()) {
      toast.error('Enter a workspace name before creating the organization.')
      return
    }

    await withTransaction(
      'Workspace creation',
      'Approve the wallet transaction to create the on-chain organization workspace.',
      'CipherRoll workspace created on-chain.',
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
      toast.error('Create the workspace first before attaching a treasury route.')
      return
    }

    if (!isAdmin) {
      toast.error('Only the workspace admin can configure treasury settlement.')
      return
    }

    if (!treasuryRouteLabel.trim()) {
      toast.error('Enter a treasury route label before configuring settlement.')
      return
    }

    if (!canConfigureTreasuryRoute) {
      toast.error('This frontend does not have a settlement adapter address configured for the selected route.')
      return
    }

    await withTransaction(
      'Treasury route setup',
      'Approve the wallet transaction to attach the selected settlement route to this workspace.',
      treasuryRouteMode === 'wrapper'
        ? 'Wrapper treasury route configured for this workspace.'
        : 'Direct treasury route configured for this workspace.',
      async () => {
        const contract = getCipherRollContract(signer!)
        return contract.configureTreasury(orgId, selectedTreasuryAdapterAddress, treasuryRouteId)
      }
    )
  }

  const depositBudget = async () => {
    if (!canEncryptInputs) {
      toast.error(`Connect the admin wallet, switch to ${TARGET_CHAIN_NAME}, and initialize CoFHE before adding budget.`)
      return
    }

    if (!organization.exists) {
      toast.error('Create the workspace first before adding budget.')
      return
    }

    if (!isAdmin) {
      toast.error('Only the workspace admin can add encrypted budget.')
      return
    }

    if (budgetAmountInWei === null) {
      toast.error('Enter a positive budget amount with up to 18 decimal places.')
      return
    }

    await withTransaction(
      'Budget funding',
      'Approve the wallet transaction to encrypt and deposit the budget amount.',
      'Encrypted payroll budget increased.',
      async () => {
      const contract = getCipherRollContract(signer!)
      const encryptedAmount = await encryptUint128(budgetAmountInWei)

      return contract.depositBudget(orgId, encryptedAmount)
      }
    )
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
      toast.info('This payroll run already exists. Continue with funding or choose a new label.')
      await loadPayrollRun()
      return
    }

    if (!payrollFundingDeadlineTimestamp) {
      toast.error('Choose a funding deadline for this payroll run.')
      return
    }

    await withTransaction(
      'Payroll run creation',
      'Approve the wallet transaction to create the payroll run shell before uploading allocations.',
      'Payroll run created.',
      async () => {
        const contract = getCipherRollContract(signer!)
        return contract.createPayrollRun(
          orgId,
          selectedPayrollRunId,
          payrollSettlementAssetId,
          payrollFundingDeadlineTimestamp,
          1
        )
      }
    )

    await loadPayrollRun()
  }

  const fundPayrollRun = async () => {
    if (!payrollRunExists) {
      toast.error('Create or load a payroll run before funding it.')
      return
    }

    if (payrollRun.allocationCount === 0) {
      toast.error('Add the employee allocation to this payroll run before reserving treasury funds.')
      return
    }

    if (payrollFundingAmountInWei === null) {
      toast.error('Enter a positive funding amount with up to 18 decimal places.')
      return
    }

    if (hasTreasuryRoute) {
      if (!canSubmitTransactions) {
        toast.error(`Connect the admin wallet and switch to ${TARGET_CHAIN_NAME} before funding a payroll run from treasury.`)
        return
      }

      await withTransaction(
        'Payroll run funding',
        'Approve the wallet transaction to reserve actual treasury inventory for this payroll run.',
        'Payroll run funded from treasury inventory and ready for activation.',
        async () => {
          const contract = getCipherRollContract(signer!)
          return contract.fundPayrollRunFromTreasury(orgId, selectedPayrollRunId, payrollFundingAmountInWei)
        }
      )

      await loadPayrollRun()
      return
    }

    if (!canEncryptInputs) {
      toast.error(`Connect the admin wallet, switch to ${TARGET_CHAIN_NAME}, and initialize CoFHE before funding a payroll run.`)
      return
    }

    await withTransaction(
      'Payroll run funding',
      'Approve the wallet transaction to lock payroll funding from the encrypted organization budget.',
      'Payroll run funded and ready for activation.',
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
      toast.error('This workspace does not have a treasury settlement route configured yet.')
      return
    }

    if (treasuryDepositAmountInWei === null) {
      toast.error('Enter a positive treasury funding amount with up to 18 decimal places.')
      return
    }

    await withTransaction(
      'Treasury funding',
      'Approve the token approval and treasury deposit transactions to move real inventory into the payroll treasury.',
      'Payroll treasury funded from token inventory.',
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
      toast.error('Create or load a payroll run before activating it.')
      return
    }

    await withTransaction(
      'Payroll activation',
      'Approve the wallet transaction to open employee claimability for this payroll run.',
      'Payroll run activated and claim window opened.',
      async () => {
        const contract = getCipherRollContract(signer!)
        return contract.activatePayrollRun(orgId, selectedPayrollRunId)
      }
    )

    await loadPayrollRun()
  }

  const issuePayroll = async () => {
    if (!canEncryptInputs) {
      toast.error(`Connect the admin wallet, switch to ${TARGET_CHAIN_NAME}, and initialize CoFHE before issuing payroll.`)
      return
    }

    if (!organization.exists) {
      toast.error('Create the workspace first before issuing payroll.')
      return
    }

    if (!isAdmin) {
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
      toast.error('Create or load a payroll run before uploading allocations.')
      return
    }

    if (!payrollRunOpenForAllocations) {
      toast.error('This payroll run is no longer open for allocation uploads.')
      return
    }

    if (payrollWouldZeroOut) {
      toast.error('Requested payroll exceeds the decrypted available budget. CipherRoll would zero the allocation, so this action is blocked until the budget is increased.')
      return
    }

    const paymentId = makeHighEntropyBytes32Label('payment', employee)
    const memoHash = paymentMemo.trim()
      ? makeDeterministicLabel('memo', paymentMemo.trim())
      : makeHighEntropyBytes32Label('memo', 'cipherroll-payroll')

    await withTransaction(
      'Payroll issuance',
      'Approve the wallet transaction to encrypt and issue this employee allocation.',
      payrollMode === 'vesting'
        ? 'Confidential vesting payroll allocation issued.'
        : 'Confidential payroll allocation issued.',
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
        memoHash
      )
      }
    )

    await loadPayrollRun()
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
          title: 'CoFHE still needs initialization',
          detail: 'Reads can load organization metadata already, but encrypted budget funding and decrypted summary checks require CoFHE initialization.'
        }
      : null,
    payrollWouldZeroOut
      ? {
          tone: 'error' as const,
          title: 'Payroll amount exceeds decrypted available budget',
          detail: 'The contract would silently zero this allocation. Increase the budget or lower the amount before submitting.'
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
            Authorized Operators Only
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
                    Operator Status
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
                              detail: 'Refresh the organization state or continue with the next admin action.'
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
                  <h2 className="text-2xl font-bold text-white tracking-tight">Operator access</h2>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-white/55 uppercase tracking-[0.18em] text-xs font-bold mb-2">Wallet</p>
                    <p className="text-white">
                      {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connect from nav'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-white/55 uppercase tracking-[0.18em] text-xs font-bold mb-2">Admin role</p>
                    <p className="text-white">{isAdmin ? 'Authorized' : 'Waiting'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-white/55 uppercase tracking-[0.18em] text-xs font-bold mb-2">CoFHE</p>
                    <p className="text-white">{cofheReady ? 'Ready' : 'Not initialized'}</p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={initializeCofhe}
                    disabled={!canSubmitTransactions || isBusy}
                    className="rounded-2xl bg-white text-black px-5 py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                  >
                    Initialize CoFHE
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
                      <p className="mt-4 truncate text-[10px] text-[#8e8e95] font-mono" title={String(item.handle)}>
                        {item.handle ? 'Encrypted handle' : 'No handle yet'}
                      </p>
                    </div>
                  ))}
                </div>
              </GlassCard>

            </div>
          </div>
          <GlassCard className="mt-8 p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="w-5 h-5 text-cyan-300" />
              <h2 className="text-2xl font-bold text-white">Operator insights</h2>
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
                  <p>
                    Simple workspace names are easy to use, but easier for outsiders to guess. For a safer setup, switch to a harder-to-guess workspace ID.
                  </p>
                  <button
                    type="button"
                    onClick={assignHighEntropyOrgLabel}
                    className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-white transition-colors hover:bg-white/10"
                  >
                    Use safer ID
                  </button>
                </div>
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
                    { id: 'wrapper', label: 'FHERC20 wrapper' },
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

                <input
                  value={treasuryRouteLabel}
                  onChange={(event) => setTreasuryRouteLabel(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                  placeholder="Treasury route label"
                />
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-[#a1a1aa]">
                  <p>
                    A simple route name is easier to guess. If you do not need a memorable label, switch to a safer route name.
                  </p>
                  <button
                    type="button"
                    onClick={assignHighEntropyRouteLabel}
                    className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-white transition-colors hover:bg-white/10"
                  >
                    Use safer name
                  </button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-[#c9c9d0] space-y-2">
                  <p className="text-white font-semibold">
                    {treasuryRouteMode === 'wrapper' ? 'FHERC20 wrapper route' : 'Direct treasury route'}
                  </p>
                  <p>
                    {treasuryRouteMode === 'wrapper'
                      ? 'Employees will request payout first, then finalize the wrapper claim with an on-chain proof flow that can reveal the amount before the underlying token is released.'
                      : 'Employees will claim once and receive the treasury payout token immediately.'}
                  </p>
                  <p className="font-mono break-all text-xs text-white/55">
                    Adapter: {selectedTreasuryAdapterAddress || 'Not configured in frontend env'}
                  </p>
                  {organization.treasuryAdapter && organization.treasuryAdapter !== '0x0000000000000000000000000000000000000000' ? (
                    <p className="font-mono break-all text-xs text-emerald-300">
                      Current workspace adapter: {organization.treasuryAdapter}
                    </p>
                  ) : null}
                </div>

                <button
                  onClick={configureTreasuryRoute}
                  disabled={!canSubmitTransactions || !organization.exists || !isAdmin || isBusy || !canConfigureTreasuryRoute}
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
                  placeholder="Permit name"
                />
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-white/55">Permit expiration</label>
                  <input
                    type="datetime-local"
                    value={auditorPermitExpirationInput}
                    onChange={(event) => setAuditorPermitExpirationInput(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
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
                Create Auditor Sharing Permit
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
                  placeholder="Create or select an auditor sharing permit to reveal the export payload here."
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
                  <h2 className="text-2xl font-bold text-white">Add budget</h2>
                  
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                  <input
                  value={budgetAmount}
                  onChange={(event) => setBudgetAmount(event.target.value)}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                  placeholder="25.5"
                />
                <button
                  onClick={depositBudget}
                  disabled={!canEncryptInputs || !organization.exists || !isAdmin || isBusy || budgetAmountInWei === null}
                  className="rounded-2xl bg-white text-black px-5 py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                >
                  Deposit Budget
                </button>
              </div>

              {!organization.exists && (
                <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                  Create the workspace first from the Workspace portal before funding it.
                </div>
              )}

              {organization.exists && !cofheReady && (
                <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                  Initialize CoFHE before budget funding so the amount can be encrypted client-side.
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
                    <h2 className="text-2xl font-bold text-white">Summary handles</h2>
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
                      <p className="mt-4 truncate text-[10px] text-[#8e8e95] font-mono" title={String(item.handle)}>
                        {item.handle ? 'Encrypted handle' : 'No handle yet'}
                      </p>
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

            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <KeyRound className="w-5 h-5 text-cyan-300" />
                <h2 className="text-2xl font-bold text-white">Pay one employee</h2>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
                  <p className="text-sm font-semibold text-white">Step 1: Create the payroll run</p>
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
                    <p>
                      A simple run name like a month is easy to follow, but also easier to guess. For a safer setup, switch to a harder-to-guess run ID.
                    </p>
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
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white"
                    />
                  </label>
                  <button
                    onClick={createPayrollRun}
                    disabled={!canSubmitTransactions || isBusy || !organization.exists}
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
                    <input
                      value={paymentMemo}
                      onChange={(event) => setPaymentMemo(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                      placeholder="Optional memo"
                    />
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-[#a1a1aa]">
                    Payment IDs are now made harder to guess automatically. If you type a very readable memo, though, someone may still be able to guess it later, so leave it blank or use a less obvious note when that matters.
                  </div>
                  {payrollMode === 'vesting' && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-sm">
                        <span className="text-white/70">Vesting start</span>
                        <input
                          type="datetime-local"
                          value={vestingStartInput}
                          onChange={(event) => setVestingStartInput(event.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="text-white/70">Vesting end</span>
                        <input
                          type="datetime-local"
                          value={vestingEndInput}
                          onChange={(event) => setVestingEndInput(event.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                        />
                      </label>
                    </div>
                  )}
                  <button
                    onClick={issuePayroll}
                    disabled={
                      !canEncryptInputs ||
                      !organization.exists ||
                      !isAdmin ||
                      isBusy ||
                      !payrollRunOpenForAllocations ||
                      paymentAmountInWei === null ||
                      !safeAddress(employeeAddress) ||
                      payrollWouldZeroOut ||
                      vestingWindowInvalid
                    }
                    className="w-full rounded-2xl bg-white text-black px-4 py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                  >
                    {payrollMode === 'vesting' ? 'Issue Vesting Payroll' : 'Issue Confidential Payroll'}
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
                        placeholder="Treasury deposit amount"
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
                      placeholder="Funding amount"
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
                  Initialize CoFHE before issuing payroll so the amount can be encrypted client-side.
                </div>
              )}
            </GlassCard>
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

                <p className="mb-5 max-w-xl text-[13px] leading-6 text-white/42">
                  Follow this order once and the full payroll flow becomes straightforward.
                </p>

                <div className="space-y-3">
                  {[
                    { step: "01", title: "Initialize CoFHE", desc: "Turn on privacy from the admin header first.", icon: KeyRound },
                    { step: "02", title: "Create workspace", desc: "Open Workspace and create your organization.", icon: Building2 },
                    { step: "03", title: "Add budget", desc: "Deposit payroll funds into the treasury.", icon: FolderCog },
                    { step: "04", title: "Pay one employee", desc: "Create run, reserve funds, activate claims, then issue payroll.", icon: ShieldCheck },
                    { step: "05", title: "Review and share", desc: "Refresh summaries or open Auditor Sharing when needed.", icon: Wallet }
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
        intro="I can help with workspace setup, budget versus treasury funding, reserve behavior, wrapper request plus finalize, auditor sharing flow, and common admin-side mistakes. Ask me what you are trying to do."
      />
    </main>
  )
}
