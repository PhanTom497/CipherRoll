'use client';

import { useEffect, useRef } from "react";

export default function CursorAura() {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let currentX = mouseX;
    let currentY = mouseY;
    let raf = 0;
    let visible = true;

    const move = (event: MouseEvent) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      visible = true;
      outer.style.opacity = "0.85";
      inner.style.opacity = "0.95";
    };

    const hide = () => {
      visible = false;
      outer.style.opacity = "0";
      inner.style.opacity = "0";
    };

    const tick = () => {
      currentX += (mouseX - currentX) * 0.12;
      currentY += (mouseY - currentY) * 0.12;

      const outerX = currentX - 140;
      const outerY = currentY - 140;
      const innerX = currentX - 44;
      const innerY = currentY - 44;

      outer.style.transform = `translate3d(${outerX}px, ${outerY}px, 0)`;
      inner.style.transform = `translate3d(${innerX}px, ${innerY}px, 0)`;

      if (!visible) {
        outer.style.opacity = "0";
        inner.style.opacity = "0";
      }

      raf = window.requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mouseout", hide);
    window.addEventListener("blur", hide);

    raf = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseout", hide);
      window.removeEventListener("blur", hide);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[6] hidden md:block">
      <div
        ref={outerRef}
        className="absolute h-[280px] w-[280px] rounded-full opacity-0 blur-[52px] transition-opacity duration-300"
        style={{
          background:
            "radial-gradient(circle at 32% 30%, rgba(255,255,255,0.16), rgba(170,186,205,0.09) 34%, rgba(214,175,121,0.07) 55%, transparent 74%)"
        }}
      />
      <div
        ref={innerRef}
        className="absolute h-[88px] w-[88px] rounded-full opacity-0 blur-[18px] transition-opacity duration-300"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(214,175,121,0.12) 44%, rgba(214,175,121,0) 76%)"
        }}
      />
    </div>
  );
}
