import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

import Logo from "../assets/logo2-slim.png";

// Genie assets moved to Layout

// Nav links removed per request

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative z-40">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden">
        <svg
          className="w-full h-48 md:h-56"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="sandGrad" x1="0" x2="1">
              <stop offset="0%" stopColor="#fee2e2" />
              <stop offset="40%" stopColor="#fbcfe8" />
              <stop offset="75%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d="M0,64L48,80C96,96,192,128,288,154.7C384,181,480,203,576,192C672,181,768,139,864,138.7C960,139,1056,181,1152,186.7C1248,192,1344,160,1392,144L1440,128L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"
            fill="url(#sandGrad)"
            opacity="0.95"
            filter="url(#softGlow)"
          />
        </svg>
      </div>

      <nav
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        aria-label="Top navigation"
      >
        <div className="flex w-full items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <img src={Logo} width={60} />

            <div>
              <a
                href="/"
                className="block text-lg font-semibold leading-5 text-amber-900"
              >
                The Carnival
              </a>
              
            </div>
          </div>

          <div className="hidden md:flex md:items-center md:space-x-6" />

          <div className="flex items-center gap-3">
            <div className="md:hidden">
              <button
                onClick={() => setOpen((o) => !o)}
                aria-label={open ? "Close menu" : "Open menu"}
                className="rounded-lg bg-white/60 p-2 ring-1 ring-amber-100 backdrop-blur"
              >
                {open ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Ask input moved to floating button in Layout */}

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="md:hidden"
            >
              <div className="mt-3 space-y-3 rounded-2xl bg-white/75 p-4 shadow-lg ring-1 ring-amber-100 backdrop-blur">
                {/* No mobile nav items */}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <div className="h-6 w-full bg-gradient-to-b from-transparent to-amber-50/80" />
    </header>
  );
}
