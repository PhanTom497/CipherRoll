import { useEffect, useRef, useCallback } from "react";

const WireframeBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const scrollRef = useRef(0);
  const animRef = useRef<number>(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current = {
      x: e.clientX / window.innerWidth,
      y: e.clientY / window.innerHeight,
    };
  }, []);

  const handleScroll = useCallback(() => {
    scrollRef.current = window.scrollY;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", handleScroll);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const scroll = scrollRef.current;

      ctx.clearRect(0, 0, w, h);

      // Perspective params influenced by mouse & scroll
      const perspectiveX = (mx - 0.5) * 0.3;
      const perspectiveY = (my - 0.5) * 0.2;
      const scrollFactor = scroll * 0.0003;
      const gridSize = 60;
      const rows = 30;
      const cols = Math.ceil(w / gridSize) + 4;
      const vanishY = h * (0.35 + perspectiveY * 0.1);
      const vanishX = w * (0.5 + perspectiveX * 0.2);

      ctx.strokeStyle = `rgba(255, 255, 255, 0.07)`;
      ctx.lineWidth = 0.5;

      // Horizontal perspective lines
      for (let i = 0; i <= rows; i++) {
        const t = i / rows;
        const y = vanishY + (h - vanishY) * Math.pow(t, 1.5 + scrollFactor * 0.5);
        const spread = t * (w * 0.8 + scrollFactor * 100);
        const x1 = vanishX - spread;
        const x2 = vanishX + spread;

        const alpha = Math.min(0.12, 0.03 + t * 0.09);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
      }

      // Vertical converging lines
      for (let i = -cols / 2; i <= cols / 2; i++) {
        const baseX = vanishX + i * gridSize;
        const alpha = Math.max(0.02, 0.08 - Math.abs(i) * 0.005);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(vanishX + i * 2, vanishY);
        ctx.lineTo(baseX + perspectiveX * i * 10, h);
        ctx.stroke();
      }

      // Subtle glow at vanishing point
      const gradient = ctx.createRadialGradient(vanishX, vanishY, 0, vanishX, vanishY, 300);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.04)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [handleMouseMove, handleScroll]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ background: "hsl(0 0% 2%)" }}
    />
  );
};

export default WireframeBackground;
