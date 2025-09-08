import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

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
      x: Math.random() * 80 + 10, // 10% to 90% of screen width
      y: Math.random() * 40 + 20, // 20% to 60% of screen height
      color: fireworkColors[Math.floor(Math.random() * fireworkColors.length)],
      particles: Array.from({ length: 12 }, (_, i) => ({
        id: i,
        angle: (i * 360) / 12,
        distance: Math.random() * 60 + 40,
      })),
    };

    setFireworks(prev => [...prev, newFirework]);

    setTimeout(() => {
      setFireworks(prev => prev.filter(fw => fw.id !== newFirework.id));
    }, 2000);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() < 0.3) {
        createFirework();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      <AnimatePresence>
        {fireworks.map((firework) => (
          <div
            key={firework.id}
            className="absolute"
            style={{
              left: `${firework.x}%`,
              top: `${firework.y}%`,
            }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 1.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="absolute w-4 h-4 rounded-full -translate-x-2 -translate-y-2"
              style={{ 
                backgroundColor: firework.color,
                boxShadow: `0 0 20px ${firework.color}80`
              }}
            />
            
            {firework.particles.map((particle) => (
              <motion.div
                key={particle.id}
                initial={{ 
                  x: 0, 
                  y: 0, 
                  scale: 1,
                  opacity: 1 
                }}
                animate={{ 
                  x: Math.cos((particle.angle * Math.PI) / 180) * particle.distance,
                  y: Math.sin((particle.angle * Math.PI) / 180) * particle.distance,
                  scale: 0,
                  opacity: 0
                }}
                transition={{ 
                  duration: 1.2,
                  ease: "easeOut",
                  delay: 0.1
                }}
                className="absolute w-2 h-2 rounded-full -translate-x-1 -translate-y-1"
                style={{ 
                  backgroundColor: firework.color,
                  boxShadow: `0 0 8px ${firework.color}60`
                }}
              />
            ))}
            
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={`sparkle-${i}`}
                initial={{ 
                  x: 0, 
                  y: 0, 
                  scale: 0,
                  opacity: 0,
                  rotate: 0
                }}
                animate={{ 
                  x: (Math.random() - 0.5) * 120,
                  y: (Math.random() - 0.5) * 120,
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                  rotate: 360
                }}
                transition={{ 
                  duration: 1.8,
                  ease: "easeOut",
                  delay: 0.3 + i * 0.1
                }}
                className="absolute w-1 h-1"
              >
                <div 
                  className="w-full h-full"
                  style={{ 
                    background: `linear-gradient(45deg, ${firework.color}, #fbbf24)`,
                    clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)"
                  }}
                />
              </motion.div>
            ))}
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
