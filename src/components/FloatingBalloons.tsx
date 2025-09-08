import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface Balloon {
  id: string;
  x: number;
  color: string;
  size: number;
  delay: number;
}

const balloonColors = ["#f43f5e", "#fb923c", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#ef4444"];

export default function FloatingBalloons() {
  const [balloons, setBalloons] = useState<Balloon[]>([]);

  const createBalloon = () => {
    const newBalloon: Balloon = {
      id: Math.random().toString(36).substr(2, 9),
      x: Math.random() * 90 + 5, // 5% to 95% of screen width
      color: balloonColors[Math.floor(Math.random() * balloonColors.length)],
      size: Math.random() * 20 + 30, // 30px to 50px
      delay: Math.random() * 2,
    };

    setBalloons(prev => [...prev, newBalloon]);

    setTimeout(() => {
      setBalloons(prev => prev.filter(b => b.id !== newBalloon.id));
    }, 15000);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() < 0.4) {
        createBalloon();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      <AnimatePresence>
        {balloons.map((balloon) => (
          <motion.div
            key={balloon.id}
            initial={{ 
              y: "100vh",
              x: `${balloon.x}%`,
              rotate: 0
            }}
            animate={{ 
              y: "-20vh",
              x: [`${balloon.x}%`, `${balloon.x + 5}%`, `${balloon.x - 3}%`, `${balloon.x + 2}%`],
              rotate: [-2, 2, -2, 2]
            }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: 12,
              delay: balloon.delay,
              ease: "linear",
              x: {
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut"
              },
              rotate: {
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }
            }}
            className="absolute"
          >
            <div className="relative">
              <motion.div
                animate={{ 
                  scale: [1, 1.02, 1],
                  y: [0, -2, 0]
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="relative rounded-full shadow-lg"
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
              </motion.div>
              
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
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
