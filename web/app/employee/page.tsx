'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, Eye, FileLock2, KeyRound, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import GlassCard from '@/components/GlassCard'
import NetworkStatus from '@/components/NetworkStatus'
import { WalletConnectButton } from '@/components/WalletConnectButton'
import { useCipherRollWallet } from '@/components/EvmWalletProvider'
import { getCipherRollContract, formatHandle } from '@/lib/cipherroll-client'
import { DEFAULT_ORG_ID, toBytes32Label } from '@/lib/cipherroll-config'
import { initCofhe, unsealUint128 } from '@/lib/fhenix-permits'
import type { EmployeePayrollView } from '@/lib/cipherroll-types'

export default function EmployeePage() {
  const { address, provider, signer } = useCipherRollWallet()
  const [orgIdInput, setOrgIdInput] = useState(DEFAULT_ORG_ID)
  const [cofheReady, setCofheReady] = useState(false)
  const [allocations, setAllocations] = useState<EmployeePayrollView[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const orgId = useMemo(() => toBytes32Label(orgIdInput), [orgIdInput])

  const initializeCofhe = async () => {
    if (!signer) {
      toast.error('Connect the employee wallet first.')
      return
    }

    try {
      const provider = (window as any).ethereum || signer.provider
      await initCofhe(provider)
      setCofheReady(true)
      toast.success('CoFHE encryption initialized.')
    } catch (error: any) {
      toast.error(error?.message || 'Unable to initialize CoFHE.')
    }
  }

  const loadAllocations = useCallback(async () => {
    if (!provider || !address) {
      toast.error('Connect the employee wallet first.')
      return
    }

    setIsLoading(true)

    try {
      if (!cofheReady) {
        toast.error('Initialize CoFHE before refreshing allocations.')
        return
      }

      const contract = getCipherRollContract(signer ?? provider)
      const result = await contract.getEmployeeAllocations(orgId, address)

      const nextAllocations = await Promise.all(
        result.paymentIds.map(async (paymentId: string, index: number) => {
          const handle = result.amounts[index]
          const amount = await unsealUint128(handle)

          return {
            paymentId,
            memoHash: result.memoHashes[index],
            createdAt: result.createdAts[index],
            amount,
            handle
          } satisfies EmployeePayrollView
        })
      )

      setAllocations(nextAllocations)
    } catch (error: any) {
      console.error(error)
      toast.error(error?.reason || error?.message || 'Unable to load employee allocations.')
    } finally {
      setIsLoading(false)
    }
  }, [address, orgId, cofheReady, provider, signer])

  useEffect(() => {
    if (address && cofheReady) {
      void loadAllocations()
    }
  }, [address, cofheReady, loadAllocations])

  const downloadConfig = () => {
    if (!cofheReady) {
      toast.error('Initialize CoFHE first.')
      return
    }

    const blob = new Blob([JSON.stringify({ initialized: true, network: 'eth-sepolia' }, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'cipherroll-cofhe-config.json'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
    toast.success('Config bundle downloaded.')
  }

  return (
    <main className="min-h-screen relative z-10 font-sans text-gray-100 bg-black selection:bg-white/20 pt-32">
      <div
        className="fixed inset-0 z-0 bg-[length:800px] md:bg-[length:1800px] bg-left bg-no-repeat bg-fixed opacity-40"
        style={{ backgroundImage: "url('/assets/milad-fakurian-7W3X1dAuKqg-unsplash.jpg')" }}
      />
      <div className="fixed inset-0 z-0 bg-black/60 backdrop-blur-[2px]" />

      <div className="w-full max-w-6xl mx-auto px-6 pb-20 relative z-10">
        <div className="mb-12 border-b border-white/5 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 text-cyan-300 text-xs font-bold tracking-widest uppercase mb-4">
            Encrypted End-to-End
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-2">
            Confidential Employee View
          </h1>
          <p className="text-[#a1a1aa] text-lg max-w-3xl">
            Connect an EVM wallet to fetch your payroll ciphertext handles from Ethereum Sepolia and seamlessly decrypt them locally inside your browser using CoFHE.
          </p>
        </div>

        <NetworkStatus />

        <div className="grid lg:grid-cols-[0.9fr,1.1fr] gap-8">
          <div className="space-y-6">
            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <Wallet className="w-5 h-5 text-cyan-300" />
                <div>
                  <h2 className="text-xl font-bold text-white">Access</h2>
                  <p className="text-sm text-[#a1a1aa]">{`Your payroll is encrypted mathematically. Only your wallet's signature can trigger decryption.`}</p>
                </div>
              </div>
              <div className="space-y-3">
                <WalletConnectButton />
                <input
                  value={orgIdInput}
                  onChange={(event) => setOrgIdInput(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                  placeholder="Organization id"
                />
                <button
                  onClick={initializeCofhe}
                  disabled={!signer}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                >
                  Initialize CoFHE
                </button>
                <button
                  onClick={downloadConfig}
                  disabled={!cofheReady}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                >
                  Download Config Bundle
                </button>
              </div>
            </GlassCard>

            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                <FileLock2 className="w-5 h-5 text-cyan-300" />
                <h2 className="text-xl font-bold text-white">True Client-Side Privacy</h2>
              </div>
              <div className="space-y-3 text-sm text-[#c9c9d0] leading-relaxed">
                <p>Employees can view confidential payroll allocations issued by the admin perfectly hidden from the public execution layer.</p>
                <p>{`The CoFHE Coprocessor executes the decryption logic directly within the user's browser via a WASM module.`}</p>
                <p>This ensures no centralized backend or node operator ever intercepts your plaintext salary values.</p>
              </div>
            </GlassCard>
          </div>

          <div className="space-y-6">
            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Your payroll allocations</h2>
                  <p className="text-sm text-[#a1a1aa] mt-2">Make sure to initialize CoFHE first. The handles will be fetched from Sepolia and decrypted locally automatically.</p>
                </div>
                <button
                  onClick={() => loadAllocations()}
                  disabled={!address || isLoading}
                  className="rounded-2xl bg-white text-black px-4 py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                >
                  {isLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {allocations.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-black/30 p-10 text-center">
                  <Eye className="w-10 h-10 mx-auto text-white/20 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">No allocations visible yet</h3>
                  <p className="text-sm text-[#a1a1aa] max-w-md mx-auto">
                    Ask the admin to issue a confidential payroll allocation for this wallet, then refresh after creating a permit.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {allocations.map((allocation) => (
                    <div key={allocation.paymentId} className="relative rounded-3xl border border-white/10 bg-white/5 p-6 overflow-hidden">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400 font-bold mb-1">Incoming Payroll</p>
                          <p className="text-white font-medium text-lg">
                            {allocation.createdAt ? new Date(allocation.createdAt * 1000).toLocaleDateString() : 'Unknown Date'}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-2 mb-1">
                            {allocation.amount ? (
                               <div className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1"><Eye className="w-3 h-3"/> Unsealed</div>
                            ) : (
                               <div className="bg-white/10 text-white/50 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1"><FileLock2 className="w-3 h-3"/> Encrypted</div>
                            )}
                          </div>
                          <div className="flex items-baseline justify-end gap-1">
                            <p className="text-4xl font-black text-white">{allocation.amount ?? '***'}</p>
                            {allocation.amount && <span className="text-white/50 font-semibold">ETH</span>}
                          </div>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-4 text-xs text-white/40 font-mono">
                        <div><span className="text-white/30 mr-2">MEMO:</span>{allocation.memoHash.slice(0, 10)}...</div>
                        <div className="text-right"><span className="text-white/30 mr-2">HANDLE:</span>{allocation.handle ? formatHandle(BigInt(1)) : 'Not Created'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-8 border-white/5 bg-[#0a0a0a] rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                <KeyRound className="w-5 h-5 text-cyan-300" />
                <h2 className="text-xl font-bold text-white">The Zero-Knowledge Shift</h2>
              </div>
              <div className="space-y-3 text-sm text-[#c9c9d0] leading-relaxed">
                <p>Legacy zero-knowledge models demand employees scan disjointed, privately stored records across unindexed history.</p>
                <p>CipherRoll establishes a synchronized FHE state directly on-chain, eliminating the need to sync massive proofs.</p>
              </div>
              <Link href="/docs" className="inline-flex items-center gap-2 text-sm font-semibold text-white mt-6 underline underline-offset-4">
                Read the architecture notes
                <Download className="w-4 h-4" />
              </Link>
            </GlassCard>
          </div>
        </div>
      </div>
    </main>
  )
}
