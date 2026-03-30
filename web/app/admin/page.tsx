'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Building2,
  Cable,
  CheckCircle2,
  FolderCog,
  KeyRound,
  ShieldCheck,
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
  toBytes32Label
} from '@/lib/cipherroll-config'
import { initCofhe, encryptUint128, unsealUint128 } from '@/lib/fhenix-permits'

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

type AdminPortal = 'overview' | 'setup' | 'budget' | 'payroll' | 'treasury'

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
  const { address, signer, provider } = useCipherRollWallet()
  const [activePortal, setActivePortal] = useState<AdminPortal>('overview')
  const [orgIdInput, setOrgIdInput] = useState(DEFAULT_ORG_ID)
  const [workspaceName, setWorkspaceName] = useState('CipherRoll Core')
  const [adapterAddress, setAdapterAddress] = useState('')
  const [treasuryRoute, setTreasuryRoute] = useState('wave1-privara-route')
  const [budgetAmount, setBudgetAmount] = useState('25.5')
  const [employeeAddress, setEmployeeAddress] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('3.5')
  const [paymentMemo, setPaymentMemo] = useState('March payroll')
  const [isBusy, setIsBusy] = useState(false)
  const [cofheReady, setCofheReady] = useState(false)
  const [organization, setOrganization] = useState<OrganizationView>(defaultOrganization)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    const hasSeenGuide = localStorage.getItem('cipherroll-admin-guide-seen')
    if (!hasSeenGuide) {
      setShowGuide(true)
    }
  }, [])

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
  const isAdmin = address && organization.admin
    ? address.toLowerCase() === organization.admin.toLowerCase()
    : false

  const portalTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'setup', label: 'Workspace' },
    { id: 'budget', label: 'Add Budget' },
    { id: 'payroll', label: 'Pay One Employee' },
    { id: 'treasury', label: 'Treasury' }
  ] as const satisfies ReadonlyArray<{
    id: AdminPortal
    label: string
  }>

  const loadOrganization = useCallback(async () => {
    if (!provider || !isConfigured) return

    try {
      const contract = getCipherRollContract(signer ?? provider!)
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

      if (address && nextOrg.exists && nextOrg.admin.toLowerCase() === address.toLowerCase()) {
        if (signer && cofheReady) {
          const nextHandles = await contract.getAdminBudgetHandles(orgId)
          setSummaryHandles(nextHandles)

          const [budgetValue, committedValue, availableValue] = await Promise.all([
            unsealUint128(nextHandles.budget),
            unsealUint128(nextHandles.committed),
            unsealUint128(nextHandles.available)
          ])

          setSummaryValues({
            budget: budgetValue,
            committed: committedValue,
            available: availableValue
          })
        }
      }
    } catch (error) {
      console.warn('Unable to load organization state yet', error)
    }
  }, [address, isConfigured, orgId, cofheReady, provider, signer])

  useEffect(() => {
    void loadOrganization()
  }, [loadOrganization])

  useEffect(() => {
    if (organization.treasuryAdapter && !adapterAddress) {
      setAdapterAddress(organization.treasuryAdapter)
    }

    if (organization.treasuryRouteId && organization.treasuryRouteId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      setTreasuryRoute(organization.treasuryRouteId)
    }
  }, [adapterAddress, organization.treasuryAdapter, organization.treasuryRouteId])

  const initializeCofhe = async () => {
    if (!signer) {
      toast.error('Connect the admin wallet from the top navigation first.')
      return
    }

    try {
      const provider = (window as any).ethereum || signer.provider
      await initCofhe(provider)
      setCofheReady(true)
      toast.success('CoFHE encryption initialized for this admin wallet.')
      await loadOrganization()
    } catch (error: any) {
      toast.error(error?.message || 'Unable to initialize CoFHE.')
    }
  }

  const withTransaction = async (work: () => Promise<void>) => {
    setIsBusy(true)

    try {
      await work()
      await loadOrganization()
    } catch (error: any) {
      console.error(error)
      toast.error(error?.reason || error?.message || 'Transaction failed.')
    } finally {
      setIsBusy(false)
    }
  }

  const createOrganization = async () => {
    if (!signer || !isConfigured) {
      toast.error('Connect a wallet and confirm the deployed contract address first.')
      return
    }

    await withTransaction(async () => {
      const contract = getCipherRollContract(signer)
      const tx = await contract.createOrganization(
        orgId,
        makeDeterministicLabel('workspace', workspaceName.trim() || 'CipherRoll Core'),
        3,
        2
      )
      await tx.wait()
      toast.success('CipherRoll workspace created on-chain.')
    })
  }

  const configureTreasury = async () => {
    if (!signer || !isConfigured) {
      toast.error('Connect a wallet and confirm the deployed contract address first.')
      return
    }

    const nextAdapter = safeAddress(adapterAddress)

    if (!nextAdapter) {
      toast.error('Enter a valid treasury adapter address.')
      return
    }

    await withTransaction(async () => {
      const contract = getCipherRollContract(signer)
      const tx = await contract.configureTreasury(
        orgId,
        nextAdapter,
        toBytes32Label(treasuryRoute)
      )
      await tx.wait()
      toast.success('Treasury adapter configured.')
    })
  }

  const depositBudget = async () => {
    if (!signer || !isConfigured) {
      toast.error('Connect a wallet and confirm the deployed contract address first.')
      return
    }

    const amount = Number.parseFloat(budgetAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a positive number for the budget.')
      return
    }

    const amountInWei = BigInt(Math.floor(amount * 1e18))

    await withTransaction(async () => {
      const contract = getCipherRollContract(signer)
      const encryptedAmount = await encryptUint128(amountInWei)

      const tx = await contract.depositBudget(orgId, encryptedAmount)
      await tx.wait()
      toast.success('Encrypted payroll budget increased.')
    })
  }

  const issuePayroll = async () => {
    if (!signer || !isConfigured) {
      toast.error('Connect a wallet and confirm the deployed contract address first.')
      return
    }

    const employee = safeAddress(employeeAddress)
    const amount = Number.parseFloat(paymentAmount)

    if (!employee) {
      toast.error('Enter a valid employee wallet address.')
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a positive payroll amount in Sepolia ETH.')
      return
    }

    const amountInWei = BigInt(Math.floor(amount * 1e18))
    const paymentId = makeDeterministicLabel('payment', `${employee}:${Date.now()}`)
    const memoHash = makeDeterministicLabel('memo', paymentMemo.trim() || 'cipherroll-wave1')

    await withTransaction(async () => {
      const contract = getCipherRollContract(signer)
      const encryptedAmount = await encryptUint128(amountInWei)

      const tx = await contract.issueConfidentialPayroll(
        orgId,
        employee,
        encryptedAmount,
        paymentId,
        memoHash
      )
      await tx.wait()
      toast.success('Confidential payroll allocation issued.')
    })
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
    }
  ]

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
            Run the core protocol lifecycle with a streamlined operator surface: create workspaces, allocate budgets, and securely issue encrypted employee salaries manually over Fhenix.
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
                    disabled={!signer || isBusy}
                    className="rounded-2xl bg-white text-black px-5 py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                  >
                    Initialize CoFHE
                  </button>
                  <button
                    onClick={() => void loadOrganization()}
                    disabled={!provider}
                    className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    Refresh State
                  </button>
                </div>

                <div className="mt-6 rounded-2xl border border-cyan-400/15 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                  Live Sepolia payroll contract: <span className="font-mono break-all">{CONTRACT_ADDRESS || 'Not configured'}</span>
                </div>
              </GlassCard>

              <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                  <h2 className="text-xl font-bold text-white">Ethereum Sepolia Readiness</h2>
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
                      Admin-only aggregate state with optional permit-based unsealing.
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  {summaryCards.map((item) => (
                    <div key={item.label} className="relative rounded-2xl border border-white/10 bg-white/5 p-6 overflow-hidden">
                      <div className="flex justify-between items-center mb-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/55 font-bold">{item.label}</p>
                        {item.value ? (
                          <div className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Unsealed</div>
                        ) : (
                          <div className="bg-white/10 text-white/50 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Locked</div>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-4xl font-black text-white">{item.value ?? '***'}</p>
                        {item.value && <span className="text-sm text-white/50 font-semibold">ETH</span>}
                      </div>
                      <p className="text-[10px] text-[#8e8e95] mt-4 font-mono truncate" title={String(item.handle)}>Handle: {item.handle ? "Sealed (Hidden)" : "Not Created"}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
                <div className="flex items-center gap-3 mb-4">
                  <Building2 className="w-5 h-5 text-cyan-300" />
                  <h2 className="text-xl font-bold text-white">Workspace snapshot</h2>
                </div>

                <div className="grid md:grid-cols-2 gap-4 text-sm">
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
                    <p className="text-white/55 uppercase tracking-[0.18em] text-xs font-bold mb-2">Treasury route</p>
                    <p className="font-mono text-white">{formatBytes32Preview(organization.treasuryRouteId)}</p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                  CipherRoll is live on the Sepolia Network using Fhenix&apos;s CoFHE Coprocessor. Organizational state remains perfectly encrypted on the L1 host.
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
                  disabled={!signer || isBusy}
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
            </GlassCard>

            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <Cable className="w-5 h-5 text-cyan-300" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Treasury adapter</h2>
                  <p className="text-sm text-[#a1a1aa] mt-2">
                    Optional bridge integration. Keep it available without blocking the main confidental payroll flow.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <input
                  value={adapterAddress}
                  onChange={(event) => setAdapterAddress(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                  placeholder="0xTreasuryAdapter"
                />
                <input
                  value={treasuryRoute}
                  onChange={(event) => setTreasuryRoute(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                  placeholder="wave1-privara-route"
                />
                <button
                  onClick={configureTreasury}
                  disabled={!signer || !organization.exists || isBusy}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                >
                  Configure Adapter
                </button>
              </div>
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
                    Budget amounts are accepted as plain integers, then encrypted client-side by cofhejs before touching the blockchain.
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
                  disabled={!signer || !organization.exists || isBusy}
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
                          <div className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Unsealed</div>
                        ) : (
                          <div className="bg-white/10 text-white/50 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Locked</div>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-4xl font-black text-white">{item.value ?? '***'}</p>
                        {item.value && <span className="text-sm text-white/50 font-semibold">ETH</span>}
                      </div>
                      <p className="text-[10px] text-[#8e8e95] mt-4 font-mono truncate" title={String(item.handle)}>Handle: {item.handle ? "Sealed (Hidden)" : "Not Created"}</p>
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
                  placeholder="3.5 (Sepolia ETH)"
                />
                <input
                  value={paymentMemo}
                  onChange={(event) => setPaymentMemo(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                  placeholder="March payroll"
                />
                <button
                  onClick={issuePayroll}
                  disabled={!signer || !organization.exists || isBusy}
                  className="w-full rounded-2xl bg-white text-black px-4 py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                >
                  Issue Confidential Payroll
                </button>
              </div>
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
                  { label: 'Employee wallet address is valid', complete: Boolean(safeAddress(employeeAddress)) }
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
                The employee must later connect the same wallet on the employee portal and generate a permit to inspect the confidential allocation handle.
              </div>
            </GlassCard>
          </div>
        )}

        {activePortal === 'treasury' && (
          <div className="grid lg:grid-cols-[0.95fr,1.05fr] gap-8 mt-8">
            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <Cable className="w-5 h-5 text-cyan-300" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Treasury boundary</h2>
                  <p className="text-sm text-[#a1a1aa] mt-2">
                    CipherRoll secures the adapter boundary on-chain permanently, staging for full autonomous Privara-powered settlement capabilities.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <input
                  value={adapterAddress}
                  onChange={(event) => setAdapterAddress(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                  placeholder="0xTreasuryAdapter"
                />
                <input
                  value={treasuryRoute}
                  onChange={(event) => setTreasuryRoute(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                  placeholder="wave1-privara-route"
                />
                <button
                  onClick={configureTreasury}
                  disabled={!signer || !organization.exists || isBusy}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                >
                  Configure Adapter
                </button>
              </div>
            </GlassCard>

            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="w-5 h-5 text-emerald-300" />
                <h2 className="text-xl font-bold text-white">Treasury state</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/55 uppercase tracking-[0.18em] text-xs font-bold mb-2">Configured adapter</p>
                  <p className="font-mono text-white break-all">
                    {organization.treasuryAdapter || 'Not configured'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/55 uppercase tracking-[0.18em] text-xs font-bold mb-2">Treasury route</p>
                  <p className="font-mono text-white">{formatBytes32Preview(organization.treasuryRouteId)}</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                Keep this portal available as a reference. The main execution path remains Workspace → Add Budget → Issue Employee Payroll.
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
                    { step: "02", title: "Setup Workspace", desc: "Define your Organization ID and Treasury Route in the Workspace tab.", icon: Building2 },
                    { step: "03", title: "Add Budget", desc: "Deposit funds into the encrypted treasury. All amounts are hidden locally.", icon: FolderCog },
                    { step: "04", title: "Execute Payroll", desc: "Issue confidential salary payouts to individual employee addresses.", icon: ShieldCheck },
                    { step: "05", title: "View Insights", desc: "Safely decrypt and view your budget health via the reveal button.", icon: Wallet }
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
