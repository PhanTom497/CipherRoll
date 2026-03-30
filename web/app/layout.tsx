import type { Metadata } from 'next'
import './globals.css'
import dynamic from 'next/dynamic'
import ReactQueryProvider from '@/components/ReactQueryProvider'
import { Toaster } from "@/components/ui/sonner"
import GlobalNav from '@/components/GlobalNav'

export const metadata: Metadata = {
    title: 'CipherRoll',
    description: 'Confidential payroll and treasury operations on Fhenix',
}

const EvmWalletProvider = dynamic(
    () => import('@/components/EvmWalletProvider'),
    { ssr: false }
)

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body>
                <ReactQueryProvider>
                    <EvmWalletProvider>
                        <GlobalNav />
                        {children}
                        <Toaster />
                    </EvmWalletProvider>
                </ReactQueryProvider>
            </body>
        </html>
    )
}
