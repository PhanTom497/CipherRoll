'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCipherRollWallet } from './EvmWalletProvider'
import { extractCipherRollErrorMessage } from '@/lib/admin-portal-utils'

export const WalletConnectButton = () => {
    const { address, disconnect, isConnecting, connect, isInstalled } = useCipherRollWallet()

    // Prevent SSR hydration mismatch
    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        setMounted(true)
    }, [])

    const handleConnect = async () => {
        try {
            await connect()
        } catch (error) {
            toast.error(extractCipherRollErrorMessage(error))
        }
    }

    if (!mounted) {
        return (
            <button
                disabled
                className="glass-button bg-white text-black px-6 py-2 rounded-full font-semibold opacity-50 cursor-not-allowed"
            >
                Checking...
            </button>
        )
    }

    if (address) {
        return (
            <button
                onClick={() => disconnect()}
                className="group flex items-center gap-3 px-4 py-2 bg-glass border border-glass-border rounded-full hover:bg-glass-hover transition-all duration-300 backdrop-blur-md"
            >
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                <span className="font-mono text-sm text-gray-200 group-hover:text-white transition-colors">
                    {address.slice(0, 6)}...{address.slice(-4)}
                </span>
            </button>
        )
    }

    return (
        <button
            onClick={() => void handleConnect()}
            disabled={isConnecting || !isInstalled}
            className="glass-button bg-white text-black px-6 py-2 rounded-full font-semibold hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {!isInstalled ? 'Install Wallet' : isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
    )
}
