import Typewriter from "typewriter-effect";
import Reveal from "./components/Reveal";
import { Wrench, Users, Timer, Ban, ListChecks, Sparkles, Gift, Megaphone } from "lucide-react";
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
  type InspirationExample = {
    title: string;
    codeUrl: string;
    playableUrl?: string;
    screenshotUrl?: string;
    description: string;
  };
  const inspirationExamples: InspirationExample[] = [
    {
      title: "Cypher",
      codeUrl: "https://github.com/Niqtan/Cypher",
      playableUrl: "https://github.com/Niqtan/Cypher/releases/tag/v1.0.0",
      screenshotUrl: "/inspiration/cypher.png",
      description:
        "Cypher is a webpage summarizer for Chrome with a markdown export feature for Obsidian-driven workflows."
    },
    {
      title: "Chrome Story",
      codeUrl: "https://github.com/anirudh12032008/chrome-story.git",
      playableUrl: "https://github.com/anirudh12032008/chrome-story/releases/tag/release",
      screenshotUrl: "/inspiration/chrome-story.png",
      description:
        "Make visual bookmarks and explore browsing history via screenshots. Create chapters, add cards, and relive your web journey."
    },
    {
      title: "Codiva (VS Code)",
      codeUrl: "https://github.com/yashclouded/codiva",
      playableUrl:
        "https://marketplace.visualstudio.com/manage/publishers/soyash/extensions/codiva/hub",
      screenshotUrl: "/inspiration/codiva.png",
      description:
        "Gamifies coding in VS Code with XP, achievements, and Pomodoro. Encourages daily coding streaks."
    },
    {
      title: "QuickTemp",
      codeUrl: "https://github.com/furinehigh/quicktemp-extension",
      playableUrl: "https://github.com/furinehigh/quicktemp-extension/releases/tag/v2.0",
      screenshotUrl: "/inspiration/quicktemp.png",
      description:
        "Temporary email extension with spam filtering, offline support, UI customization, and folder-based email management."
    },
    {
      title: "Tree Maps Addon (Godot)",
      codeUrl: "https://github.com/ToxicStarfall/tree-maps-addon",
      playableUrl: "https://github.com/ToxicStarfall/tree-maps-addon/releases",
      screenshotUrl: "/inspiration/tree-maps.png",
      description:
        "Godot addon to build technology/skill trees and graph-like node structures with customizable nodes and tools."
    },
    {
      title: "Peek Links (Firefox)",
      codeUrl: "https://github.com/Sivayogeith/peek-links",
      playableUrl: "https://github.com/Sivayogeith/peek-links/releases/tag/1.0.0",
      screenshotUrl: "/inspiration/peek-links.png",
      description:
        "Replaces default link previews with a clearer, customizable preview on Firefox desktop."
    },
    {
      title: "Meeting Prep",
      codeUrl: "https://github.com/maverickkamal/Meeting-Prep",
      playableUrl: "https://github.com/maverickkamal/Meeting-Prep/releases/tag/v1.0.0",
      screenshotUrl: "/inspiration/meeting-prep.png",
      description:
        "Cleans up tab clutter before meetings or focus sessions, keeping only essential sites open."
    },
    {
      title: "SOM Music Player",
      codeUrl: "https://github.com/SatyamRaj67/SOM_Extension",
      playableUrl: "https://github.com/SatyamRaj67/SOM_Extension/releases/",
      screenshotUrl: "/inspiration/som-music-player.png",
      description:
        "Chromium music player extension with polished, AI‑free UI design and thoughtful QoL improvements."
    },
    {
      title: "BiteRight",
      codeUrl: "https://github.com/Anas-hessein/BiteRight-v2/tree/ads",
      playableUrl: "https://github.com/Anas-hessein/BiteRight-v2/releases/tag/ads",
      screenshotUrl: "/inspiration/biteright.png",
      description:
        "Redirects junk‑food browsing toward healthier choices; suggests better sites and limits tabs to curb impulse orders."
    },
    {
      title: "Flappy Edge",
      codeUrl: "https://github.com/Srhurdirsati/Flappy_Edge",
      playableUrl: "https://github.com/Srhurdirsati/Flappy_Edge/releases/tag/V1.0",
      screenshotUrl: "/inspiration/flappy-edge.png",
      description:
        "A flappy‑bird style browser game extension for quick breaks; tested on Tor, Edge, and Chrome, works on mobile/PC."
    },
    {
      title: "Whatdidisign",
      codeUrl: "https://github.com/manan0209/Whatdidisign",
      playableUrl: "https://github.com/manan0209/Whatdidisign/releases/tag/v1.4",
      screenshotUrl: "/inspiration/whatdidisign.png",
      description:
        "Detects T&C and privacy links, uses AI to summarize with risk assessments; now powered by Hack Club AI."
    }
  ];
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
          <div className="transform transition-transform hover:scale-105 hover:-rotate-1">
            <a
              aria-label="Browse editors you can build for"
              href="/editors"
              className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-200 transition-colors"
            >
              Editors you can build for
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
                  <li className="flex items-center gap-2">
                    <a href="/editors" className="underline decoration-amber-300 hover:decoration-amber-500 underline-offset-2">
                      ...and many more →
                    </a>
                  </li>
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

      <section id="bonuses" className="mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl md:text-3xl font-extrabold text-amber-900">Sweet Deals for Submissions</h2>
            <p className="mt-2 text-amber-800">Bonus boosts for standout builds — be original and have fun.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* First to a New Program */}
            <Reveal className="group relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur p-5 ring-1 ring-amber-200 shadow-sm hover:shadow-md transition-all" hoverLift>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Gift className="text-amber-600" size={18} />
                  <h3 className="text-base font-semibold text-amber-900">First on a new editor/app</h3>
                </div>
                <span className="rounded-full bg-gradient-to-r from-amber-100 via-yellow-50 to-orange-100 ring-1 ring-amber-200 px-2.5 py-1 text-xs font-bold text-amber-900">+$10</span>
              </div>
              <p className="text-sm text-amber-800">
                Ship the first original extension for an editor/app no one’s hit yet.
              </p>
            </Reveal>

            {/* Goes Viral */}
            <Reveal className="group relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur p-5 ring-1 ring-amber-200 shadow-sm hover:shadow-md transition-all" hoverLift>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Megaphone className="text-amber-600" size={18} />
                  <h3 className="text-base font-semibold text-amber-900">Solves a real problem + goes viral</h3>
                </div>
                <span className="rounded-full bg-gradient-to-r from-amber-100 via-yellow-50 to-orange-100 ring-1 ring-amber-200 px-2.5 py-1 text-xs font-bold text-amber-900">+$25</span>
              </div>
              <p className="text-sm text-amber-800">
                Make something original people love — think 100+ real GitHub ⭐ or 250+ likes on Twitter/Instagram.
              </p>
            </Reveal>

            

            {/* Wildcard Bonus */}
            <Reveal className="group relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur p-5 ring-1 ring-amber-200 shadow-sm hover:shadow-md transition-all" hoverLift>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-amber-600" size={18} />
                  <h3 className="text-base font-semibold text-amber-900">Wildcard Bonus</h3>
                </div>
                <span className="rounded-full bg-gradient-to-r from-amber-100 via-yellow-50 to-orange-100 ring-1 ring-amber-200 px-2.5 py-1 text-xs font-bold text-amber-900">+$5–$20</span>
              </div>
              <p className="text-sm text-amber-800">
                Extra love for stuff that’s wildly creative, funny, or technically impressive.
              </p>
              <ul className="mt-2 text-xs text-amber-800 list-disc pl-4 space-y-1">
                <li>Pull off something gnarly (e.g., real‑time WASM, clever caching)</li>
                <li>A creative/funny twist that still actually solves a problem</li>
                <li>A surprisingly good cross‑tool integration</li>
              </ul>
            </Reveal>
          </div>

          <Reveal className="text-center mt-6" delaySec={0.1}>
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-100 via-yellow-50 to-orange-100 ring-1 ring-amber-200 shadow-sm">
              <Sparkles className="text-amber-600" size={20} />
              <p className="text-amber-900 font-semibold">These stack on top of your hourly grant — ship something delightful!</p>
              <Sparkles className="text-amber-600" size={20} />
            </div>
            
          </Reveal>
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
            {inspirationExamples.map((ex, idx) => (
              <Reveal
                key={ex.title}
                className="group relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur p-4 ring-1 ring-amber-200 shadow-lg hover:shadow-xl transition-all duration-300"
                hoverLift
                delaySec={idx * 0.05}
              >
                {ex.screenshotUrl && (
                  <div className="mb-4 rounded-xl overflow-hidden ring-1 ring-amber-200/60 bg-amber-50">
                    <img
                      src={ex.screenshotUrl}
                      alt={`${ex.title} screenshot`}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-40 object-cover"
                    />
                  </div>
                )}
                <h3 className="text-lg font-bold text-amber-900 mb-2 group-hover:text-amber-800 transition-colors">
                  {ex.title}
                </h3>
                <p className="text-sm text-amber-800 mb-4 max-h-24 overflow-hidden">
                  {ex.description}
                </p>
                <div className="flex items-center gap-2">
                  <a
                    href={ex.codeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 ring-1 ring-amber-200 transition-colors"
                    aria-label={`View code for ${ex.title}`}
                  >
                    Code
                  </a>
                  {ex.playableUrl && (
                    <a
                      href={ex.playableUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 ring-1 ring-amber-500/50 transition-colors"
                      aria-label={`Try ${ex.title}`}
                    >
                      Try
                    </a>
                  )}
                </div>
              </Reveal>
            ))}
          </div>

          
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
