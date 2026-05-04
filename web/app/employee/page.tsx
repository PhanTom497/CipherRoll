'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  Wallet
} from 'lucide-react'
import { toast } from 'sonner'
import GlassCard from '@/components/GlassCard'
import NetworkStatus from '@/components/NetworkStatus'
import { WalletConnectButton } from '@/components/WalletConnectButton'
import { useCipherRollWallet } from '@/components/EvmWalletProvider'
import { formatHandle, getCipherRollContract } from '@/lib/cipherroll-client'
import {
  DEFAULT_ORG_ID,
  TARGET_CHAIN_ID,
  TARGET_CHAIN_NAME,
  toBytes32Label
} from '@/lib/cipherroll-config'
import {
  decryptUint64ForTxWithoutPermit,
  decryptUint128ForTx,
  decryptUint128ForView,
  getOrCreateSelfPermit,
  initCofhe
} from '@/lib/fhenix-permits'
import { extractCipherRollErrorMessage } from '@/lib/admin-portal-utils'
import type { EmployeePayrollView } from '@/lib/cipherroll-types'

type EmployeeStatusTone = 'neutral' | 'info' | 'success' | 'error'

type EmployeeStatus = {
  tone: EmployeeStatusTone
  title: string
  detail: string
}

const statusStyles: Record<EmployeeStatusTone, string> = {
  neutral: 'border-white/10 bg-white/5 text-white/80',
  info: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-50',
  success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-50',
  error: 'border-rose-400/20 bg-rose-400/10 text-rose-50'
}

function formatAmount(value: string | null) {
  if (!value) return '***'
  return value
}

function toLocalDateTime(timestamp: number) {
  if (!timestamp) return 'Not scheduled'
  return new Date(timestamp * 1000).toLocaleString()
}

function describeAllocationState(allocation: EmployeePayrollView) {
  if (allocation.settlementRequestId) {
    return {
      badge: 'Finalize payout',
      tone: 'info' as const,
      detail: 'Your confidential payroll claim was requested. Finalize the wrapper payout to release the underlying settlement token to your wallet.'
    }
  }

  if (allocation.payrollRunStatus !== null && allocation.payrollRunStatus < 2) {
    if (allocation.payrollRunStatus === 0) {
      return {
        badge: 'Draft',
        tone: 'info' as const,
        detail: 'This payroll item is still being prepared. The employer has not funded and activated the payroll run yet.'
      }
    }

    return {
      badge: 'Awaiting activation',
      tone: 'info' as const,
      detail: 'This payroll item is funded, but the employer has not opened the claim window yet.'
    }
  }

  if (allocation.isClaimed) {
    return {
      badge: 'Claimed',
      tone: 'success' as const,
      detail: 'This payroll item was already claimed on-chain.'
    }
  }

  if (allocation.isVesting) {
    const now = Math.floor(Date.now() / 1000)
    if (now < allocation.vestingStart) {
      return {
        badge: 'Scheduled',
        tone: 'info' as const,
        detail: `This vesting payroll unlocks on ${toLocalDateTime(allocation.vestingEnd)}.`
      }
    }

    if (now < allocation.vestingEnd) {
      return {
        badge: 'Vesting',
        tone: 'info' as const,
        detail: `This payroll stays locked until ${toLocalDateTime(allocation.vestingEnd)}.`
      }
    }

    return {
      badge: 'Claim ready',
      tone: 'success' as const,
      detail: 'This vesting payroll can now be claimed.'
    }
  }

  return {
    badge: 'Available',
    tone: 'success' as const,
    detail: 'This payroll item is available for immediate claim.'
  }
}

export default function EmployeePage() {
  const { address, provider, signer, chainId } = useCipherRollWallet()
  const [orgIdInput, setOrgIdInput] = useState(DEFAULT_ORG_ID)
  const [cofheReady, setCofheReady] = useState(false)
  const [allocations, setAllocations] = useState<EmployeePayrollView[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [claimingPaymentId, setClaimingPaymentId] = useState<string | null>(null)
  const [status, setStatus] = useState<EmployeeStatus>({
    tone: 'neutral',
    title: 'Waiting for employee access',
    detail: `Connect your wallet, switch to ${TARGET_CHAIN_NAME}, then enable privacy mode to load your payroll items.`
  })

  const orgId = useMemo(() => toBytes32Label(orgIdInput), [orgIdInput])
  const isTargetChain = chainId === TARGET_CHAIN_ID

  useEffect(() => {
    setCofheReady(false)
    setAllocations([])
  }, [address, chainId])

  const initializeCofhe = async () => {
    if (!signer) {
      toast.error('Connect the employee wallet first.')
      return
    }

    if (!isTargetChain) {
      toast.error(`Switch to ${TARGET_CHAIN_NAME} before enabling privacy mode.`)
      return
    }

    setStatus({
      tone: 'info',
      title: 'Enabling privacy mode',
      detail: 'Approve the wallet prompts so CipherRoll can decrypt your payroll details privately in the browser.'
    })

    try {
      await initCofhe((window as any).ethereum || signer.provider)
      await getOrCreateSelfPermit()
      setCofheReady(true)
      setStatus({
        tone: 'success',
        title: 'Privacy mode ready',
        detail: 'Your wallet can now fetch and decrypt payroll items for this workspace.'
      })
      toast.success('Privacy mode is ready for this wallet.')
    } catch (error: any) {
      const message = error?.message || 'Unable to enable privacy mode.'
      setStatus({
        tone: 'error',
        title: 'Privacy mode failed',
        detail: message
      })
      toast.error(message)
    }
  }

  const loadAllocations = useCallback(async () => {
    if (!provider || !address) {
      toast.error('Connect the employee wallet first.')
      return
    }

    if (!isTargetChain) {
      toast.error(`Switch to ${TARGET_CHAIN_NAME} before refreshing payroll.`)
      return
    }

    if (!cofheReady) {
      toast.error('Enable privacy mode before refreshing payroll.')
      return
    }

    setIsLoading(true)
    setStatus({
      tone: 'info',
      title: 'Refreshing payroll',
      detail: 'Loading your encrypted payroll items and checking whether each one is ready to claim.'
    })

    try {
      const contract = getCipherRollContract(signer ?? provider)
      const permit = await getOrCreateSelfPermit()
      const result = await contract.getEmployeeAllocations(orgId, address)
      const treasury = await contract.getTreasuryAdapterDetails(orgId)

      const nextAllocations = await Promise.all(
        result.paymentIds.map(async (paymentId: string, index: number) => {
          const [meta, isClaimed, amount, payrollRunId, settlementRequest] = await Promise.all([
            contract.getPayrollAllocationMeta(paymentId),
            contract.isPayrollClaimed(paymentId),
            decryptUint128ForView(result.amounts[index], permit),
            contract.getPayrollRunForPayment(paymentId),
            contract.getPayrollSettlementRequest(paymentId)
          ])

          const payrollRun = payrollRunId ? await contract.getPayrollRun(payrollRunId) : null

          return {
            paymentId,
            memoHash: result.memoHashes[index],
            createdAt: result.createdAts[index],
            amount,
            handle: result.amounts[index],
            isClaimed,
            isVesting: meta.isVesting,
            vestingStart: meta.vestingStart,
            vestingEnd: meta.vestingEnd,
            payrollRunId,
            payrollRunStatus: payrollRun ? payrollRun.status : null,
            settlementRequestId: settlementRequest.exists ? settlementRequest.requestId : null,
            settlementRequestedAt: settlementRequest.exists ? settlementRequest.requestedAt : null,
            settlementPayoutAsset: settlementRequest.exists ? settlementRequest.payoutAsset : treasury.settlementAsset,
            confidentialSettlementAsset: settlementRequest.exists
              ? settlementRequest.confidentialAsset
              : treasury.confidentialSettlementAsset
          } satisfies EmployeePayrollView
        })
      )

      setAllocations(nextAllocations)

      if (nextAllocations.length === 0) {
        setStatus({
          tone: 'info',
          title: 'No payroll items found',
          detail: 'Nothing is assigned to this wallet for the current workspace yet.'
        })
      } else {
        const readyCount = nextAllocations.filter((item) => !item.isClaimed).length
        setStatus({
          tone: 'success',
          title: 'Payroll loaded successfully',
          detail: `${nextAllocations.length} payroll item(s) were loaded. ${readyCount} still require employee action or review.`
        })
      }
    } catch (error: any) {
      console.error(error)
      const message = error?.reason || error?.message || 'Unable to load employee allocations.'
      setStatus({
        tone: 'error',
        title: 'Payroll refresh failed',
        detail: message
      })
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [address, cofheReady, isTargetChain, orgId, provider, signer])

  useEffect(() => {
    if (address && cofheReady && isTargetChain) {
      void loadAllocations()
    }
  }, [address, cofheReady, isTargetChain, loadAllocations])

  const claimPayroll = async (allocation: EmployeePayrollView) => {
    if (!signer || !address) {
      toast.error('Connect the employee wallet first.')
      return
    }

    setClaimingPaymentId(allocation.paymentId)

    try {
      const contract = getCipherRollContract(signer)
      const treasury = await contract.getTreasuryAdapterDetails(orgId)
      const hasSettlementAsset =
        treasury.adapter &&
        treasury.adapter !== '0x0000000000000000000000000000000000000000' &&
        treasury.settlementAsset &&
        treasury.settlementAsset !== '0x0000000000000000000000000000000000000000'

      const tx = hasSettlementAsset
        ? treasury.supportsConfidentialSettlement
          ? allocation.settlementRequestId
            ? await (async () => {
                const decryptResult = await decryptUint64ForTxWithoutPermit(
                  allocation.settlementRequestId as `0x${string}`
                )
                if (!decryptResult) {
                  throw new Error('CipherRoll could not prepare the wrapper claim proof for this payroll item.')
                }

                return contract.finalizePayrollSettlement(
                  orgId,
                  allocation.paymentId,
                  decryptResult.decryptedValue,
                  decryptResult.signature
                )
              })()
            : await (async () => {
                const decryptResult = await decryptUint128ForTx(allocation.handle)
                if (!decryptResult) {
                  throw new Error('CipherRoll could not prepare the settlement proof for this payroll item.')
                }

                return contract.requestPayrollSettlement(
                  orgId,
                  allocation.paymentId,
                  decryptResult.decryptedValue,
                  decryptResult.signature
                )
              })()
          : await (async () => {
            const decryptResult = await decryptUint128ForTx(allocation.handle)
            if (!decryptResult) {
              throw new Error('CipherRoll could not prepare the settlement proof for this payroll item.')
            }

            return contract.claimPayrollWithSettlement(
              orgId,
              allocation.paymentId,
              decryptResult.decryptedValue,
              decryptResult.signature
            )
          })()
        : await contract.claimPayroll(orgId, allocation.paymentId)

      setStatus({
        tone: 'info',
        title: 'Claim submitted',
        detail: hasSettlementAsset
          ? treasury.supportsConfidentialSettlement
              ? allocation.settlementRequestId
                ? 'The wallet sent your wrapper claim finalization to the network. Waiting for confirmation...'
              : 'The wallet requested a confidential wrapper payout. Once confirmed, finalize the wrapper claim. That on-chain proof step can reveal the amount before the underlying settlement token is released.'
            : 'The wallet sent your claim and token-settlement proof to the network. Waiting for confirmation...'
          : 'The wallet sent your claim to the network. Waiting for confirmation...'
      })
      await tx.wait()
      toast.success(
        hasSettlementAsset
          ? treasury.supportsConfidentialSettlement
            ? allocation.settlementRequestId
              ? 'Wrapper payout finalized and the underlying settlement token was released on-chain.'
              : 'Confidential wrapper payout requested. One final wallet step is still needed to release the underlying settlement token.'
            : 'Payroll claim confirmed and settlement tokens released on-chain.'
          : 'Payroll claim confirmed on-chain.'
      )
      await loadAllocations()
    } catch (error: any) {
      const message = extractCipherRollErrorMessage(error?.reason || error?.message || error)
      setStatus({
        tone: 'error',
        title: 'Claim failed',
        detail: message
      })
      toast.error(message)
    } finally {
      setClaimingPaymentId(null)
    }
  }

  return (
    <main className="min-h-screen relative z-10 font-sans text-gray-100 bg-black selection:bg-white/20 pt-32">
      <div
        className="fixed inset-0 z-0 bg-[length:800px] md:bg-[length:1800px] bg-left bg-no-repeat bg-fixed opacity-40"
        style={{ backgroundImage: "url('/assets/milad-fakurian-7W3X1dAuKqg-unsplash.jpg')" }}
      />
      <div className="fixed inset-0 z-0 bg-black/60 backdrop-blur-[2px]" />

      <div className="w-full max-w-6xl mx-auto px-6 pb-20 relative z-10">
        <div className="mb-12 border-b border-white/5 pb-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 text-cyan-300 text-xs font-bold tracking-widest uppercase mb-4">
            Employee Self-Service
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white mb-2">Employee Portal</h1>
        </div>

        <NetworkStatus />

        <div className="rounded-3xl border border-white/5 bg-[#0a0a0a] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">{status.title}</h2>
              <p className="mt-2 text-sm text-[#c9c9d0]">{status.detail}</p>
            </div>
            <button
              onClick={() => void loadAllocations()}
              disabled={!address || isLoading}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              {isLoading ? 'Refreshing...' : 'Refresh Payroll'}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[0.82fr,1.18fr] gap-8 mt-8">
          <div className="space-y-6">
            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <Wallet className="w-5 h-5 text-cyan-300" />
                <h2 className="text-xl font-bold text-white">Access</h2>
              </div>

              <div className="space-y-3">
                <WalletConnectButton />
                <input
                  value={orgIdInput}
                  onChange={(event) => setOrgIdInput(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                  placeholder="Workspace id"
                />
                <button
                  onClick={initializeCofhe}
                  disabled={!signer || !isTargetChain}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                >
                  Enable Privacy Mode
                </button>
              </div>
            </GlassCard>
          </div>

          <div className="space-y-6">
            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center justify-between gap-4 mb-6">
                <h2 className="text-xl font-bold text-white">Your payroll</h2>
              </div>

              {allocations.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-black/30 p-10 text-center">
                  <Eye className="w-10 h-10 mx-auto text-white/20 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">No payroll items yet</h3>
                  <p className="text-sm text-[#a1a1aa] max-w-md mx-auto">
                    Ask the admin to issue payroll for this wallet, then refresh again after privacy mode is enabled.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {allocations.map((allocation) => {
                    const descriptor = describeAllocationState(allocation)
                    const runClaimOpen = allocation.payrollRunStatus === null || allocation.payrollRunStatus === 2
                    const needsFinalizeSettlement = Boolean(allocation.settlementRequestId)
                    const canClaim =
                      runClaimOpen &&
                      !allocation.isClaimed &&
                      (
                        needsFinalizeSettlement ||
                        !allocation.isVesting ||
                        Math.floor(Date.now() / 1000) >= allocation.vestingEnd
                      )
                    const payrollRunStatusLabel = allocation.payrollRunStatus === null
                      ? 'Legacy direct allocation'
                      : ['Draft', 'Funded', 'Active', 'Finalized'][allocation.payrollRunStatus] ?? 'Unknown'

                    return (
                      <div key={allocation.paymentId} className="rounded-3xl border border-white/10 bg-white/5 p-6 overflow-hidden">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-cyan-400 font-bold mb-2">Incoming Payroll</p>
                            <p className="text-white font-medium text-lg">
                              Issued {allocation.createdAt ? new Date(allocation.createdAt * 1000).toLocaleDateString() : 'Unknown date'}
                            </p>
                            <p className="mt-2 text-sm text-[#a1a1aa]">{descriptor.badge}</p>
                          </div>

                          <div className="text-left lg:text-right">
                            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                              descriptor.tone === 'success'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-cyan-500/20 text-cyan-200'
                            }`}>
                              {descriptor.tone === 'success' ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                              {descriptor.badge}
                            </div>
                            <div className="mt-3 flex items-baseline gap-1 justify-start lg:justify-end">
                              <p className="text-4xl font-black text-white">{formatAmount(allocation.amount)}</p>
                              {allocation.amount && <span className="text-white/50 font-semibold">tokens</span>}
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 grid gap-3 md:grid-cols-2 text-sm">
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-white/50 uppercase tracking-[0.16em] text-[11px] font-bold mb-2">Run</p>
                            <p className="text-white">{payrollRunStatusLabel}</p>
                            <p className="mt-2 text-xs text-white/45 font-mono">
                              {allocation.payrollRunId ? allocation.payrollRunId.slice(0, 12) : 'Direct workspace issuance'}
                              {allocation.payrollRunId ? '...' : ''}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-white/50 uppercase tracking-[0.16em] text-[11px] font-bold mb-2">Unlock</p>
                            <p className="text-white">
                              {allocation.isVesting
                                ? `${toLocalDateTime(allocation.vestingStart)} to ${toLocalDateTime(allocation.vestingEnd)}`
                                : 'Immediate payout'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm">
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-white/50 uppercase tracking-[0.16em] text-[11px] font-bold mb-2">Claim state</p>
                            <p className="text-white">
                              {allocation.isClaimed
                                ? 'Claim already submitted'
                                : needsFinalizeSettlement
                                  ? 'Wrapper payout requested'
                                : !runClaimOpen
                                  ? 'Waiting for employer activation'
                                  : canClaim
                                    ? 'Ready to claim now'
                                    : 'Waiting for unlock'}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-white/50 uppercase tracking-[0.16em] text-[11px] font-bold mb-2">Next</p>
                            <p className="text-white">
                              {!runClaimOpen
                                ? 'The employer still needs to fund and activate this payroll run.'
                                : allocation.isClaimed
                                  ? 'This item is complete for your wallet.'
                                  : needsFinalizeSettlement
                                    ? 'Finalize the wrapper claim now. That on-chain proof step can reveal the amount before the underlying settlement token reaches your wallet.'
                                  : canClaim
                                    ? 'You can submit the claim transaction now.'
                                    : 'This item will become claimable after its vesting window ends.'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="grid gap-2 text-xs text-white/40 font-mono">
                            <div><span className="text-white/30 mr-2">MEMO:</span>{allocation.memoHash.slice(0, 10)}...</div>
                            <div><span className="text-white/30 mr-2">HANDLE:</span>{allocation.handle ? formatHandle(allocation.handle) : 'Not Created'}</div>
                          </div>
                          <button
                            onClick={() => void claimPayroll(allocation)}
                            disabled={!canClaim || claimingPaymentId === allocation.paymentId}
                            className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
                          >
                            {claimingPaymentId === allocation.paymentId
                              ? 'Submitting...'
                              : allocation.isClaimed
                                ? 'Already Claimed'
                                : needsFinalizeSettlement
                                  ? 'Finalize Payout'
                                  : 'Claim Payroll'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </div>
    </main>
  )
}
