'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { Lock, Shield, Zap } from "lucide-react";
import { SUPPORTED_CHAIN_NAMES } from '@/lib/cipherroll-config';

const features = [
  {
    icon: Lock,
    title: "Encrypted State",
    desc: `Budgets, commitments, and employee allocations are stored as FHE-protected values on ${SUPPORTED_CHAIN_NAMES}, completely hiding the underlying integers from host operators.`,
    bg: "linear-gradient(135deg, #e4e4e7 0%, #a1a1aa 100%)",
    textColor: "text-[#18181b]",
    descColor: "text-[#3f3f46]",
    iconColor: "text-[#18181b]"
  },
  {
    icon: Zap,
    title: "CoFHE Coprocessor",
    desc: `By utilizing the official CoFHE coprocessor stack, CipherRoll runs encrypted payroll logic across ${SUPPORTED_CHAIN_NAMES} without introducing network ambiguity.`,
    bg: "linear-gradient(135deg, #0f766e 0%, #083344 100%)",
    textColor: "text-white",
    descColor: "text-white/80",
    iconColor: "text-white"
  },
  {
    icon: Shield,
    title: "E2E Privacy",
    desc: "The WASM @cofhe/sdk client guarantees that payroll ciphertexts are decrypted directly inside your browser so neither RPCs nor the dApp server can see your salary.",
    bg: "linear-gradient(135deg, #27272a 0%, #000000 100%)",
    textColor: "text-white",
    descColor: "text-[#a1a1aa]",
    iconColor: "text-white"
  }
];

export default function FeaturesScroll() {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const [step, setStep] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (latest < 0.2) setStep(0);
    else if (latest < 0.5) setStep(1);
    else if (latest < 0.75) setStep(2);
    else setStep(3);
  });

  const containerScale = step >= 1 ? 0.85 : 1;
  const containerY = step >= 1 ? "8vh" : "0vh";
  const textOpacity = step >= 1 ? 1 : 0;
  const textY = step >= 1 ? 0 : 40;
  const gap = step >= 2 ? "24px" : "0px";
  const splitRadius = step >= 2 ? "24px" : "0px";
  const singleOp = step >= 2 ? 0 : 1;
  const splitOp = step >= 2 ? 1 : 0;
  const rotateFront = step >= 3 ? 180 : 0;
  const rotateBack = step >= 3 ? 0 : -180;

  return (
    <section ref={containerRef} className="h-[400vh] relative bg-black">
      <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden">
        <motion.div
          animate={{ opacity: textOpacity, y: textY }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute top-[14%] left-0 right-0 text-center z-0 px-6"
        >
          <h2 className="max-w-5xl mx-auto text-[38px] md:text-[54px] lg:text-[68px] font-extrabold tracking-[-0.04em] text-white leading-[0.96]">
            Confidential Operations
            <span className="block text-white/90">Built Over CoFHE</span>
          </h2>
        </motion.div>

        <div className="w-full absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-auto">
          <motion.div
            animate={{ scale: containerScale, y: containerY }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="relative flex justify-center items-center w-[90vw] md:w-[75vw] max-w-6xl h-[65vh] mt-16 md:mt-20"
          >
            <motion.div
              animate={{ opacity: singleOp }}
              transition={{ duration: 0.1 }}
              className="absolute inset-0 rounded-[24px] overflow-hidden bg-[#2a1b38]"
            >
              <Image
                src="/assets/feature-bg.png"
                alt="CipherRoll features"
                fill
                sizes="(max-width: 768px) 90vw, 75vw"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-black/10" />
            </motion.div>

            <motion.div
              className="absolute inset-0 flex w-full h-full pointer-events-none"
              animate={{ gap, opacity: splitOp }}
              transition={{ gap: { duration: 1.8, ease: "easeInOut" }, opacity: { duration: 0.1 } }}
            >
              {features.map((feature, index) => {
                const borderRadiusSettings =
                  index === 0
                    ? { borderTopLeftRadius: "24px", borderBottomLeftRadius: "24px", borderTopRightRadius: splitRadius, borderBottomRightRadius: splitRadius }
                    : index === 1
                      ? { borderRadius: splitRadius }
                      : { borderTopRightRadius: "24px", borderBottomRightRadius: "24px", borderTopLeftRadius: splitRadius, borderBottomLeftRadius: splitRadius };

                const fanStyles =
                  step >= 3
                    ? index === 0
                      ? { rotateZ: -5, x: "11%", y: "4%" }
                      : index === 2
                        ? { rotateZ: 5, x: "-11%", y: "4%" }
                        : { rotateZ: 0, x: "0%", y: "0%" }
                    : { rotateZ: 0, x: "0%", y: "0%" };

                return (
                  <motion.div
                    key={index}
                    className="relative flex-1 h-full w-full pointer-events-auto"
                    animate={fanStyles}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                    style={{
                      perspective: "1500px",
                      zIndex: index === 1 ? 10 : 1
                    }}
                  >
                    <motion.div
                      className="absolute inset-0 overflow-hidden bg-[#2a1b38]"
                      animate={{
                        rotateY: rotateFront,
                        ...borderRadiusSettings
                      }}
                      transition={{ duration: 1.5, ease: "easeInOut" }}
                      style={{
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden"
                      }}
                    >
                      <div
                        className="absolute top-0 bottom-0 min-w-max"
                        style={{
                          width: "300%",
                          left: index === 0 ? "0%" : index === 1 ? "-100%" : "-200%"
                        }}
                      >
                        <Image
                          src="/assets/feature-bg.png"
                          alt={`CipherRoll feature ${index + 1}`}
                          fill
                          sizes="(max-width: 768px) 90vw, 25vw"
                          className="object-cover"
                        />
                      </div>
                      <div className="absolute inset-0 bg-black/10" />
                      <div className="absolute inset-0 border border-white/5" />
                    </motion.div>

                    <motion.div
                      className="absolute inset-0 flex flex-col p-8 md:p-10 shadow-2xl overflow-hidden"
                      animate={{
                        rotateY: rotateBack,
                        ...borderRadiusSettings
                      }}
                      transition={{ duration: 1.5, ease: "easeInOut" }}
                      style={{
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                        background: feature.bg
                      }}
                    >
                      <div className="mb-auto">
                        <feature.icon className={`w-6 h-6 ${feature.iconColor}`} strokeWidth={1.5} />
                      </div>
                      <div className="flex-grow flex items-center mb-6">
                        <h3 className={`text-[34px] lg:text-[52px] font-medium tracking-[-0.03em] pr-4 ${feature.textColor} leading-[1.04] max-w-[92%]`}>
                          {feature.title}
                        </h3>
                      </div>
                      <div className="mt-auto">
                        <p className={`text-[13px] lg:text-[15px] leading-[1.6] max-w-[86%] ${feature.descColor}`}>
                          {feature.desc}
                        </p>
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
