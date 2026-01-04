import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-carnival-dark">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-carnival-red/10 via-transparent to-transparent" />
        <div className="absolute top-10 left-10 text-6xl float-animation">🎪</div>
        <div className="absolute top-20 right-20 text-4xl float-animation" style={{ animationDelay: "0.5s" }}>🎟️</div>
        <div className="absolute bottom-20 left-1/4 text-3xl float-animation" style={{ animationDelay: "1s" }}>✨</div>
        
        <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎪</span>
            <span className="text-xl font-bold text-white">Carnival</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="#about" className="text-gray-300 hover:text-white transition-colors">About</Link>
            <Link href="#rewards" className="text-gray-300 hover:text-white transition-colors">Rewards</Link>
            <Link href="#faq" className="text-gray-300 hover:text-white transition-colors">FAQ</Link>
            <Link
              href="/login"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link 
              href="https://hackclub.slack.com/archives/C091ZRTMF16" 
              className="bg-carnival-red hover:bg-carnival-red/80 text-white px-4 py-2 rounded-full font-medium transition-colors"
            >
              Join #carnival
            </Link>
          </div>
        </nav>

        <div className="relative z-10 max-w-4xl mx-auto text-center px-8 pt-20 pb-32">
          <h1 className="text-6xl md:text-7xl font-bold mb-6">
            <span className="gradient-text">Carnival</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-4">
            🎪 Build an extension, plugin, or widget—add your ride to the midway, light up the wire! 🎟️✨
          </p>
          <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
            Create something amazing for your favorite editor or app. Every hour of coding unlocks <span className="text-carnival-yellow font-semibold">+$5</span> towards your dev environment.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            <Link 
              href="https://airtable.com/app8YP69xF49t7ymq/pagYy7rj2VU5KAIty/form"
              className="bg-carnival-red hover:bg-carnival-red/80 text-white px-8 py-4 rounded-full font-bold text-lg transition-all carnival-glow hover:scale-105"
            >
              Submit Project
            </Link>
            <Link 
              href="https://hackclub.slack.com/archives/C091ZRTMF16"
              className="border-2 border-carnival-purple text-carnival-purple hover:bg-carnival-purple hover:text-white px-8 py-4 rounded-full font-bold text-lg transition-all"
            >
              Join #carnival
            </Link>
          </div>
        </div>
      </header>

      {/* What You Need To Do Section */}
      <section id="about" className="py-20 px-8 bg-carnival-dark">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-12">What you need to do</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {[
              "Build a QOL improvement or solve a real problem you face",
              "Have at least 5 users using your extension",
              "Make the project open-source",
              "Ensure it works properly in your editor of choice",
              "Provide clear build and run instructions",
              "Make it unique — not a remake of an existing extension",
              "Do not remake an existing tool with only minor changes",
              "Do not just build a wrapper around an existing tool or API",
              "Include more than one screenshot of your tool when submitting",
              "Simple plugins are generally not acceptable"
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4 bg-carnival-card p-4 rounded-xl card-glow transition-all">
                <span className="text-carnival-yellow font-bold text-lg">{i + 1}.</span>
                <p className="text-gray-300">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Editors Section */}
      <section className="py-20 px-8 bg-background">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-8">Editors you can build for</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {["VS Code", "Chrome", "Firefox", "Neovim", "Figma", "KiCad", "Godot", "JetBrains", "Obsidian"].map((editor) => (
              <span key={editor} className="bg-carnival-card text-gray-200 px-6 py-3 rounded-full text-lg font-medium hover:bg-carnival-purple/30 transition-colors cursor-default">
                {editor}
              </span>
            ))}
            <span className="bg-carnival-orange/20 text-carnival-orange px-6 py-3 rounded-full text-lg font-medium">
              ...and many more!
            </span>
          </div>
        </div>
      </section>

      {/* Sweet Deals Section */}
      <section id="rewards" className="py-20 px-8 bg-carnival-dark">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-4">Sweet Deals for Submissions</h2>
          <p className="text-gray-400 text-center mb-12">Bonus boosts for standout builds — be original and have fun.</p>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-carnival-card p-8 rounded-2xl text-center card-glow transition-all">
              <div className="text-4xl font-bold text-carnival-yellow mb-4">+$10</div>
              <h3 className="text-xl font-bold text-white mb-2">First on a new editor/app</h3>
              <p className="text-gray-400">Ship the first original extension for an editor/app no one&apos;s hit yet.</p>
            </div>
            
            <div className="bg-carnival-card p-8 rounded-2xl text-center card-glow transition-all">
              <div className="text-4xl font-bold text-carnival-orange mb-4">+$25</div>
              <h3 className="text-xl font-bold text-white mb-2">Goes viral</h3>
              <p className="text-gray-400">Make something people love — think 100+ GitHub ⭐ or 250+ social likes.</p>
            </div>
            
            <div className="bg-carnival-card p-8 rounded-2xl text-center card-glow transition-all">
              <div className="text-4xl font-bold text-carnival-pink mb-4">+$5–$20</div>
              <h3 className="text-xl font-bold text-white mb-2">Wildcard Bonus</h3>
              <p className="text-gray-400">Extra love for wildly creative, funny, or technically impressive builds.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Rewards Section */}
      <section className="py-20 px-8 bg-background">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-4">Rewards</h2>
          <p className="text-gray-400 text-center mb-12">Unlock resources to enhance your dev environment and fuel your next project.</p>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-carnival-card p-8 rounded-2xl">
              <div className="text-3xl mb-4">🎨</div>
              <h3 className="text-xl font-bold text-white mb-4">Creative Tools</h3>
              <ul className="text-gray-400 space-y-2">
                <li>• Procreate license</li>
                <li>• JetBrains IDE license</li>
                <li>• Design tools</li>
                <li>• Cursor Pro</li>
              </ul>
            </div>
            
            <div className="bg-carnival-card p-8 rounded-2xl">
              <div className="text-3xl mb-4">🖥️</div>
              <h3 className="text-xl font-bold text-white mb-4">Hardware & Setup</h3>
              <ul className="text-gray-400 space-y-2">
                <li>• Peripherals</li>
                <li>• Computer upgrades</li>
                <li>• Development hardware</li>
                <li>• Specialty devices</li>
              </ul>
            </div>
            
            <div className="bg-carnival-card p-8 rounded-2xl">
              <div className="text-3xl mb-4">🔑</div>
              <h3 className="text-xl font-bold text-white mb-4">Infrastructure</h3>
              <ul className="text-gray-400 space-y-2">
                <li>• Domain credits</li>
                <li>• Cloud hosting</li>
                <li>• API access</li>
                <li>• Development services</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How to Get Involved */}
      <section className="py-20 px-8 bg-carnival-dark">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-12">How to get involved</h2>
          
          <div className="space-y-6">
            {[
              { step: "1", title: "Join the #carnival channel", desc: "Ask, share, and vibe with the community on Slack" },
              { step: "2", title: "Set up Hackatime", desc: "Start tracking your time to earn grants" },
              { step: "3", title: "Build your extension", desc: "Create a plugin or widget and ship it" },
              { step: "4", title: "Submit for review", desc: "Claim your rewards and get recognized" },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-6 bg-carnival-card p-6 rounded-2xl">
                <div className="w-12 h-12 bg-carnival-red rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{item.title}</h3>
                  <p className="text-gray-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-8 bg-background">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-4">FAQ</h2>
          <p className="text-gray-400 text-center mb-12">Questions by the campfire — answers under the tents.</p>
          
          <div className="space-y-4">
            {[
              { q: "What counts as an extension?", a: "Plugins, add-ons, widgets, or any tool that extends the functionality of an existing app or editor." },
              { q: "How do I track my time?", a: "Use Hackatime to log your coding hours. Every hour unlocks $5 towards dev tools." },
              { q: "Can I work in a team?", a: "Yes! Teams are welcome. Just make sure everyone contributes meaningfully." },
              { q: "What if my editor isn't listed?", a: "You can build for any editor or app. Be the first and earn a bonus!" },
            ].map((item, i) => (
              <details key={i} className="bg-carnival-card rounded-xl group">
                <summary className="p-6 cursor-pointer text-white font-medium text-lg flex items-center justify-between">
                  {item.q}
                  <span className="text-carnival-purple group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="px-6 pb-6 text-gray-400">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-8 bg-carnival-dark border-t border-white/10">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-2xl">🎪</span>
            <span className="text-xl font-bold text-white">The Carnival</span>
          </div>
          <p className="text-gray-400 mb-6">Make something you love.</p>
          <Link 
            href="https://hackclub.slack.com/archives/C091ZRTMF16"
            className="text-carnival-purple hover:text-carnival-pink transition-colors"
          >
            Join Hack Club Slack →
          </Link>
          <p className="text-gray-500 mt-8 text-sm">© 2026 YSWS Carnival by Hack Club.</p>
        </div>
      </footer>
    </div>
  );
}
