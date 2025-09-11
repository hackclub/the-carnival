import { Link } from 'react-router-dom';
import { Home, Search, Zap } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="relative">
            <h1 
              className="text-9xl md:text-[12rem] font-extrabold text-transparent bg-clip-text animate-[gradient-move_3s_ease-in-out_infinite]"
              style={{
                backgroundImage: "linear-gradient(45deg, #f59e0b, #ec4899, #3b82f6, #10b981)",
                backgroundSize: "300% 300%"
              }}
            >
              404
            </h1>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-amber-900 mb-4">
            🎪 Oops! This tent seems to be missing!
          </h2>
          <p className="text-lg text-amber-800 mb-2">
            Looks like this attraction wandered off the midway...
          </p>
          <p className="text-amber-700">
            The carnival generators are humming, but this page got disconnected from the wire! ⚡
          </p>
        </div>

        <div className="mb-8 flex flex-col sm:flex-row gap-4 justify-center items-center">
          <div className="transform transition-transform hover:scale-105 hover:-rotate-1">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-lg ring-1 ring-amber-500/50 transition-colors"
            >
              <Home size={18} />
              Back to the Midway
            </Link>
          </div>
          
          <div className="transform transition-transform hover:scale-105 hover:rotate-1">
            <a
              href="/#explore"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 ring-1 ring-amber-200 transition-colors"
            >
              <Search size={18} />
              Explore Attractions
            </a>
          </div>
        </div>

        <div className="mt-8 p-4 bg-amber-50/80 backdrop-blur rounded-2xl ring-1 ring-amber-200">
          <div className="flex items-center justify-center gap-2 text-amber-800">
            <Zap size={16} className="text-amber-600" />
            <p className="text-sm">
              <strong>Did you know?</strong> Every plugin adds to the carnival's power grid! 
              The more extensions built, the brighter the midway glows! ⚡🎡
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
