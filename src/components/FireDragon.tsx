import { useMemo } from "react";

interface DragonSegment {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

// Removed PainterlyFlame to reduce animations

export default function FireDragon() {
  // Precompute dragon segments; continuous CSS-driven flight (no timers)
  const dragonSegments = useMemo<DragonSegment[]>(() => {
    const segments: DragonSegment[] = [];
    for (let i = 0; i < 8; i++) {
      segments.push({
        id: i,
        x: -150 - (i * 80),
        y: 0,
        rotation: 0,
        scale: Math.max(0.6, 1 - (i * 0.08)),
      });
    }
    return segments;
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
        <>
          {/* Dragon segments */}
          {dragonSegments.map((segment, index) => {
            const topPx = window.innerHeight - 120 + Math.sin(index * 0.5) * 20;
            const startLeftPx = segment.x;
            const scale = segment.scale;
            return (
              <div
                key={segment.id}
                className="absolute dragon-fly"
                style={{
                  top: `${topPx}px`,
                  left: `${startLeftPx}px`,
                  zIndex: 30 - index,
                  // Single CSS-only fly-by to reduce ongoing animations
                  animation: `dragon-fly-x 12s linear 1 forwards`,
                  animationDelay: `${index * 0.12}s`,
                }}
              >
                <div>
                  {/* Dragon Head (first segment) */}
                  {index === 0 && (
                    <div className="relative">
                      {/* Dragon head */}
                      <div 
                        className="w-24 h-16 rounded-full relative"
                        style={{
                          background: "linear-gradient(135deg, #dc2626, #ea580c, #f59e0b)",
                          boxShadow: "0 0 30px rgba(220, 38, 38, 0.6)",
                          transform: `scale(${scale})`
                        }}
                      >
                        {/* Eyes */}
                        <div className="absolute top-3 left-4 w-3 h-3 bg-yellow-300 rounded-full">
                          <div className="w-2 h-2 bg-black rounded-full ml-0.5 mt-0.5" />
                        </div>
                        <div className="absolute top-3 right-4 w-3 h-3 bg-yellow-300 rounded-full">
                          <div className="w-2 h-2 bg-black rounded-full ml-0.5 mt-0.5" />
                        </div>
                        
                        {/* Nostrils */}
                        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
                          <div className="flex gap-1">
                            <div className="w-1 h-2 bg-black rounded-full" />
                            <div className="w-1 h-2 bg-black rounded-full" />
                          </div>
                        </div>
                        
                        {/* Horns */}
                        <div className="absolute -top-2 left-1/4 w-2 h-4 bg-yellow-500 rounded-t-full transform rotate-12" />
                        <div className="absolute -top-2 right-1/4 w-2 h-4 bg-yellow-500 rounded-t-full transform -rotate-12" />
                      </div>
                      
                      {/* Flame removed to reduce animations */}
                    </div>
                  )}
                  
                  {/* Dragon body segments */}
                  {index > 0 && index < 6 && (
                    <div 
                      className="w-20 h-12 rounded-full relative"
                      style={{
                        background: `linear-gradient(135deg, #dc2626, #ea580c, #f59e0b)`,
                        boxShadow: "0 0 25px rgba(220, 38, 38, 0.4)",
                        transform: `scale(${Math.max(0.6, 1 - (index * 0.08))})`
                      }}
                    >
                      {/* Body scales */}
                      <div className="absolute inset-0 rounded-full opacity-30"
                           style={{
                             background: "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)"
                           }} />
                    </div>
                  )}
                  
                  {/* Dragon tail segments */}
                  {index >= 6 && (
                    <div 
                      className="w-16 h-8 rounded-full relative"
                      style={{
                        background: `linear-gradient(135deg, #dc2626, #ea580c)`,
                        boxShadow: "0 0 20px rgba(220, 38, 38, 0.3)",
                        transform: `scale(${Math.max(0.4, 1 - (index * 0.1))})`
                      }}
                    >
                      {/* Tail fin */}
                      {index === 7 && (
                        <div 
                          className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-8 h-12"
                          style={{
                            background: "linear-gradient(135deg, #f97316, #fbbf24)",
                            clipPath: "polygon(0 50%, 100% 0%, 100% 100%)",
                            boxShadow: "0 0 15px rgba(251, 191, 36, 0.5)"
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Sparkle trail effects */}
          {Array.from({ length: 4 }).map((_, i) => {
            const topPx = window.innerHeight - 100 + Math.random() * 40;
            const startLeft = -100 + (i * -30);
            const color = ["#fbbf24", "#f97316", "#dc2626", "#a855f7"][i % 4];
            return (
              <div
                key={`sparkle-${i}`}
                className="absolute sparkle-fly w-3 h-3"
                style={{
                  top: `${topPx}px`,
                  left: `${startLeft}px`,
                  animation: `sparkle-fly-x 12s ease-in-out 1 forwards`,
                  animationDelay: `${i * 0.24}s`
                }}
              >
                <div 
                  className="sparkle-pop-rot w-full h-full"
                  style={{
                    background: color,
                    clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
                    boxShadow: `0 0 10px ${color}80`
                  }}
                />
              </div>
            );
          })}
        </>
    </div>
  );
}
