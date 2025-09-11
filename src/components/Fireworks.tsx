import { useEffect, useState } from "react";

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
}

const fireworkColors = ["#f43f5e", "#fb923c", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];

export default function Fireworks() {
  const [fireworks, setFireworks] = useState<Firework[]>([]);

  const createFirework = () => {
    const newFirework: Firework = {
      id: Math.random().toString(36).substr(2, 9),
      x: Math.random() * 80 + 10,
      y: Math.random() * 40 + 20,
      color: fireworkColors[Math.floor(Math.random() * fireworkColors.length)],
      particles: Array.from({ length: 12 }, (_, i) => ({
        id: i,
        angle: (i * 360) / 12,
        distance: Math.random() * 60 + 40,
      })),
    };

    setFireworks(prev => [...prev, newFirework]);

    window.setTimeout(() => {
      setFireworks(prev => prev.filter(fw => fw.id !== newFirework.id));
    }, 2000);
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (Math.random() < 0.3) {
        createFirework();
      }
    }, 3000);

    return () => window.clearInterval(interval);
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
              boxShadow: `0 0 20px ${firework.color}80`
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
                }}
              />
            );
          })}

          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`sparkle-${i}`}
              className="absolute w-1 h-1 sparkle-pop"
              style={{
                ['--sx' as any]: `${(Math.random() - 0.5) * 120}px`,
                ['--sy' as any]: `${(Math.random() - 0.5) * 120}px`,
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
