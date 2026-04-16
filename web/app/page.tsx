'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, Users, Eye, Wallet, Lock, ArrowRight, ArrowUpRight, Play, Landmark } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import FeaturesScroll from "@/components/FeaturesScroll";
import { SUPPORTED_CHAIN_NAMES, TARGET_CHAIN_NAME } from "@/lib/cipherroll-config";

const title = "CipherRoll";
const tagline = "Private Payroll. Blind Execution.";
const description =
  `Experience the world's first FHE-native HR protocol. Run payroll with mathematically encrypted state on ${SUPPORTED_CHAIN_NAMES} using the official CoFHE coprocessor stack.`;

const portals = [
  {
    title: "Admin Portal",
    description:
      "Create a payroll workspace, fund encrypted budget balances, issue confidential payouts, and inspect encrypted budget summaries.",
    icon: Shield,
    url: "/admin"
  },
  {
    title: "Employee Portal",
    description:
      "Connect an EVM wallet, authenticate with CoFHE, and decrypt your own encrypted payroll allocations seamlessly on the client-side.",
    icon: Users,
    url: "/employee"
  },
  {
    title: "Auditor Status",
    description:
      "See the current product boundary for auditor access. This route explains what is not shipped yet and what selective-disclosure work remains.",
    icon: Eye,
    url: "/auditor"
  },
  {
    title: "Tax Status",
    description:
      "Review the roadmap status for tax authority and treasury settlement work without implying a live compliance portal.",
    icon: Landmark,
    url: "/tax-authority"
  }
];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const scrollRef = useScrollAnimation();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div ref={scrollRef} className="relative z-10 min-h-screen overflow-clip bg-black">
      <section className="min-h-screen flex items-center md:items-end px-6 md:px-12 lg:px-24 pb-24 relative z-10 pt-32 overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2, ease: "easeOut" }}
          className="absolute inset-0 z-[-1]"
        >
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover opacity-82"
            style={{ filter: "brightness(1.04) contrast(1.06) saturate(1.08)" }}
          >
            <source src="/assets/8733055-uhd_3840_2160_30fps.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/18 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/52 via-black/12 to-transparent pointer-events-none" />
        </motion.div>

        <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-end justify-between gap-12 pt-8 md:pt-12">
          <div className="max-w-3xl text-left">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.9, ease: "easeOut" }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 mb-6"
            >
              <span className="h-2 w-2 rounded-full bg-white" />
              <span className="text-[11px] md:text-xs uppercase tracking-[0.22em] text-white/70 font-semibold">
                FHE-Native Payroll
              </span>
              <span className="hidden md:block text-white/25">•</span>
              <span className="hidden md:block text-[11px] md:text-xs uppercase tracking-[0.18em] text-white/45 font-medium">
                Powered by CoFHE Coprocessor
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 1, ease: "easeOut" }}
              className="max-w-4xl text-[40px] leading-[0.98] md:text-[56px] lg:text-[68px] font-semibold tracking-[-0.04em] mb-6 text-white"
            >
              Private Payroll.
              <br />
              Blind Execution.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 1, ease: "easeOut" }}
              className="text-[16px] md:text-[17px] text-[#b4b4bc] mb-10 max-w-[620px] leading-[1.8] font-normal"
            >
              {description}
            </motion.p>

            <div className="flex flex-wrap items-center gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.8, ease: "easeOut" }}
              >
                <Link href="/admin" className="flex items-center gap-3 bg-white text-black pl-5 pr-1.5 py-1.5 rounded-full font-medium hover:bg-white/90 transition-colors text-sm">
                  Open Portal
                  <div className="bg-black text-white rounded-full p-2 flex items-center justify-center">
                    <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5, duration: 0.8, ease: "easeOut" }}
              >
                <Link href="https://youtu.be/HryZFOa2eUY" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 bg-transparent text-[#e4e4e5] px-6 py-2.5 rounded-full font-medium border border-white/20 hover:bg-white/10 transition-colors text-sm">
                  <Play className="w-4 h-4 text-[#e4e4e5] flex-shrink-0" />
                  Watch Demo
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10">
        <FeaturesScroll />
      </div>

      <section className="py-32 px-6 relative z-10 w-full bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col mb-20 gap-8">
            <div className="max-w-4xl text-left">
              <div className="text-[12px] font-semibold tracking-[0.18em] text-[#A1A1AA] uppercase mb-5">
                Portals
              </div>
              <h2 className="max-w-4xl text-[42px] md:text-[58px] lg:text-[76px] font-black tracking-[-0.04em] text-white leading-[0.98]">
                CipherRoll Workspaces
              </h2>
              <p className="text-[18px] md:text-[20px] text-[#b4b4bc] mt-6 max-w-2xl font-normal leading-[1.65]">
                {`CipherRoll utilizes the CoFHE coprocessor stack to keep confidential data encrypted on ${SUPPORTED_CHAIN_NAMES}, meaning host chain operators never see your organization's financial state.`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {portals.map((portal) => (
              <Link href={portal.url} key={portal.title} className="block group">
                <div className="relative w-full rounded-[2rem] p-8 md:p-10 transition-all duration-700 ease-out bg-[#0a0a0a] hover:bg-white overflow-hidden flex flex-col h-[520px]">
                  <div className="absolute top-8 right-8 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 delay-75 bg-[#18181b] group-hover:bg-black opacity-0 -translate-x-4 translate-y-4 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 z-20">
                    <ArrowUpRight className="w-6 h-6 text-white" />
                  </div>

                  <div className="flex-grow w-full flex items-center justify-center mb-10 transition-transform duration-1000 ease-out group-hover:scale-110">
                    <portal.icon className="w-48 h-48 text-[#18181b] transition-colors duration-700 group-hover:text-[#f4f4f5]" strokeWidth={0.5} />
                  </div>

                  <div className="mt-auto flex flex-col gap-4 relative z-10 transition-transform duration-500 ease-out group-hover:-translate-y-2">
                    <h3 className="text-3xl lg:text-4xl font-medium tracking-tight text-white transition-colors duration-500 group-hover:text-black">
                      {portal.title}
                    </h3>
                    <p className="text-[#A1A1AA] transition-colors duration-500 group-hover:text-[#52525b] text-base md:text-lg leading-relaxed max-w-[95%]">
                      {portal.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-20 px-6 border-t border-white/10 relative z-10 bg-[#000] w-full">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-16 md:gap-8">
          <div className="flex flex-col items-start pr-8 md:w-1/3">
            <Link href="/" className="text-[20px] font-bold tracking-tight text-white mb-6">
              {title}.
            </Link>
            <p className="text-[#A1A1AA] text-lg font-medium leading-relaxed mb-8">
              {tagline}
              <br />
              Configured for {TARGET_CHAIN_NAME}.
            </p>
            <Link href="/docs" className="inline-flex items-center gap-2.5 bg-white text-black px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-white/90 transition-colors mb-20 md:mb-28">
              Explore docs <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
