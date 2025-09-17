import { useMemo } from "react";

interface Balloon {
  id: string;
  x: number;
  color: string;
  size: number;
  delay: number;
}

const balloonColors = ["#f43f5e", "#fb923c", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#ef4444"];

export default function FloatingBalloons() {
  // Render a fixed, memoized set of balloons and let CSS loop them infinitely.
  const balloons = useMemo<Balloon[]>(() => {
    return Array.from({ length: 3 }).map((_, i) => ({
      id: String(i),
      x: Math.random() * 90 + 5,
      color: balloonColors[Math.floor(Math.random() * balloonColors.length)],
      size: Math.random() * 20 + 30,
      // Use negative delays to phase balloons mid-flight without JS timers
      delay: -(Math.random() * 12),
    }));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      {balloons.map((balloon) => (
        <div
          key={balloon.id}
          className="absolute balloon-float"
          style={{
            left: `${balloon.x}%`,
            // Slower, lighter loop via CSS only
            animation: `balloon-float ${18 + Math.random() * 6}s linear infinite`,
            animationDelay: `${balloon.delay}s`,
          }}
        >
          <div className="relative">
            <div
              className="relative rounded-full shadow-lg balloon-sway"
              style={{
                width: `${balloon.size}px`,
                height: `${balloon.size * 1.2}px`,
                background: `radial-gradient(ellipse at 30% 20%, ${balloon.color}40, ${balloon.color})`,
                boxShadow: `0 0 15px ${balloon.color}30, inset -5px -5px 10px rgba(0,0,0,0.1)`
              }}
            >
              <div
                className="absolute rounded-full opacity-60"
                style={{
                  width: `${balloon.size * 0.3}px`,
                  height: `${balloon.size * 0.4}px`,
                  background: 'rgba(255,255,255,0.8)',
                  top: `${balloon.size * 0.15}px`,
                  left: `${balloon.size * 0.2}px`,
                  filter: 'blur(1px)'
                }}
              />
            </div>

            <div
              className="absolute bg-gray-600 opacity-70"
              style={{
                width: '1px',
                height: `${balloon.size * 1.5}px`,
                left: '50%',
                top: `${balloon.size * 1.2}px`,
                transformOrigin: 'top',
                transform: 'translateX(-50%)'
              }}
            />

            <div
              className="absolute bg-gray-700 rounded-full"
              style={{
                width: '3px',
                height: '3px',
                left: '50%',
                top: `${balloon.size * 2.7}px`,
                transform: 'translateX(-50%)'
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
