import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
};

const AMBER_COLORS = ["#fbbf24", "#f59e0b", "#d97706"];

export default function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runningRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lastEmitRef = useRef(0);
  const lastTsRef = useRef(0);
  const mReduce = useRef<MediaQueryList | null>(null);
  const emissionIntervalMsRef = useRef(22); // adaptive
  const maxParticlesRef = useRef(120); // adaptive
  const fpsAvgRef = useRef({ sum: 0, count: 0, lastAdjust: 0 });

  // Resize canvas to device pixel ratio
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { innerWidth: w, innerHeight: h } = window;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });
    return () => window.removeEventListener("resize", resize as any);
  }, []);

  // Pause on visibility change and when reduced motion is enabled
  useEffect(() => {
    const onVisibility = () => {
      runningRef.current = !document.hidden && !(mReduce.current?.matches ?? false);
      if (runningRef.current && rafRef.current == null) loop(performance.now());
    };
    document.addEventListener("visibilitychange", onVisibility);
    mReduce.current = window.matchMedia("(prefers-reduced-motion: reduce)");
    mReduce.current.addEventListener?.("change", onVisibility);
    onVisibility();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      mReduce.current?.removeEventListener?.("change", onVisibility);
    };
  }, []);

  // Mousemove emitter (no React state)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!runningRef.current) return;
      const now = performance.now();
      if (now - lastEmitRef.current < emissionIntervalMsRef.current) return;
      lastEmitRef.current = now;

      const bursts = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < bursts; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 20 + Math.random() * 30;
        particlesRef.current.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 900 + Math.random() * 300,
          size: 2.5 + Math.random() * 2.5,
          color: AMBER_COLORS[Math.floor(Math.random() * AMBER_COLORS.length)],
        });
      }

      // Cap particle count to prevent unbounded growth
      const maxParticles = maxParticlesRef.current;
      if (particlesRef.current.length > maxParticles) {
        particlesRef.current.splice(0, particlesRef.current.length - maxParticles);
      }
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove as any);
  }, []);

  // Animation loop draws to canvas; no React re-renders
  const loop = (ts: number) => {
    if (!runningRef.current) {
      rafRef.current = null;
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const last = lastTsRef.current || ts;
    const dt = Math.min(50, ts - last); // clamp delta to avoid jumps
    lastTsRef.current = ts;

    // Clear with slight alpha to keep glow subtle, or hard clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        particles.splice(i, 1);
        continue;
      }
      const t = p.life / p.maxLife;
      const alpha = 1 - t;
      const drag = 0.0015 * dt;
      p.vx *= (1 - drag);
      p.vy *= (1 - drag);
      p.vy += 0.02 * dt; // slight gravity
      p.x += (p.vx * dt) / 1000;
      p.y += (p.vy * dt) / 1000;

      ctx.beginPath();
      ctx.fillStyle = hexToRgba(p.color, alpha);
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // adaptive quality based on fps
    const fps = 1000 / Math.max(1, dt);
    const stats = fpsAvgRef.current;
    stats.sum += fps;
    stats.count += 1;
    if (ts - stats.lastAdjust > 700) {
      const avg = stats.sum / Math.max(1, stats.count);
      // Adjust emission interval and max particles gradually
      if (avg < 45) {
        emissionIntervalMsRef.current = Math.min(60, emissionIntervalMsRef.current + 6);
        maxParticlesRef.current = Math.max(60, maxParticlesRef.current - 6);
      } else if (avg > 55) {
        emissionIntervalMsRef.current = Math.max(18, emissionIntervalMsRef.current - 4);
        maxParticlesRef.current = Math.min(140, maxParticlesRef.current + 4);
      }
      stats.sum = 0;
      stats.count = 0;
      stats.lastAdjust = ts;
    }

    rafRef.current = requestAnimationFrame(loop);
  };

  // Start loop
  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      <canvas ref={canvasRef} />
    </div>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}



