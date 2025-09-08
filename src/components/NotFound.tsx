import { motion } from "framer-motion";
import { HashLink } from 'react-router-hash-link';
import { Home, Search, Zap } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-2xl mx-auto">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-8"
        >
          <div className="relative">
            <motion.h1 
              className="text-9xl md:text-[12rem] font-extrabold text-transparent bg-clip-text"
              style={{
                backgroundImage: "linear-gradient(45deg, #f59e0b, #ec4899, #3b82f6, #10b981)",
                backgroundSize: "300% 300%"
              }}
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              404
            </motion.h1>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-8"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-amber-900 mb-4">
            🎪 Oops! This tent seems to be missing!
          </h2>
          <p className="text-lg text-amber-800 mb-2">
            Looks like this attraction wandered off the midway...
          </p>
          <p className="text-amber-700">
            The carnival generators are humming, but this page got disconnected from the wire! ⚡
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mb-8"
        >
          <svg
            width="200"
            height="150"
            viewBox="0 0 200 150"
            className="mx-auto drop-shadow-lg"
          >
            <defs>
              <linearGradient id="tentGrad" x1="0" x2="1">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
              <filter id="tentGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            
            <rect x="20" y="130" width="160" height="8" fill="#f5deb3" opacity="0.6" />
            
            <motion.g 
              animate={{ y: [0, -3, 0] }} 
              transition={{ duration: 4, repeat: Infinity }}
            >
              <polygon 
                points="50,130 100,50 150,130" 
                fill="url(#tentGrad)" 
                stroke="#92400e" 
                strokeWidth="2"
                filter="url(#tentGlow)"
              />
              <polygon points="100,50 100,130 50,130" fill="#fff7ed" opacity="0.6" />
              <path d="M100 50 L100 130 L120 130 Z" fill="#fde68a" opacity="0.8" />
            </motion.g>
            
            <motion.g 
              animate={{ rotate: [0, 5, -5, 0] }} 
              transition={{ duration: 3, repeat: Infinity }}
              style={{ transformOrigin: "100px 35px" }}
            >
              <line x1="100" y1="30" x2="100" y2="50" stroke="#92400e" strokeWidth="2" />
              <path d="M100 30 L130 35 L100 50 Z" fill="#ec4899" />
              <text x="115" y="42" fill="white" fontSize="16" fontWeight="bold">?</text>
            </motion.g>
            
            <motion.path
              d="M0,20 Q50,30 100,25 Q150,20 200,25"
              stroke="#374151"
              strokeWidth="3"
              fill="none"
              strokeDasharray="10,5"
              animate={{
                strokeDashoffset: [0, -30]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear"
              }}
            />
            
            <motion.g>
              {Array.from({ length: 4 }).map((_, i) => (
                <motion.circle
                  key={i}
                  cx="100"
                  cy="25"
                  r="2"
                  fill="#fbbf24"
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 0],
                    x: [0, (Math.random() - 0.5) * 20],
                    y: [0, (Math.random() - 0.5) * 20]
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                />
              ))}
            </motion.g>
          </svg>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <motion.div whileHover={{ scale: 1.05, rotate: [-1, 1, -1, 0], transition: { duration: 0.3 } }}>
            <HashLink
              to="/"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-lg ring-1 ring-amber-500/50 transition-colors"
            >
              <Home size={18} />
              Back to the Midway
            </HashLink>
          </motion.div>
          
          <motion.div whileHover={{ scale: 1.05, rotate: [1, -1, 1, 0], transition: { duration: 0.3 } }}>
            <HashLink
              to="/#explore"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 ring-1 ring-amber-200 transition-colors"
            >
              <Search size={18} />
              Explore Attractions
            </HashLink>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="mt-8 p-4 bg-amber-50/80 backdrop-blur rounded-2xl ring-1 ring-amber-200"
        >
          <div className="flex items-center justify-center gap-2 text-amber-800">
            <Zap size={16} className="text-amber-600" />
            <p className="text-sm">
              <strong>Did you know?</strong> Every plugin adds to the carnival's power grid! 
              The more extensions built, the brighter the midway glows! ⚡🎡
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
