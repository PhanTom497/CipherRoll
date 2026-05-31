'use client';

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletConnectButton } from "@/components/WalletConnectButton";

export default function GlobalNav() {
    const pathname = usePathname();
    const links = [
        { name: 'Admin', path: '/admin' },
        { name: 'Employee', path: '/employee' },
        { name: 'Auditor', path: '/auditor' },
        { name: 'Compliance', path: '/tax-authority' },
        { name: 'Docs', path: '/docs' }
    ];

    return (
        <nav className="fixed top-4 left-0 right-0 z-[50] px-6 flex justify-center pointer-events-none">
            <div className="flex items-center justify-between bg-[#0a0a0a]/80 border border-white/10 rounded-full px-3 py-3 backdrop-blur-xl pointer-events-auto w-full max-w-5xl gap-6 shadow-2xl">
                <Link href="/" className="flex items-center gap-2.5 text-white flex-shrink-0 pl-4">
                    <span className="relative h-7 w-7 flex-shrink-0 overflow-hidden rounded-full">
                        <Image
                            src="/cipherroll-logo.png"
                            alt="CipherRoll logo"
                            fill
                            sizes="28px"
                            className="object-cover scale-[1.06]"
                            priority
                        />
                    </span>
                    <span className="text-[17px] font-bold tracking-tight leading-none">
                        CipherRoll.
                    </span>
                </Link>

                <div className="hidden md:flex items-center gap-6">
                    {links.map((link) => {
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
                </div>

                {/* Action Button */}
                <div className="flex-shrink-0">
                    <WalletConnectButton />
                </div>
            </div>
        </nav>
    );
}
