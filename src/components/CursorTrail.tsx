import React, { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

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

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 300, damping: 30, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 300, damping: 30, mass: 0.6 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);

      const now = performance.now();
      if (now - lastEmitRef.current < 22) return;
      lastEmitRef.current = now;

      const bursts = 2 + Math.floor(Math.random() * 2);
      const newParticles: Particle[] = Array.from({ length: bursts }).map(() => {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 10;
        return {
          id: idRef.current++,
          x: e.clientX + Math.cos(angle) * radius,
          y: e.clientY + Math.sin(angle) * radius,
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
  }, [mx, my]);

  useEffect(() => {
    const iv = setInterval(() => {
      const now = performance.now();
      setParticles((prev) => prev.filter((p) => now - p.createdAt < 900));
    }, 200);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          initial={{ opacity: 0.9, scale: 1, x: p.x, y: p.y }}
          animate={{ opacity: 0, scale: 0.4, y: p.y - 14 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          style={{ left: 0, top: 0, backgroundColor: p.color, width: p.size, height: p.size }}
          className="absolute rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]"
        />
      ))}

      <motion.div
        style={{ x: sx, y: sy }}
        className="absolute -translate-x-1/2 -translate-y-1/2"
      >
        <div className="pointer-events-none h-6 w-6 rounded-full border border-amber-400/60 bg-white/10 backdrop-blur-sm" />
      </motion.div>
    </div>
  );
}


