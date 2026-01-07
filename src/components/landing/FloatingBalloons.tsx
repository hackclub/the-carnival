"use client";

const BALLOONS = [
  { id: "0", leftPct: 12, color: "#f59e0b", size: 42, delay: -6 },
  { id: "1", leftPct: 78, color: "#ef4444", size: 36, delay: -10 },
  { id: "2", leftPct: 42, color: "#3b82f6", size: 40, delay: -2 },
] as const;

export default function FloatingBalloons() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      {BALLOONS.map((b) => (
        <div
          key={b.id}
          className="absolute carnival-balloon-float"
          style={{
            left: `${b.leftPct}%`,
            animationDelay: `${b.delay}s`,
          }}
        >
          <div className="relative carnival-balloon-sway">
            <div
              className="relative rounded-full shadow-lg"
              style={{
                width: `${b.size}px`,
                height: `${b.size * 1.2}px`,
                background: `radial-gradient(ellipse at 30% 20%, ${b.color}40, ${b.color})`,
                boxShadow: `0 0 12px ${b.color}22, inset -5px -5px 10px rgba(0,0,0,0.08)`,
              }}
            >
              <div
                className="absolute rounded-full opacity-60"
                style={{
                  width: `${b.size * 0.3}px`,
                  height: `${b.size * 0.4}px`,
                  background: "rgba(255,255,255,0.8)",
                  top: `${b.size * 0.15}px`,
                  left: `${b.size * 0.2}px`,
                  filter: "blur(1px)",
                }}
              />
            </div>

            <div
              className="absolute opacity-60"
              style={{
                width: "1px",
                height: `${b.size * 1.5}px`,
                left: "50%",
                top: `${b.size * 1.2}px`,
                transform: "translateX(-50%)",
                background:
                  "linear-gradient(to bottom, rgba(100,116,139,0.0), rgba(100,116,139,0.6))",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}


