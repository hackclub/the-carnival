import { useEffect, useRef, useState } from "react";

type Particle = {
  id: number;
  x: number;
  y: number;
  createdAt: number;
  color: string;
  size: number;
};

const AMBER_COLORS = ["#fbbf24", "#f59e0b", "#d97706"];

export default function CursorTrail() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const idRef = useRef(0);
  const lastEmitRef = useRef(0);

  const mouseRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;

      const now = performance.now();
      if (now - lastEmitRef.current < 22) return;
      lastEmitRef.current = now;

      const bursts = 2 + Math.floor(Math.random() * 2);
      const newParticles: Particle[] = Array.from({ length: bursts }).map(() => {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 10;
        return {
          id: idRef.current++,
          x: mouseRef.current.x + Math.cos(angle) * radius,
          y: mouseRef.current.y + Math.sin(angle) * radius,
          createdAt: now,
          color: AMBER_COLORS[Math.floor(Math.random() * AMBER_COLORS.length)],
          size: 4 + Math.random() * 4,
        };
      });

      setParticles((prev) => {
        const merged = [...prev, ...newParticles];
        return merged.slice(Math.max(0, merged.length - 80));
      });
    };

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      setParticles((prev) => prev.filter((p) => now - p.createdAt < 900));
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)] trail-particle"
          style={{ left: p.x, top: p.y, backgroundColor: p.color, width: p.size, height: p.size }}
        />
      ))}
    </div>
  );
}


