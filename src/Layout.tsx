import { Outlet } from "react-router-dom";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import { Toaster } from "react-hot-toast";
import Fireworks from "./components/Fireworks";
import FloatingBalloons from "./components/FloatingBalloons";
import FireDragon from "./components/FireDragon";
import { useState } from "react";
import Genei from "./assets/genei.webp";
import GenieChat from "./components/GenieChat";

const Layout = () => {
  const [askOpen, setAskOpen] = useState(false);
  // CursorTrail removed to reduce JS-driven animations

  // Removed effect that conditionally showed CursorTrail

  return (
    <>
      {/* CursorTrail removed */}
      <FloatingBalloons />
      <Fireworks />
      <FireDragon />
      <Navbar />
      <div className="sparkles">
        <Outlet />
      </div>

      {/* Floating Ask Genie Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setAskOpen((v) => !v)}
          className="rounded-full shadow-lg ring-1 ring-amber-200 bg-white/90 backdrop-blur px-3 py-2 flex items-center gap-2 transition-transform active:scale-95 hover:scale-105"
          aria-expanded={askOpen}
          aria-label="Ask the Genie"
        >
          <img src={Genei} alt="Genei" width={28} />
          <span className="text-sm font-medium text-amber-900 hidden sm:inline">Ask</span>
        </button>
      </div>

      {askOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setAskOpen(false)}
        >
          <div className="absolute inset-0 bg-black/10" />
        </div>
      )}

      <div className={`fixed inset-0 z-50 flex items-end md:items-center justify-center ${askOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} bg-black/20 backdrop-blur-[2px] chat-overlay`}>
        <div
          className={`relative w-full md:w-[28rem] lg:w-[32rem] mx-auto md:rounded-3xl bg-white/90 backdrop-blur-md ring-1 ring-amber-200 shadow-xl md:mb-0 mb-4 transform ${askOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} chat-panel`}
          onClick={(e) => e.stopPropagation()}
        >
          <GenieChat isOpen={askOpen} onClose={() => setAskOpen(false)} headerIconSrc={Genei} />
        </div>
      </div>

      <Footer />
      <Toaster position="bottom-center" />
    </>
  );
};

export default Layout;
