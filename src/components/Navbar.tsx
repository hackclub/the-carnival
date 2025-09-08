import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Search, Send } from "lucide-react";
import { HashLink } from 'react-router-hash-link';

import Logo from "../assets/logo2-slim.png";

import Genei from "../assets/genei.gif";

type NavLink = {
  label: string;
  href: string;
};

const NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/#home" },
  { label: "Explore", href: "/#explore" },
  { label: "Rewards", href: "/#rewards" },
  { label: "FAQ", href: "/#faq" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [askOpen, setaskOpen] = useState(false);

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
              <stop offset="0%" stopColor="#fff8f0" />
              <stop offset="50%" stopColor="#ffe7c2" />
              <stop offset="100%" stopColor="#ffd8a8" />
            </linearGradient>
          </defs>
          <path
            d="M0,64L48,80C96,96,192,128,288,154.7C384,181,480,203,576,192C672,181,768,139,864,138.7C960,139,1056,181,1152,186.7C1248,192,1344,160,1392,144L1440,128L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"
            fill="url(#sandGrad)"
            opacity="0.95"
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
                Carnival
              </a>
              <p className="text-xs text-amber-700/80">
                YS editor plugin
                <br />
                WS upgrades for your Dev ENV
              </p>
            </div>
          </div>

          <div className="hidden md:flex md:items-center md:space-x-6">
            {NAV_LINKS.map((link) => (
              <HashLink
                key={link.href}
                to={link.href}
                className="group relative rounded-full px-3 py-2 text-sm font-medium text-amber-900/95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                <span className="relative z-10">{link.label}</span>
                <span className="absolute left-0 right-0 bottom-0 z-0 h-0.5 scale-x-0 transform bg-amber-400 transition-transform group-hover:scale-x-100" />
              </HashLink>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/submit"
              className="hidden md:inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium bg-amber-50 ring-1 ring-amber-100"
            >
              <Send size={16} />
              <span className="text-amber-900">Submit</span>
            </a>
            <div className="hidden md:flex md:items-center">
              <motion.button
                onClick={() => setaskOpen((s) => !s)}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium shadow-sm ring-1 ring-amber-100 bg-white/60 backdrop-blur"
                aria-expanded={askOpen}
              >
                <img src={Genei} alt="Genei" width={30} />
                <span className="text-amber-900">Ask</span>
              </motion.button>
            </div>

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

        <AnimatePresence>
          {askOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="mt-2 flex w-full items-center justify-center"
            >
              <div className="w-full max-w-2xl rounded-2xl bg-white/70 p-2 shadow-lg backdrop-blur ring-1 ring-amber-100">
                <input
                  autoFocus
                  className="w-full rounded-lg border-0 bg-transparent px-4 py-2 text-sm placeholder:italic placeholder:text-amber-700/60 focus:outline-none"
                  placeholder="Ask the Genie anything about the YSWS ..."
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                {NAV_LINKS.map((link) => (
                  <HashLink
                    key={link.href}
                    to={link.href}
                    className="block rounded-lg px-3 py-2 text-base font-medium text-amber-900/95"
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </HashLink>
                ))}
                <a href="/profile" className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 ring-amber-100 bg-white/60">
                <Send size={16} />
                <span>Submit</span>
                </a>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <motion.button
                    className="flex-1 rounded-full px-4 py-2 text-sm font-medium ring-1 ring-amber-100 bg-amber-50 flex items-center"
                    onClick={() => setaskOpen((s) => !s)}
                    whileTap={{ scale: 0.95 }}
                  >
                    <img src={Genei} alt="Genei" width={30} />
                    <span className="ml-2">Ask</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <div className="h-6 w-full bg-gradient-to-b from-transparent to-amber-50/80" />
    </header>
  );
}
