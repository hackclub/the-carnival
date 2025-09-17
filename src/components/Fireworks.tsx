import { useMemo } from "react";

interface Firework {
  id: string;
  x: number;
  y: number;
  color: string;
  particles: Array<{
    id: number;
    angle: number;
    distance: number;
  }>;
  delay: number;
  duration: number;
}

const fireworkColors = ["#f43f5e", "#fb923c", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];

export default function Fireworks() {
  // Render a fixed set of fireworks looping via CSS only (no timers).
  const fireworks = useMemo<Firework[]>(() => {
    return Array.from({ length: 1 }).map((_, i) => {
      const x = Math.random() * 80 + 10;
      const y = Math.random() * 40 + 20;
      const color = fireworkColors[Math.floor(Math.random() * fireworkColors.length)];
      const particles = Array.from({ length: 8 }, (_, j) => ({
        id: j,
        angle: (j * 360) / 12,
        distance: Math.random() * 60 + 40,
      }));
      return {
        id: String(i),
        x,
        y,
        color,
        particles,
        delay: 0,
        duration: 1.8 + Math.random() * 0.6,
      };
    });
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      {fireworks.map((firework) => (
        <div
          key={firework.id}
          className="absolute"
          style={{ left: `${firework.x}%`, top: `${firework.y}%` }}
        >
          <div
            className="absolute w-4 h-4 rounded-full -translate-x-2 -translate-y-2 firework-flash"
            style={{
              backgroundColor: firework.color,
              boxShadow: `0 0 20px ${firework.color}80`,
              animation: `firework-flash ${firework.duration}s ease-out forwards`,
              animationDelay: `${firework.delay}s`,
            }}
          />

          {firework.particles.map((particle) => {
            const dx = Math.cos((particle.angle * Math.PI) / 180) * particle.distance;
            const dy = Math.sin((particle.angle * Math.PI) / 180) * particle.distance;
            return (
              <div
                key={particle.id}
                className="absolute w-2 h-2 rounded-full -translate-x-1 -translate-y-1 particle-move"
                style={{
                  backgroundColor: firework.color,
                  boxShadow: `0 0 8px ${firework.color}60`,
                  // custom properties drive CSS keyframes
                  ['--dx' as any]: `${dx}px`,
                  ['--dy' as any]: `${dy}px`,
                  animation: `particle-move ${Math.max(1.2, firework.duration - 0.4)}s ease-out forwards`,
                  animationDelay: `${firework.delay + Math.random() * 0.2}s`,
                }}
              />
            );
          })}

          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`sparkle-${i}`}
              className="absolute w-1 h-1 sparkle-pop"
              style={{
                ['--sx' as any]: `${(Math.random() - 0.5) * 120}px`,
                ['--sy' as any]: `${(Math.random() - 0.5) * 120}px`,
                animation: `sparkle-pop ${Math.max(1.8, firework.duration)}s ease-out forwards`,
                animationDelay: `${firework.delay + i * 0.05}s`,
              }}
            >
              <div
                className="w-full h-full"
                style={{
                  background: `linear-gradient(45deg, ${firework.color}, #fbbf24)`,
                  clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)"
                }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
