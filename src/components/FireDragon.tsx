import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DragonSegment {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

function PainterlyFlame() {
  return (
    <motion.svg
      initial={{ scale: 0.96, opacity: 0.95, x: 0, y: 0 }}
      animate={{
        x: [0, 18],
        scale: [0.96, 1.04],
        opacity: [0.95, 1],
        y: [0, -0.6]
      }}
      transition={{ duration: 1.6, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
      width="140"
      height="70"
      viewBox="0 0 140 70"
      className="absolute left-24 top-3"
      style={{ filter: "drop-shadow(0 0 12px rgba(251,191,36,0.45))", willChange: "transform, opacity, filter" }}
    >
      <defs>
        <radialGradient id="flameCore" cx="20%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#fef3c7" stopOpacity="0.9" />
          <stop offset="70%" stopColor="#fbbf24" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="flameMid" cx="25%" cy="50%" r="75%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.9" />
          <stop offset="45%" stopColor="#f59e0b" stopOpacity="0.8" />
          <stop offset="90%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="flameOuter" cx="30%" cy="50%" r="90%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#ea580c" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
        </radialGradient>
        <filter id="softPaint">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer painterly silhouette */}
      <motion.g
        filter="url(#softPaint)"
        animate={{ rotate: [-1.2, 1.2] }}
        transition={{ duration: 1.8, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        style={{ willChange: "transform" }}
      >
        <path
          d="M8,36 C28,14 52,10 78,24 C92,30 100,38 114,36 C108,40 96,46 84,48 C68,52 54,48 40,46 C30,44 20,40 8,36 Z"
          fill="url(#flameOuter)"
          opacity="0.9"
        />
        {/* Mid glow layer (static for smoothness) */}
        <path
          d="M10,36 C30,18 52,16 74,26 C86,30 94,36 106,36 C100,40 92,42 82,44 C66,46 54,44 42,42 C30,40 20,38 10,36 Z"
          fill="url(#flameMid)"
          opacity="0.96"
        />
        {/* Core hot flame */}
        <motion.path
          d="M16,36 C30,26 48,24 66,32 C74,34 82,36 92,36 C86,38 80,40 72,42 C60,44 50,42 40,40 C30,38 22,36 16,36 Z"
          fill="url(#flameCore)"
          animate={{ scale: [0.98, 1.04] }}
          transform-origin="20% 50%"
          transition={{ duration: 1.2, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        />
      </motion.g>

      {/* Painterly sparks */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.circle
          key={i}
          cx={60 + i * 8}
          cy={28 + ((i % 2 === 0) ? -2 : 2)}
          r={1.6}
          fill={i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#fbbf24" : "#f59e0b"}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0, 1, 0], y: [0, -2, -4] }}
          transition={{ duration: 1.4 + i * 0.05, repeat: Infinity, delay: i * 0.08 }}
          style={{ filter: "blur(0.3px)" }}
        />
      ))}
    </motion.svg>
  );
}

export default function FireDragon() {
  const [isDragonVisible, setIsDragonVisible] = useState(false);
  const [dragonSegments, setDragonSegments] = useState<DragonSegment[]>([]);

  // Create dragon segments
  useEffect(() => {
    const segments: DragonSegment[] = [];
    for (let i = 0; i < 8; i++) {
      segments.push({
        id: i,
        x: -150 - (i * 80), // Stagger segments behind each other
        y: 0,
        rotation: 0,
        scale: Math.max(0.6, 1 - (i * 0.08)), // Smaller segments towards tail
      });
    }
    setDragonSegments(segments);
  }, []);

  // Trigger dragon flight periodically
  useEffect(() => {
    const triggerDragon = () => {
      if (Math.random() < 0.3) { // 30% chance
        setIsDragonVisible(true);
        setTimeout(() => setIsDragonVisible(false), 8000); // 8 second flight
      }
    };

    // Initial random delay, then every 15-25 seconds
    const initialDelay = Math.random() * 10000 + 5000; // 5-15s initial
    const initialTimer = setTimeout(triggerDragon, initialDelay);

    const interval = setInterval(triggerDragon, Math.random() * 10000 + 15000); // 15-25s

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      <AnimatePresence>
        {isDragonVisible && (
          <>
            {/* Dragon segments */}
            {dragonSegments.map((segment, index) => (
              <motion.div
                key={segment.id}
                initial={{ 
                  x: segment.x, 
                  y: window.innerHeight - 120 + Math.sin(index * 0.5) * 20,
                  rotate: 0,
                  scale: segment.scale
                }}
                animate={{ 
                  x: window.innerWidth + 150,
                  y: window.innerHeight - 120 + Math.sin(index * 0.5) * 20,
                  rotate: [0, 5, -5, 0],
                  scale: segment.scale
                }}
                exit={{ opacity: 0 }}
                transition={{ 
                  duration: 8,
                  delay: index * 0.1,
                  ease: "easeInOut",
                  rotate: {
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }
                }}
                className="absolute"
                style={{ zIndex: 30 - index }}
              >
                {/* Dragon Head (first segment) */}
                {index === 0 && (
                  <div className="relative">
                    {/* Dragon head */}
                    <div 
                      className="w-24 h-16 rounded-full relative"
                      style={{
                        background: "linear-gradient(135deg, #dc2626, #ea580c, #f59e0b)",
                        boxShadow: "0 0 30px rgba(220, 38, 38, 0.6)"
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
                    
                    {/* Painterly Fire breath */}
                    <PainterlyFlame />
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
              </motion.div>
            ))}
            
            {/* Sparkle trail effects */}
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={`sparkle-${i}`}
                initial={{ 
                  x: -100 + (i * -30),
                  y: window.innerHeight - 100 + Math.random() * 40,
                  scale: 0,
                  opacity: 0
                }}
                animate={{ 
                  x: window.innerWidth + 100,
                  y: window.innerHeight - 100 + Math.random() * 40,
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                  rotate: 360
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 8,
                  delay: i * 0.2,
                  ease: "easeInOut"
                }}
                className="absolute w-3 h-3"
              >
                <div 
                  className="w-full h-full"
                  style={{
                    background: ["#fbbf24", "#f97316", "#dc2626", "#a855f7"][i % 4],
                    clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
                    boxShadow: `0 0 10px ${["#fbbf24", "#f97316", "#dc2626", "#a855f7"][i % 4]}80`
                  }}
                />
              </motion.div>
            ))}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
