import { Outlet } from "react-router-dom";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import { Toaster } from "react-hot-toast";
import CursorTrail from "./components/CursorTrail";
import Fireworks from "./components/Fireworks";
import FloatingBalloons from "./components/FloatingBalloons";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import Genei from "./assets/genei.webp";
import GenieChat from "./components/GenieChat";

const Layout = () => {
  const [askOpen, setAskOpen] = useState(false);

  return (
    <>
      <CursorTrail />
      <FloatingBalloons />
      <Fireworks />
      <Navbar />
      <div className="sparkles">
        <Outlet />
      </div>

      {/* Floating Ask Genie Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <motion.button
          onClick={() => setAskOpen((v) => !v)}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.05 }}
          className="rounded-full shadow-lg ring-1 ring-amber-200 bg-white/90 backdrop-blur px-3 py-2 flex items-center gap-2"
          aria-expanded={askOpen}
          aria-label="Ask the Genie"
        >
          <img src={Genei} alt="Genei" width={28} />
          <span className="text-sm font-medium text-amber-900 hidden sm:inline">Ask</span>
        </motion.button>
      </div>

      <AnimatePresence>
        {askOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={() => setAskOpen(false)}
          >
            <div className="absolute inset-0 bg-black/10" />
          </motion.div>
        )}
      </AnimatePresence>

      <GenieChat isOpen={askOpen} onClose={() => setAskOpen(false)} headerIconSrc={Genei} />

      <Footer />
      <Toaster position="bottom-center" />
    </>
  );
};

export default Layout;
