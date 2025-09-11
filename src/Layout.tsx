import { Outlet } from "react-router-dom";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import { Toaster } from "react-hot-toast";
import CursorTrail from "./components/CursorTrail";
import Fireworks from "./components/Fireworks";
import FloatingBalloons from "./components/FloatingBalloons";
import { useEffect, useState } from "react";
import Genei from "./assets/genei.webp";
import GenieChat from "./components/GenieChat";

const Layout = () => {
  const [askOpen, setAskOpen] = useState(false);
  const [showCursorTrail, setShowCursorTrail] = useState(false);

  useEffect(() => {
    const mReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mPointer = window.matchMedia('(pointer: fine)');
    const mDesktop = window.matchMedia('(min-width: 768px)');

    const update = () => {
      setShowCursorTrail(!mReduce.matches && mPointer.matches && mDesktop.matches);
    };

    update();
    mReduce.addEventListener?.('change', update);
    mPointer.addEventListener?.('change', update);
    mDesktop.addEventListener?.('change', update);
    return () => {
      mReduce.removeEventListener?.('change', update);
      mPointer.removeEventListener?.('change', update);
      mDesktop.removeEventListener?.('change', update);
    };
  }, []);

  return (
    <>
      {showCursorTrail && <CursorTrail />}
      <FloatingBalloons />
      <Fireworks />
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
          <div className="flex items-center justify-between px-4 py-3 md:px-5 md:py-4 border-b border-amber-200/70 bg-gradient-to-b from-amber-50/80 to-transparent md:rounded-t-3xl">
            <div className="flex items-center gap-2">
              <img src={Genei} alt="Genie" className="w-8 h-8 rounded-full ring-2 ring-amber-300" />
              <div className="text-amber-900 font-semibold">Genie</div>
            </div>
            <button
              className="p-2 rounded-full hover:bg-amber-100 text-amber-800"
              onClick={() => setAskOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <GenieChat isOpen={askOpen} onClose={() => setAskOpen(false)} headerIconSrc={Genei} />
        </div>
      </div>

      <Footer />
      <Toaster position="bottom-center" />
    </>
  );
};

export default Layout;
