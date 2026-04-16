'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  FolderCog,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
  Zap
} from 'lucide-react'
import GlassCard from '@/components/GlassCard'
import { motion, AnimatePresence } from 'framer-motion'
import NetworkStatus from '@/components/NetworkStatus'
import { useCipherRollWallet } from '@/components/EvmWalletProvider'
import { getCipherRollContract, formatHandle } from '@/lib/cipherroll-client'
import {
  CONTRACT_ADDRESS,
  DEFAULT_ORG_ID,
  formatBytes32Preview,
  makeDeterministicLabel,
  safeAddress,
  SUPPORTED_CHAIN_NAMES,
  TARGET_CHAIN_ID,
  TARGET_CHAIN_NAME,
  toBytes32Label
} from '@/lib/cipherroll-config'
import {
  extractCipherRollErrorMessage,
  parseDecimalAmountToWei,
  shortHash
} from '@/lib/admin-portal-utils'
import { decryptUint128ForView, encryptUint128, initCofhe } from '@/lib/fhenix-permits'

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

type AdminPortal = 'overview' | 'setup' | 'budget' | 'payroll'

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

export default function AdminPage() {
  const { address, signer, provider, chainId, isInstalled, switchToTargetChain } = useCipherRollWallet()
  const [activePortal, setActivePortal] = useState<AdminPortal>('overview')
  const [orgIdInput, setOrgIdInput] = useState(DEFAULT_ORG_ID)
  const [workspaceName, setWorkspaceName] = useState('CipherRoll Core')
  const [budgetAmount, setBudgetAmount] = useState('25.5')
  const [employeeAddress, setEmployeeAddress] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('3.5')
  const [paymentMemo, setPaymentMemo] = useState('March payroll')
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
    const hasSeenGuide = localStorage.getItem('cipherroll-admin-guide-seen')
    if (!hasSeenGuide) {
      setShowGuide(true)
    }
  }, [])

  useEffect(() => {
    setCofheReady(false)
  }, [address, chainId])

  const closeGuide = () => {
    localStorage.setItem('cipherroll-admin-guide-seen', 'true')
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

  const orgId = useMemo(() => toBytes32Label(orgIdInput), [orgIdInput])
  const isConfigured = Boolean(CONTRACT_ADDRESS)
  const isTargetChain = chainId === TARGET_CHAIN_ID
  const isAdmin = address && organization.admin
    ? address.toLowerCase() === organization.admin.toLowerCase()
    : false
  const budgetAmountInWei = useMemo(() => parseDecimalAmountToWei(budgetAmount), [budgetAmount])
  const paymentAmountInWei = useMemo(() => parseDecimalAmountToWei(paymentAmount), [paymentAmount])
  const availableBudgetInWei = useMemo(
    () => parseDecimalAmountToWei(summaryValues.available ?? ''),
    [summaryValues.available]
  )
  const canReadState = Boolean(provider && isConfigured && isTargetChain)
  const canSubmitTransactions = Boolean(signer && isConfigured && isTargetChain)
  const canEncryptInputs = Boolean(canSubmitTransactions && cofheReady)
  const workspaceOwnedByAnotherAdmin = Boolean(organization.exists && address && !isAdmin)
  const payrollWouldZeroOut = Boolean(
    paymentAmountInWei !== null &&
    availableBudgetInWei !== null &&
    paymentAmountInWei > availableBudgetInWei
  )

  const portalTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'setup', label: 'Workspace' },
    { id: 'budget', label: 'Add Budget' },
    { id: 'payroll', label: 'Pay One Employee' }
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

  const loadOrganization = useCallback(async (reason: 'auto' | 'manual' | 'post-action' = 'manual') => {
    if (!provider) {
      clearSummaries()
      setOrganization(defaultOrganization)
      setRefreshError('Connect an injected wallet to load the organization state.')
      return
    }

    if (!isConfigured) {
      clearSummaries()
      setOrganization(defaultOrganization)
      setRefreshError('Set NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS before using the admin portal.')
      return
    }

    if (!isTargetChain) {
      clearSummaries()
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
      clearSummaries()

      if (!nextOrg.exists) {
        const detail = 'No workspace exists for the current organization id yet. Create it first, then refresh again.'
        setSurfaceStatus({
          tone: reason === 'post-action' ? 'success' : 'info',
          title: 'Workspace not created yet',
          detail
        })
      } else if (address && nextOrg.admin.toLowerCase() === address.toLowerCase() && signer && cofheReady) {
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
          detail: 'Workspace metadata and admin budget handles were loaded successfully.'
        })
      } else if (address && nextOrg.exists && nextOrg.admin.toLowerCase() !== address.toLowerCase()) {
        setSurfaceStatus({
          tone: 'error',
          title: 'Connected wallet is not the workspace admin',
          detail: 'Refresh succeeded, but admin-only budget handles remain unavailable for this wallet.'
        })
      } else if (nextOrg.exists && !cofheReady) {
        setSurfaceStatus({
          tone: 'info',
          title: 'Workspace loaded without decrypted summaries',
          detail: 'Initialize CoFHE to decrypt the admin-only budget handles after refresh.'
        })
      }

      setLastRefreshedAt(Date.now())
    } catch (error) {
      const message = extractCipherRollErrorMessage(error)
      clearSummaries()
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
    cofheReady,
    isConfigured,
    isTargetChain,
    orgId,
    provider,
    signer
  ])

  useEffect(() => {
    void loadOrganization('auto')
  }, [loadOrganization])

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
      await loadOrganization('post-action')
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
      await loadOrganization('post-action')
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
        makeDeterministicLabel('workspace', workspaceName.trim() || 'CipherRoll Core'),
        3,
        2
      )
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

    if (payrollWouldZeroOut) {
      toast.error('Requested payroll exceeds the decrypted available budget. CipherRoll would zero the allocation, so this action is blocked until the budget is increased.')
      return
    }

    const paymentId = makeDeterministicLabel('payment', `${employee}:${Date.now()}`)
    const memoHash = makeDeterministicLabel('memo', paymentMemo.trim() || 'cipherroll-payroll')

    await withTransaction(
      'Payroll issuance',
      'Approve the wallet transaction to encrypt and issue this employee allocation.',
      'Confidential payroll allocation issued.',
      async () => {
      const contract = getCipherRollContract(signer!)
      const encryptedAmount = await encryptUint128(paymentAmountInWei)

      return contract.issueConfidentialPayroll(
        orgId,
        employee,
        encryptedAmount,
        paymentId,
        memoHash
      )
      }
    )
  }

  const summaryCards = [
    { label: 'Budget', value: summaryValues.budget, handle: summaryHandles?.budget ?? null },
    { label: 'Committed', value: summaryValues.committed, handle: summaryHandles?.committed ?? null },
    { label: 'Available', value: summaryValues.available, handle: summaryHandles?.available ?? null }
  ]

  const readinessChecklist = [
    {
      label: 'Admin wallet connected',
      complete: Boolean(address)
    },
    {
      label: 'Workspace created',
      complete: organization.exists
    },
    {
      label: 'Connected wallet is admin',
      complete: Boolean(isAdmin)
    },
    {
      label: 'CoFHE initialized',
      complete: cofheReady
    },
    {
      label: `${TARGET_CHAIN_NAME} selected`,
      complete: Boolean(isTargetChain)
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
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white mb-4">
            Admin Portal
          </h1>
          <p className="text-[#a1a1aa] text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
            Run the core protocol lifecycle with a streamlined operator surface: create workspaces, allocate budgets, and securely issue encrypted employee salaries on {SUPPORTED_CHAIN_NAMES}.
          </p>
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

        <div className="mt-8 grid gap-4">
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
                  onClick={() => void loadOrganization('manual')}
                  disabled={!canReadState || isRefreshing}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                >
                  {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {isRefreshing ? 'Refreshing...' : 'Refresh Organization'}
                </button>
              </div>
            </div>

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
        </div>

        {activePortal === 'overview' && (
          <div className="grid lg:grid-cols-[0.92fr,1.08fr] gap-8 mt-8">
            <div className="space-y-6">
              <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <Wallet className="w-5 h-5 text-cyan-300" />
                  <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Operator access</h2>
                    <p className="text-sm text-[#a1a1aa] mt-2">
                      Connect the admin wallet from the top navigation, then enable permit-based reads for encrypted summaries.
                    </p>
                  </div>
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
                    onClick={() => void loadOrganization('manual')}
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

              <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                  <h2 className="text-xl font-bold text-white">{TARGET_CHAIN_NAME} Readiness</h2>
                </div>
                <div className="space-y-3">
                  {readinessChecklist.map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                      <span className="text-white">{item.label}</span>
                      <span className={item.complete ? 'text-emerald-300 font-semibold' : 'text-white/50'}>
                        {item.complete ? 'Ready' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>

            <div className="space-y-6">
              <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <ShieldCheck className="w-5 h-5 text-emerald-300" />
                  <div>
                    <h2 className="text-2xl font-bold text-white">Encrypted Budget Summary</h2>
                    <p className="text-sm text-[#a1a1aa] mt-2">
                      Admin-only aggregate state with optional permit-backed decryption.
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  {summaryCards.map((item) => (
                    <div key={item.label} className="relative rounded-2xl border border-white/10 bg-white/5 p-6 overflow-hidden">
                      <div className="flex justify-between items-center mb-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/55 font-bold">{item.label}</p>
                        {item.value ? (
                          <div className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Decrypted</div>
                        ) : (
                          <div className="bg-white/10 text-white/50 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Locked</div>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-4xl font-black text-white">{item.value ?? '***'}</p>
                        {item.value && <span className="text-sm text-white/50 font-semibold">ETH</span>}
                      </div>
                      <p className="text-[10px] text-[#8e8e95] mt-4 font-mono truncate" title={String(item.handle)}>Handle: {item.handle ? "Encrypted (Hidden)" : "Not Created"}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
                <div className="flex items-center gap-3 mb-4">
                  <Building2 className="w-5 h-5 text-cyan-300" />
                  <h2 className="text-xl font-bold text-white">Workspace snapshot</h2>
                </div>

                <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-white/55 uppercase tracking-[0.18em] text-xs font-bold mb-2">Org id</p>
                    <p className="font-mono text-white">{formatBytes32Preview(orgId)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-white/55 uppercase tracking-[0.18em] text-xs font-bold mb-2">Workspace state</p>
                    <p className="text-white">{organization.exists ? 'Created on-chain' : 'Not created yet'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-white/55 uppercase tracking-[0.18em] text-xs font-bold mb-2">Reserved quorum</p>
                    <p className="text-white">{organization.reservedQuorum} of {organization.reservedAdminSlots}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-white/55 uppercase tracking-[0.18em] text-xs font-bold mb-2">Updated</p>
                    <p className="text-white">
                      {organization.updatedAt
                        ? new Date(organization.updatedAt * 1000).toLocaleString()
                        : 'No on-chain updates yet'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                  {`CipherRoll is configured for ${TARGET_CHAIN_NAME} within the supported ${SUPPORTED_CHAIN_NAMES} rollout. Organizational state remains encrypted on the host chain.`}
                </div>

                <Link href="/docs" className="inline-flex items-center gap-2 text-sm font-semibold text-white mt-6 underline underline-offset-4">
                  Read the CoFHE architecture notes
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </Link>
              </GlassCard>
            </div>
          </div>
        )}

        {activePortal === 'setup' && (
          <div className="grid lg:grid-cols-2 gap-8 mt-8">
            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="w-5 h-5 text-cyan-300" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Create workspace</h2>
                  <p className="text-sm text-[#a1a1aa] mt-2">
                    This is the one required setup step before budget and payroll actions.
                  </p>
                </div>
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
          </div>
        )}

        {activePortal === 'budget' && (
          <div className="grid lg:grid-cols-[1.08fr,0.92fr] gap-8 mt-8">
            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <FolderCog className="w-5 h-5 text-cyan-300" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Add budget</h2>
                  <p className="text-sm text-[#a1a1aa] mt-2">
                    Budget amounts are accepted as plain integers, then encrypted client-side by the @cofhe/sdk encryptInputs flow before touching the blockchain.
                  </p>
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
                  <p className="text-sm text-[#a1a1aa] mt-2">
                    These stay encrypted unless the admin wallet also has a permit.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                  {summaryCards.map((item) => (
                    <div key={item.label} className="relative rounded-2xl border border-white/10 bg-white/5 p-6 overflow-hidden">
                      <div className="flex justify-between items-center mb-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/55 font-bold">{item.label}</p>
                        {item.value ? (
                          <div className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Decrypted</div>
                        ) : (
                          <div className="bg-white/10 text-white/50 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Locked</div>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-4xl font-black text-white">{item.value ?? '***'}</p>
                        {item.value && <span className="text-sm text-white/50 font-semibold">ETH</span>}
                      </div>
                      <p className="text-[10px] text-[#8e8e95] mt-4 font-mono truncate" title={String(item.handle)}>Handle: {item.handle ? "Encrypted (Hidden)" : "Not Created"}</p>
                    </div>
                  ))}
              </div>
            </GlassCard>
          </div>
        )}

        {activePortal === 'payroll' && (
          <div className="grid lg:grid-cols-[1.08fr,0.92fr] gap-8 mt-8">
            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <KeyRound className="w-5 h-5 text-cyan-300" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Pay one employee</h2>
                  <p className="text-sm text-[#a1a1aa] mt-2">
                    This interface supports a single, push-style confidential payroll issuance from admins directly to specific employees.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <input
                  value={employeeAddress}
                  onChange={(event) => setEmployeeAddress(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                  placeholder="Employee wallet address"
                />
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
                  placeholder="March payroll"
                />
                <button
                  onClick={issuePayroll}
                  disabled={
                    !canEncryptInputs ||
                    !organization.exists ||
                    !isAdmin ||
                    isBusy ||
                    paymentAmountInWei === null ||
                    !safeAddress(employeeAddress) ||
                    payrollWouldZeroOut
                  }
                  className="w-full rounded-2xl bg-white text-black px-4 py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                >
                  Issue Confidential Payroll
                </button>
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

              {organization.exists && !cofheReady && (
                <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                  Initialize CoFHE before issuing payroll so the amount can be encrypted client-side.
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                <h2 className="text-xl font-bold text-white">Before you send</h2>
              </div>

              <div className="space-y-3 text-sm">
                {[
                  { label: 'Workspace is already created', complete: organization.exists },
                  { label: 'Connected wallet matches the admin', complete: Boolean(isAdmin) },
                  { label: 'Budget has been funded', complete: Boolean(summaryHandles) },
                  { label: 'Employee wallet address is valid', complete: Boolean(safeAddress(employeeAddress)) },
                  { label: 'Requested amount fits decrypted budget', complete: !payrollWouldZeroOut }
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-white">{item.label}</span>
                    <span className={item.complete ? 'text-emerald-300 font-semibold' : 'text-white/50'}>
                      {item.complete ? 'Yes' : 'No'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-[#a1a1aa] leading-relaxed">
                The employee must later connect the same wallet on the employee portal and generate a permit to decrypt the confidential allocation handle.
              </div>
            </GlassCard>
          </div>
        )}


      </div>

      <AnimatePresence>
        {showGuide && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-black/70 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden mt-20"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-cyan-400/10 border border-cyan-400/20">
                      <Zap className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white leading-tight">Admin Flow</h2>
                      <p className="text-white/45 text-[10px] uppercase tracking-widest font-bold mt-0.5">Quick Start Guide</p>
                    </div>
                  </div>
                  <button 
                    onClick={closeGuide}
                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-5">
                  {[
                    { step: "01", title: "Initialize CoFHE", desc: "First, activate the browser privacy worker in the top header.", icon: KeyRound },
                    { step: "02", title: "Setup Workspace", desc: "Define your organization id and create the on-chain workspace in the Workspace tab.", icon: Building2 },
                    { step: "03", title: "Add Budget", desc: "Deposit budget into the encrypted payroll pool. Amounts are encrypted before submission.", icon: FolderCog },
                    { step: "04", title: "Execute Payroll", desc: "Issue confidential salary payouts to individual employee addresses.", icon: ShieldCheck },
                    { step: "05", title: "Refresh Summaries", desc: "Reload admin-only budget handles and decrypt them once the admin wallet has initialized CoFHE.", icon: Wallet }
                  ].map((item) => (
                    <div key={item.step} className="flex gap-4 group">
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-cyan-400/60 transition-all duration-300">
                        {item.step}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                           <item.icon className="w-3.5 h-3.5 text-cyan-400/40" />
                           <h4 className="text-white font-bold text-sm">{item.title}</h4>
                        </div>
                        <p className="text-xs text-[#a1a1aa] leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={closeGuide}
                  className="w-full mt-8 py-4 rounded-xl bg-white text-black font-bold text-sm hover:bg-white/90 active:scale-[0.98] transition-all"
                >
                  Ok, I understand
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  )
}
