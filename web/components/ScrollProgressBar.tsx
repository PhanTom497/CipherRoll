'use client';

import { motion, useScroll, useSpring } from "framer-motion";

export default function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 24,
    mass: 0.18
  });

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] bg-white/[0.04]">
      <motion.div
        className="h-full origin-left bg-gradient-to-r from-white/70 via-[#d9b27e] to-white/75 shadow-[0_0_16px_rgba(217,178,126,0.35)]"
        style={{ scaleX }}
      />
    </div>
  );
}
