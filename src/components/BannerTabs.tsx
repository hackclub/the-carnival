import { useState } from "react";

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface BannerTabsProps {
  tabs: Tab[];
  defaultTab?: string;
}

export default function BannerTabs({ tabs, defaultTab }: BannerTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  return (
    <div className="w-full">
      <div className="relative flex justify-center items-end gap-2 mb-8">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-800 to-transparent opacity-60" />
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-600 to-transparent" />
        
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="relative group transform transition-transform hover:-translate-y-0.5 active:scale-95"
          >
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <div className="w-0.5 h-4 bg-amber-800 rounded-full" />
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-amber-700 rounded-full" />
            </div>
            
            <div className="relative">
              <svg
                width="120"
                height="60"
                viewBox="0 0 120 60"
                className="drop-shadow-md"
              >
                <defs>
                  <linearGradient id={`bannerGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={activeTab === tab.id ? "#fbbf24" : "#f3f4f6"} />
                    <stop offset="50%" stopColor={activeTab === tab.id ? "#f59e0b" : "#e5e7eb"} />
                    <stop offset="100%" stopColor={activeTab === tab.id ? "#d97706" : "#d1d5db"} />
                  </linearGradient>
                  <filter id={`bannerShadow-${index}`} x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="2" dy="3" stdDeviation="2" floodOpacity="0.3" />
                  </filter>
                </defs>
                
                <path
                  d="M10,5 L110,5 L110,40 L105,45 L100,40 L95,45 L90,40 L85,45 L80,40 L75,45 L70,40 L65,45 L60,40 L55,45 L50,40 L45,45 L40,40 L35,45 L30,40 L25,45 L20,40 L15,45 L10,40 Z"
                  fill={`url(#bannerGrad-${index})`}
                  stroke={activeTab === tab.id ? "#92400e" : "#9ca3af"}
                  strokeWidth="1"
                  filter={`url(#bannerShadow-${index})`}
                />
                
                <line x1="15" y1="10" x2="105" y2="10" stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
                <line x1="15" y1="20" x2="105" y2="20" stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
                <line x1="15" y1="30" x2="105" y2="30" stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
              </svg>
              
              <div className="absolute inset-0 flex items-center justify-center pt-2">
                <span className={`text-sm font-semibold transition-colors ${
                  activeTab === tab.id 
                    ? "text-amber-900" 
                    : "text-gray-600 group-hover:text-gray-800"
                }`}>
                  {tab.label}
                </span>
              </div>
            </div>
            
            <div className="absolute -bottom-1 left-2">
              <div className="w-1 h-1 bg-amber-800 rounded-full" />
            </div>
            <div className="absolute -bottom-1 right-2">
              <div className="w-1 h-1 bg-amber-800 rounded-full" />
            </div>
          </button>
        ))}
      </div>

      <div
        key={activeTab}
        className="bg-white/70 backdrop-blur rounded-2xl p-6 ring-1 ring-amber-200 shadow-sm transition-all"
      >
        {activeTabData?.content}
      </div>
    </div>
  );
}

export function LandingBannerTabs() {
  const exampleTabs: Tab[] = [
    {
      id: "getting-started",
      label: "Get Started",
      content: (
        <div>
          <h3 className="text-lg font-semibold text-amber-900 mb-3">Welcome to the Plugin Carnival!</h3>
          <p className="text-amber-800 mb-3">
            Step right up and join the YSWS Carnival! This is where developers build amazing plugins and extensions 
            for their favorite platforms and earn rewards to enhance their dev environment.
          </p>
          <div className="bg-amber-50 rounded-lg p-4 mt-4">
            <h4 className="font-semibold text-amber-900 mb-2">Popular Platforms:</h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-amber-800">
              <div>• VS Code</div>
              <div>• Chrome/Firefox</div>
              <div>• Slack</div>
              <div>• KiCad</div>
              <div>• Figma</div>
              <div>• IntelliJ IDEA</div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "rules",
      label: "Rules",
      content: (
        <div>
          <h3 className="text-lg font-semibold text-amber-900 mb-3">Plugin Development Rules</h3>
          <ul className="space-y-2 text-amber-800 list-disc pl-5">
            <li>Build a plugin/extension for VS Code, Chrome, Slack, KiCad, or other platforms</li>
            <li>Get at least 10 users to try your plugin and share feedback</li>
            <li>Open-source your work so others can learn from it</li>
            <li>Include clear installation and usage instructions</li>
            <li>Track at least 15 hours with Hackatime</li>
            <li>Avoid minor remixes and simple wrappers</li>
          </ul>
          <div className="bg-blue-50 rounded-lg p-4 mt-4">
            <p className="text-blue-800 text-sm">
              <strong>💡 Want to target a different platform?</strong> Suggest it and we'll consider adding it to the approved list!
            </p>
          </div>
        </div>
      )
    },
    {
      id: "rewards",
      label: "Rewards",
      content: (
        <div>
          <h3 className="text-lg font-semibold text-amber-900 mb-3">Dev Environment Rewards</h3>
          <p className="text-amber-800 mb-3">
            Every hour of coding unlocks +$5 towards anything that improves your development setup:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="font-semibold text-amber-900">Dev Environment</div>
              <div className="text-sm text-amber-700">AI credits, hardware, software licenses</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="font-semibold text-amber-900">Project Resources</div>
              <div className="text-sm text-amber-700">Hosting, domains, databases, analytics</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="font-semibold text-amber-900">Learning & Growth</div>
              <div className="text-sm text-amber-700">Courses, conferences, books, mentorship</div>
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 mt-4">
            <p className="text-green-800 text-sm">
              <strong>🎯 Flexible rewards:</strong> We work with you to find resources that actually help your development journey!
            </p>
          </div>
        </div>
      )
    }
  ];

  return <BannerTabs tabs={exampleTabs} defaultTab="getting-started" />;
}
