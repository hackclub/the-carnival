import React from "react";
import { Heart, Slack } from "lucide-react";

import Logo from "../assets/logo2-slim.png";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const slackJoinUrl = "https://hackclub.com/slack/";

  return (
    <footer className="relative bg-amber-50/80 border-t border-amber-200/60">
      <div className="relative py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 justify-center sm:justify-start text-center sm:text-left w-full sm:w-auto">
                <img src={Logo} width={48} alt="YSWS Carnival" />
                <div>
                  <h3 className="text-xl font-bold text-amber-900">Carnival</h3>
                  <p className="text-xs text-amber-700">YS Editor Plugin</p>
                </div>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 text-amber-800 text-sm text-left sm:text-right">
                  <span>Channel: <span className="font-semibold">#carnival</span></span>
                  <span className="hidden sm:inline text-amber-400">•</span>
                  <span>Organizer: <a href="https://josiasw.dev/" target="_blank"><span className="font-semibold">Josias</span></a></span>
                </div>
                <a
                  href={slackJoinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap w-full sm:w-auto justify-center"
                >
                  <Slack size={16} />
                  Join Hack Club Slack
                </a>
              </div>
            </div>
            <p className="text-amber-800 mt-4 leading-relaxed">
              Drill hours, strike credits.
            </p>
          </div>
          <div className="pt-6 border-t border-amber-200/50">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">
              <p className="text-sm text-amber-700 flex items-center justify-center text-center flex-wrap gap-1">
                <span>© {currentYear} YSWS Carnival.</span>
                <span className="inline-flex items-center gap-1">
                  <span>Made with</span>
                  <Heart className="text-red-500" size={14} fill="currentColor" aria-hidden="true" />
                  <span>for developers</span>
                </span>
              </p>
              <div className="flex items-center gap-3 md:gap-4 text-xs text-amber-600 justify-center md:justify-end flex-wrap">
                <span>Powered by creativity</span>
                <span>Built with React</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
