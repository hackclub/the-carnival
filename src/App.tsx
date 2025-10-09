import Typewriter from "typewriter-effect";
import Reveal from "./components/Reveal";
import { Wrench, Users, Timer, Ban, ListChecks, Chrome, Figma, Code2, Thermometer, Snowflake, Video, Smartphone, Sword, Gem, Sparkles } from "lucide-react";
import TentCard from "./components/TentCard";
import FaqTent from "./components/FAQCard";
import Logo from "./assets/logo2-slim.webp";
import Countdown from "./components/Countdown";

function App() {
  const slackJoinUrl = "https://hackclub.slack.com/archives/C091ZRTMF16";
  const submissionUrl = "https://airtable.com/app8YP69xF49t7ymq/pagYy7rj2VU5KAIty/form";
  const EditorLogo = ({ src, letter }: { src?: string; letter: string }) => (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm overflow-hidden ring-1 ring-amber-200 bg-white">
      {src ? (
        <img src={src} alt="" role="presentation" loading="lazy" decoding="async" className="h-full w-full object-contain" />
      ) : (
        <span className="text-[10px] font-semibold text-amber-800">{letter}</span>
      )}
    </span>
  );
  return (
    <>
      <section id="home" className="pt-20 flex flex-col">
        <div className="text-3xl md:text-5xl font-extrabold text-center">
          <div className="mb-2 flex items-center justify-center gap-3">
            <img src={Logo} alt="The Carnival logo" className="h-8 md:h-12 w-auto" width={96} height={48} loading="eager" />
            <span className="text-amber-900">Carnival</span>
          </div>
          <div className="text-2xl md:text-4xl">
          <Typewriter
            options={{
              strings: [
                "Figma: Palette Crossfade — live theme morphs",
                "VS Code: Questline — turn TODOs/tests into quests",
                "Chrome: Tone Tuner — soften comment drafts",
                "Godot/Unity: ReelBuilder — instantly export vertical gameplay highlights for TikTok",
                "KiCad: Badge Forge — auto‑generate PCB name tags",
              ],
              autoStart: true,
              loop: true,
            }}
          />
          </div>
        </div>
        <div className="text-center pt-10 max-w-4xl mx-auto">
          <p className="text-lg font-semibold text-amber-900">
            🎪 Build an extension, plugin, or widget—add your ride to the midway, light up the wire! 🎟️✨
          </p>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <div className="transform transition-transform hover:scale-105 hover:-rotate-1">
            <a
              aria-label="Submit project"
              target="_blank" 
              href={submissionUrl}
              className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-sm ring-1 ring-amber-500/50 transition-colors"
            >
              Submit project
            </a>
          </div>
          <div className="transform transition-transform hover:scale-105 hover:rotate-1">
            <a
              aria-label="Join #carnival on Slack"
              href={slackJoinUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 ring-1 ring-amber-200 transition-colors"
            >
              Join #carnival
            </a>
          </div>
        </div>
      </section>

      <Countdown />

      <section id="explore" className="mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* What you need to do */}
            <div
              className="rounded-2xl bg-white/70 backdrop-blur p-6 ring-1 ring-amber-200 shadow-sm transform transition-all hover:-translate-y-0.5"
            >
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
                <li className="leading-relaxed">Simple plugins are generally not acceptable. If you’re unsure, ask in <a href={slackJoinUrl} target="_blank" rel="noreferrer">#carnival</a> on Slack</li>
              </ol>
            </div>

            {/* Tools and How to join */}
            <div className="space-y-6">
              <div
                className="rounded-2xl bg-white/70 backdrop-blur p-6 ring-1 ring-amber-200 shadow-sm transform transition-all hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="text-amber-600" size={18} />
                  <h3 className="text-lg font-semibold text-amber-900">Editors you can build for</h3>
                </div>
                <ul className="grid grid-cols-2 gap-2 text-sm text-amber-800">
                  <li className="flex items-center gap-2">
                    <a href="https://code.visualstudio.com/api/get-started/your-first-extension" target="_blank" rel="noreferrer">
                      <EditorLogo src="/vscode.webp" letter="V" /> VS Code
                    </a>
                  </li>
                  <li className="flex items-center gap-2">
                    <EditorLogo src="/chrome.webp" letter="C" />
                    <a href="https://developer.chrome.com/docs/extensions/get-started?hl=ar" target="_blank" rel="noreferrer">Chrome</a>
                    /
                    <a href="https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Your_first_WebExtension" target="_blank" rel="noreferrer">Firefox</a>
                  </li>
                  <li className="flex items-center gap-2">
                    <EditorLogo src="/neovim.svg" letter="N" />
                    <a href="https://adam-drake-frontend-developer.medium.com/how-to-build-a-simple-neovim-plugin-0763e7593b07" target="_blank" rel="noreferrer">Neovim</a>
                  </li>
                  <li className="flex items-center gap-2">
                    <EditorLogo src="/figma.webp" letter="F" />
                    <a href="https://www.figma.com/plugin-docs/plugin-quickstart-guide/" target="_blank" rel="noreferrer">Figma</a>
                  </li>
                  <li className="flex items-center gap-2">
                    <EditorLogo src="https://dev-docs.kicad.org/favicon-96x96.png" letter="K" />
                    <a href="https://dev-docs.kicad.org/en/addons/" target="_blank" rel="noreferrer">KiCad</a>
                  </li>
                  <li className="flex items-center gap-2">...and many more</li>
                </ul>
              </div>

              <div
                className="rounded-2xl bg-white/70 backdrop-blur p-6 ring-1 ring-amber-200 shadow-sm transform transition-all hover:-translate-y-0.5"
              >
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

      <section id="rewards" className="mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl md:text-3xl font-extrabold text-amber-900">Rewards</h2>
            <p className="mt-2 text-amber-800">Unlock resources to enhance your dev environment and fuel your next project.</p>
            <p className="mt-1 text-sm text-amber-700">These are just examples — you can get anything that helps your development journey!</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <TentCard
              title="Creative Tools"
              description="Software and licenses that spark your next breakthrough."
              items={["Procreate license 🎨", "JetBrains IDE license", "Design tools", "Cursor Pro"]}
              accentHex="#f59e0b"
            />
            <TentCard
              title="Hardware & Setup"
              description="Devices and upgrades to supercharge your workspace."
              items={["Peripherals 🖥️⌨️🖱️", "Computer upgrades", "Development hardware", "Specialty devices"]}
              accentHex="#fbbf24"
            />
            <TentCard
              title="Infrastructure"
              description="The digital foundation for your projects and ideas."
              items={["Domain credits 🔑", "Cloud hosting", "API access", "Development services"]}
              accentHex="#d97706"
            />
          </div>

          <div className="text-center mt-6">
            <a
              href="/upgrades"
              className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 ring-1 ring-amber-200 transition-colors"
            >
              View full gallery →
            </a>
          </div>
        </div>
      </section>

      <section id="inspiration" className="mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-extrabold text-amber-900">💡 Need Inspiration?</h2>
            <p className="mt-2 text-amber-800">Ideas to get your creative gears turning</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Browser Extension Card */}
            <Reveal
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-50 via-orange-50 to-blue-50 backdrop-blur p-6 ring-1 ring-red-200/50 shadow-lg hover:shadow-xl transition-all duration-300"
              hoverLift
              delaySec={0}
            >
              {/* Background decoration */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br from-red-400/20 to-orange-400/20 rounded-full blur-xl group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full blur-xl group-hover:scale-110 transition-transform duration-500" />
              
              {/* Header with icons */}
              <div className="relative flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-lg">
                    <Thermometer size={20} />
                  </div>
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg">
                    <Snowflake size={20} />
                  </div>
                </div>
                <Chrome size={24} className="text-amber-700 ml-auto" />
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-amber-900 transition-colors">
                Tone Tuner
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed mb-4">
                Transform spicy text into chill rephrases with cognitive-bias insights. Keep your point, lose the heat.
              </p>
              
              {/* Tech stack badges */}
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Browser Extension</span>
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">NLP</span>
              </div>
            </Reveal>

            {/* Figma Plugin Card */}
            <Reveal
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 backdrop-blur p-6 ring-1 ring-purple-200/50 shadow-lg hover:shadow-xl transition-all duration-300"
              hoverLift
              delaySec={0.1}
            >
              {/* Background decoration */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-xl group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-br from-orange-400/20 to-yellow-400/20 rounded-full blur-xl group-hover:scale-110 transition-transform duration-500" />
              
              {/* Header with icons */}
              <div className="relative flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg">
                    <Video size={20} />
                  </div>
                  <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-500 text-white shadow-lg">
                    <Smartphone size={20} />
                  </div>
                </div>
                <Figma size={24} className="text-amber-700 ml-auto" />
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-amber-900 transition-colors">
                ReelBuilder
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed mb-4">
                Convert design flows into viral 12-15s teasers with captions and swipe sounds for TikTok & Shorts.
              </p>
              
              {/* Tech stack badges */}
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">Figma Plugin</span>
                <span className="px-2 py-1 text-xs font-medium bg-pink-100 text-pink-700 rounded-full">Video Gen</span>
              </div>
            </Reveal>

            {/* VS Code Extension Card */}
            <Reveal
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-purple-50 backdrop-blur p-6 ring-1 ring-emerald-200/50 shadow-lg hover:shadow-xl transition-all duration-300"
              hoverLift
              delaySec={0.2}
            >
              {/* Background decoration */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br from-emerald-400/20 to-teal-400/20 rounded-full blur-xl group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-br from-purple-400/20 to-violet-400/20 rounded-full blur-xl group-hover:scale-110 transition-transform duration-500" />
              
              {/* Header with icons */}
              <div className="relative flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg">
                    <Sword size={20} />
                  </div>
                  <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-violet-500 text-white shadow-lg">
                    <Gem size={20} />
                  </div>
                </div>
                <Code2 size={24} className="text-amber-700 ml-auto" />
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-amber-900 transition-colors">
                Questline
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed mb-4">
                Gamify your workflow! Transform TODOs and tests into epic quests with XP, streaks, and legendary drops.
              </p>
              
              {/* Tech stack badges */}
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">VS Code</span>
                <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">Gamification</span>
              </div>
            </Reveal>
          </div>

          <Reveal className="text-center mt-8" delaySec={0.3}>
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-100 via-yellow-50 to-orange-100 ring-1 ring-amber-200 shadow-sm">
              <Sparkles className="text-amber-600" size={20} />
              <p className="text-amber-900 font-semibold">
                <strong>Bring Your Own:</strong> If it shortens time-to-wow, it belongs on the midway.
              </p>
              <Sparkles className="text-amber-600" size={20} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Carnival Guide removed per request */}

      <section id="faq" className="mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-extrabold text-amber-900">FAQ</h2>
            <p className="mt-2 text-amber-800">Questions by the campfire — answers under the tents.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FaqTent q="What is Carnival?" a="Carnival is a YSWS where you build an extension/plugin for a program or editor you use. For every hour spent working on your plugin, you get +$5." accent="#f59e0b" />
            <FaqTent q="What can I build?" a="🔌 Extensions for VS Code, Chrome, Figma, KiCad, Unity, Godot—any platform that accepts plugins. If it shortens time-to-wow, it belongs on the midway." accent="#fbbf24" />
            <FaqTent q="What rewards can I get?" a="🎁 Procreate licenses, domain credits, peripherals, computer upgrades, and more. Anything that helps you keep building!" accent="#d97706" />
            <FaqTent q="Where do I join?" a="🎟️ Hop into the Hack Club Slack and find us in #carnival. The tents are up and the generator's steady." accent="#f59e0b" />
            <FaqTent q="What's the minimum time requirement?" a="Minimum of 6 hours. ⏱️ For every hour you spend working on your project, you'll get a +$5 grant towards your dev journey. Track your time and keep shipping!" accent="#fbbf24" />
            <FaqTent q="Can I build for an editor/app not mentioned?" a="💬 Yes — reach out in #carnival on Slack and ask for approval first. If it helps creators and isn't a remake, we're hyped to see it!" accent="#d97706" />
            <FaqTent q="Can I doube-dip?" a="💬 Yes — If you double-dip with another YSWS, you will get half the payout. That is $2.5/hr!" accent="#d97706" />
          </div>
        </div>
      </section>
      <section id="start" className="pb-20"></section>
    </>
  );
}

export default App;
