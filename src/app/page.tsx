import Header from "@/components/Header";
import Link from "next/link";
import { AlertTriangle, Ban, ListChecks, Timer, Users, Wrench } from "lucide-react";
import Countdown from "@/components/landing/Countdown";
import FloatingBalloons from "@/components/landing/FloatingBalloons";
import HeroTypewriter from "@/components/landing/HeroTypewriter";
import LandingCTAButtons from "@/components/landing/LandingCTAButtons";

export default function Home() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <FloatingBalloons />

      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-100/50 via-transparent to-transparent" />
        <div className="absolute top-10 left-10 text-6xl float-animation select-none">🎪</div>
        <div
          className="absolute top-20 right-20 text-4xl float-animation select-none"
          style={{ animationDelay: "0.5s" }}
        >
          🎟️
        </div>
        <div
          className="absolute bottom-20 left-1/4 text-3xl float-animation select-none"
          style={{ animationDelay: "1s" }}
        >
          ✨
        </div>

        <Header />

        <div className="relative z-10 max-w-4xl mx-auto px-6 pt-16 pb-10">
          <div
            role="alert"
            className="mt-8 mb-6 rounded-2xl bg-red-50/90 p-4 ring-1 ring-red-300 shadow-md text-red-900 text-sm md:text-base"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 text-red-600" size={18} />
              <p>
                <span className="font-semibold">Warning:</span> Don’t cheat the time tracking system. No bots, no fake key
                presses, no UI manipulation. If you do, you’ll be banned from Hackatime and other participating
                YSWS/events.
              </p>
            </div>
          </div>

          <div className="text-center">
            <div className="text-3xl md:text-5xl font-extrabold text-amber-900 flex items-center justify-center gap-3">
              <span className="text-amber-900">Carnival</span>
            </div>
            <div className="mt-3 text-2xl md:text-4xl text-amber-900 font-bold">
              <HeroTypewriter />
            </div>

            <div className="text-center pt-8 max-w-3xl mx-auto">
              <p className="text-lg font-semibold text-amber-900">
                🎪 Build an extension, plugin, or widget—add your ride to the midway, light up the wire! 🎟️✨
              </p>
              <p className="mt-2 text-sm md:text-base text-amber-800">
                Every hour of real coding unlocks <span className="font-semibold">+$5</span> towards your dev environment.
              </p>
            </div>

            <LandingCTAButtons />
          </div>
        </div>
      </header>

      <Countdown />

      {/* What You Need To Do Section */}
      <section id="about" className="pt-16 pb-20">
        <div className="mx-auto max-w-7xl px-6 md:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="rounded-2xl bg-white/70 backdrop-blur p-6 ring-1 ring-amber-200 shadow-sm transition-transform will-change-transform hover:-translate-y-0.5">
              <div className="flex items-center gap-2 mb-3">
                <ListChecks className="text-amber-600" size={18} />
                <h3 className="text-lg font-semibold text-amber-900">What you need to do</h3>
              </div>
              <ol className="space-y-2 text-sm text-amber-800 list-decimal pl-5">
                <li className="leading-relaxed">Build a QOL improvement or solve a real problem you face</li>
                <li className="leading-relaxed">Have at least 5 users using your extension</li>
                <li className="leading-relaxed">Make the project open-source</li>
                <li className="leading-relaxed">Ensure it works properly in your editor of choice</li>
                <li className="leading-relaxed">Provide clear build and run instructions</li>
                <li className="leading-relaxed">Make it unique — not a remake of an existing extension</li>
                <li className="leading-relaxed">Do not remake an existing tool with only minor changes</li>
                <li className="leading-relaxed">Do not just build a wrapper around an existing tool or API</li>
                <li className="leading-relaxed">Include more than one screenshot of your tool when submitting</li>
                <li className="leading-relaxed">Simple plugins are generally not acceptable</li>
              </ol>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl bg-white/70 backdrop-blur p-6 ring-1 ring-amber-200 shadow-sm transition-transform will-change-transform hover:-translate-y-0.5">
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="text-amber-600" size={18} />
                  <h3 className="text-lg font-semibold text-amber-900">Editors you can build for</h3>
                </div>
                <ul className="grid grid-cols-2 gap-2 text-sm text-amber-800">
                  {["VS Code", "Chrome", "Firefox", "Neovim", "Figma", "KiCad", "Godot", "Unity"].map((e) => (
                    <li key={e} className="rounded-xl bg-amber-50/60 ring-1 ring-amber-200 px-3 py-2">
                      {e}
                    </li>
                  ))}
                  <li className="rounded-xl bg-amber-50/60 ring-1 ring-amber-200 px-3 py-2">
                    …and more on{" "}
                    <a
                      className="underline underline-offset-2 decoration-amber-300 hover:decoration-amber-500"
                      href="/editors"
                    >
                      /editors
                    </a>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl bg-white/70 backdrop-blur p-6 ring-1 ring-amber-200 shadow-sm transition-transform will-change-transform hover:-translate-y-0.5">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="text-amber-600" size={18} />
                  <h3 className="text-lg font-semibold text-amber-900">How to get involved</h3>
                </div>
                <ol className="space-y-2 text-sm text-amber-800 list-decimal pl-5">
                  <li>Join the <span className="font-semibold">#carnival</span> channel on Slack to ask, share, and vibe</li>
                  <li>Set up Hackatime and start tracking your time</li>
                  <li>Build your extension, plugin, or widget and ship it</li>
                  <li>Submit your project for review and claim rewards</li>
                </ol>

                <div className="mt-3 text-xs text-amber-700 flex items-center gap-2">
                  <Timer size={14} className="text-amber-600" />
                  <span>Every hour of coding unlocks +$5 towards your dev environment.</span>
                </div>
                <div className="mt-2 text-xs text-amber-700 flex items-center gap-2">
                  <Ban size={14} className="text-amber-600" />
                  <span>No trivial remixes or thin wrappers.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Editors Section */}
      <section className="py-20 px-8 bg-background">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-foreground mb-8">Editors you can build for</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {["VS Code", "Chrome", "Firefox", "Neovim", "Figma", "KiCad", "Godot", "JetBrains", "Obsidian"].map((editor) => (
              <span key={editor} className="bg-card border border-border text-foreground px-6 py-3 rounded-full text-lg font-medium hover:bg-muted transition-colors cursor-default">
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
      <section id="rewards" className="py-20 px-8 bg-muted">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-foreground text-center mb-4">Sweet Deals for Submissions</h2>
          <p className="text-muted-foreground text-center mb-12">Bonus boosts for standout builds — be original and have fun.</p>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-card border border-border p-8 rounded-2xl text-center card-glow transition-all">
              <div className="text-4xl font-bold text-carnival-yellow mb-4">+$10</div>
              <h3 className="text-xl font-bold text-foreground mb-2">First on a new editor/app</h3>
              <p className="text-muted-foreground">Ship the first original extension for an editor/app no one&apos;s hit yet.</p>
            </div>
            
            <div className="bg-card border border-border p-8 rounded-2xl text-center card-glow transition-all">
              <div className="text-4xl font-bold text-carnival-orange mb-4">+$25</div>
              <h3 className="text-xl font-bold text-foreground mb-2">Goes viral</h3>
              <p className="text-muted-foreground">Make something people love — think 100+ GitHub ⭐ or 250+ social likes.</p>
            </div>
            
            <div className="bg-card border border-border p-8 rounded-2xl text-center card-glow transition-all">
              <div className="text-4xl font-bold text-carnival-pink mb-4">+$5–$20</div>
              <h3 className="text-xl font-bold text-foreground mb-2">Wildcard Bonus</h3>
              <p className="text-muted-foreground">Extra love for wildly creative, funny, or technically impressive builds.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Rewards Section */}
      <section className="py-20 px-8 bg-background">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-foreground text-center mb-4">Rewards</h2>
          <p className="text-muted-foreground text-center mb-12">Unlock resources to enhance your dev environment and fuel your next project.</p>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-card border border-border p-8 rounded-2xl">
              <div className="text-3xl mb-4">🎨</div>
              <h3 className="text-xl font-bold text-foreground mb-4">Creative Tools</h3>
              <ul className="text-muted-foreground space-y-2">
                <li>• Procreate license</li>
                <li>• JetBrains IDE license</li>
                <li>• Design tools</li>
                <li>• Cursor Pro</li>
              </ul>
            </div>
            
            <div className="bg-card border border-border p-8 rounded-2xl">
              <div className="text-3xl mb-4">🖥️</div>
              <h3 className="text-xl font-bold text-foreground mb-4">Hardware & Setup</h3>
              <ul className="text-muted-foreground space-y-2">
                <li>• Peripherals</li>
                <li>• Computer upgrades</li>
                <li>• Development hardware</li>
                <li>• Specialty devices</li>
              </ul>
            </div>
            
            <div className="bg-card border border-border p-8 rounded-2xl">
              <div className="text-3xl mb-4">🔑</div>
              <h3 className="text-xl font-bold text-foreground mb-4">Infrastructure</h3>
              <ul className="text-muted-foreground space-y-2">
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
      <section className="py-20 px-8 bg-muted">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-foreground text-center mb-12">How to get involved</h2>
          
          <div className="space-y-6">
            {[
              { step: "1", title: "Join the #carnival channel", desc: "Ask, share, and vibe with the community on Slack" },
              { step: "2", title: "Set up Hackatime", desc: "Start tracking your time to earn grants" },
              { step: "3", title: "Build your extension", desc: "Create a plugin or widget and ship it" },
              { step: "4", title: "Submit for review", desc: "Claim your rewards and get recognized" },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-6 bg-card border border-border p-6 rounded-2xl">
                <div className="w-12 h-12 bg-carnival-red rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-8 bg-background">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-foreground text-center mb-4">FAQ</h2>
          <p className="text-muted-foreground text-center mb-12">Questions by the campfire — answers under the tents.</p>
          
          <div className="space-y-4">
            {[
              { q: "What counts as an extension?", a: "Plugins, add-ons, widgets, or any tool that extends the functionality of an existing app or editor." },
              { q: "How do I track my time?", a: "Use Hackatime to log your coding hours. Every hour unlocks $5 towards dev tools." },
              { q: "Can I work in a team?", a: "Yes! Teams are welcome. Just make sure everyone contributes meaningfully." },
              { q: "What if my editor isn't listed?", a: "You can build for any editor or app. Be the first and earn a bonus!" },
            ].map((item, i) => (
              <details key={i} className="bg-card border border-border rounded-xl group">
                <summary className="p-6 cursor-pointer text-foreground font-medium text-lg flex items-center justify-between">
                  {item.q}
                  <span className="text-carnival-blue group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="px-6 pb-6 text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-8 bg-amber-50/60 border-t border-amber-200/60">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-2xl">🎪</span>
            <span className="text-xl font-bold text-amber-900">The Carnival</span>
          </div>
          <p className="text-amber-800 mb-6">Make something you love.</p>
          <Link 
            href="https://hackclub.slack.com/archives/C091ZRTMF16"
            className="text-amber-800 hover:text-amber-900 transition-colors underline underline-offset-4 decoration-amber-300 hover:decoration-amber-500"
          >
            Join Hack Club Slack →
          </Link>
          <p className="text-amber-700 mt-8 text-sm">© 2026 YSWS Carnival by Hack Club.</p>
        </div>
      </footer>
    </div>
  );
}
