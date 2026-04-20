'use client';

import { useState, useEffect } from 'react';
import { Signal } from 'lucide-react';
import { useCipherRollWallet } from './EvmWalletProvider';
import {
    SUPPORTED_CHAIN_IDS,
    TARGET_CHAIN_ID,
    TARGET_CHAIN_NAME
} from '@/lib/cipherroll-config';

export default function NetworkStatus() {
    const [currentHeight, setCurrentHeight] = useState<number>(0);
    const { provider, chainId } = useCipherRollWallet();
    const isSupportedChain = chainId ? SUPPORTED_CHAIN_IDS.includes(chainId) : false;
    const isTargetChain = chainId === TARGET_CHAIN_ID;
    const accentClass = isTargetChain ? 'bg-green-500' : isSupportedChain ? 'bg-amber-400' : 'bg-red-400';
    const textClass = isTargetChain ? 'text-green-400' : isSupportedChain ? 'text-amber-300' : 'text-red-300';

    useEffect(() => {
        const updateHeight = async () => {
            try {
                if (!provider) return;
                const block = await provider.getBlockNumber();
                if (block > 0) setCurrentHeight(block);
            } catch (e) {
                console.error("Failed to fetch block height", e);
            }
        };
        updateHeight();
        const interval = setInterval(updateHeight, 10000);
        return () => clearInterval(interval);
    }, [provider]);

    return (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-3 bg-black/80 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 shadow-2xl transition-all hover:bg-black/90 cursor-default">
            <div className="flex items-center gap-2">
                <div className="relative flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${accentClass} opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${accentClass}`}></span>
                </div>
                <span className="text-xs uppercase tracking-widest font-bold text-white/80">
                    {TARGET_CHAIN_NAME}
                </span>
            </div>
            <div className="w-px h-4 bg-white/20" />
            <div className={`flex items-center gap-1.5 font-mono text-xs ${textClass}`}>
                <Signal className="w-3.5 h-3.5" />
                {currentHeight > 0
                    ? `#${currentHeight}`
                    : chainId
                      ? `chain:${chainId}`
                      : `target:${TARGET_CHAIN_NAME}`}
            </div>
        </div>
    );
}
