'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletConnectButton } from "@/components/WalletConnectButton";

export default function GlobalNav() {
    const pathname = usePathname();
    const primaryLinks = [
        { name: 'Admin', path: '/admin' },
        { name: 'Employee', path: '/employee' },
        { name: 'Docs', path: '/docs' }
    ];
    const statusLinks = [
        { name: 'Auditor Status', path: '/auditor' },
        { name: 'Tax Status', path: '/tax-authority' }
    ];

    return (
        <nav className="fixed top-4 left-0 right-0 z-[50] px-6 flex justify-center pointer-events-none">
            <div className="flex items-center justify-between bg-[#0a0a0a]/80 border border-white/10 rounded-full px-3 py-3 backdrop-blur-xl pointer-events-auto w-full max-w-5xl gap-6 shadow-2xl">
                {/* Logo */}
                <Link href="/" className="text-[17px] font-bold tracking-tight text-white flex-shrink-0 pl-5">
                    CipherRoll.
                </Link>

                {/* Centered Links */}
                <div className="hidden md:flex items-center gap-6">
                    {primaryLinks.map((link) => {
                        const isActive = pathname.startsWith(link.path);
                        return (
                            <Link 
                                key={link.name}
                                href={link.path} 
                                className={`text-[13px] font-medium transition-colors ${
                                    isActive ? 'text-white' : 'text-white/60 hover:text-white'
                                }`}
                            >
                                {link.name}
                            </Link>
                        );
                    })}
                    <div className="flex items-center gap-3 pl-1">
                        {statusLinks.map((link) => {
                            const isActive = pathname.startsWith(link.path);
                            return (
                                <Link
                                    key={link.name}
                                    href={link.path}
                                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                                        isActive
                                            ? 'border-cyan-300/50 text-cyan-200'
                                            : 'border-white/10 text-white/45 hover:border-white/20 hover:text-white/70'
                                    }`}
                                >
                                    {link.name}
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* Action Button */}
                <div className="flex-shrink-0">
                    <WalletConnectButton />
                </div>
            </div>
        </nav>
    );
}
