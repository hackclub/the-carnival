import Typewriter from "typewriter-effect";
import { HashLink } from 'react-router-hash-link';
import { motion } from "framer-motion";
import { Wrench, Users, Globe, Laptop, Camera, Package, Timer, Ban, ListChecks } from "lucide-react";
import TentCard from "./components/TentCard";
import FaqTent from "./components/FAQCard";
import { LandingBannerTabs } from "./components/BannerTabs";

function App() {
  return (
    <>
      <section id="home" className="pt-20 flex flex-col">
        <div className="text-3xl md:text-5xl font-extrabold text-center">
          <Typewriter
            options={{
              strings: ["Step Right Up ", "Your Dev Carnival Awaits "],
              autoStart: true,
              loop: true,
            }}
          />
        </div>
        <div className="text-center pt-10 max-w-4xl mx-auto">
          <p className="text-md text-amber-800 mb-4">
            <strong>CRASH 💥.</strong> Orpheus walks nose-first into a VS Code extension that wasn't there a second ago. 
            Across the lane, a Figma tent pulses—variables flickering like marquee bulbs. A chrome-bright booth mirrors a dozen browsers.
          </p>
          <p className="text-sm text-amber-700 mb-4">
            The midway isn't chaos; it's a federation. Editors are fairgrounds: VS Code, Figma, Chrome, Godot, Unity, KiCad. 
            They're powerful on their own, but they become a city when the attachments arrive.
          </p>
          <p className="text-lg font-semibold text-amber-900">
            🎪 Build an extension, plugin, or widget—add your ride to the midway, light up the wire! 🎟️✨
          </p>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <motion.div whileHover={{ scale: 1.05, rotate: [-1, 1, -1, 0], transition: { duration: 0.3 } }}>
            <HashLink
              to="/#start"
              className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-sm ring-1 ring-amber-500/50 transition-colors"
            >
              Start
            </HashLink>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05, rotate: [1, -1, 1, 0], transition: { duration: 0.3 } }}>
            <HashLink
              to="/#rewards"
              className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 ring-1 ring-amber-200 transition-colors"
            >
              See rewards
            </HashLink>
          </motion.div>
        </div>
      </section>

      <section id="explore" className="mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-extrabold text-amber-900">Explore</h2>
            <p className="mt-2 text-amber-800">Step right up — join the YSWS Carnival, build something real, and unlock rewards.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* What you need to do */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl bg-white/70 backdrop-blur p-6 ring-1 ring-amber-200 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-3">
                <ListChecks className="text-amber-600" size={18} />
                <h3 className="text-lg font-semibold text-amber-900">What you need to do</h3>
              </div>
              <ol className="space-y-2 text-sm text-amber-800 list-decimal pl-5">
                <li className="leading-relaxed">Build a plugin/extension for VS Code, Chrome, Slack, KiCad, or other platforms</li>
                <li className="leading-relaxed">Get at least 10 users to try it and share feedback</li>
                <li className="leading-relaxed">Open-source your project so others can learn</li>
                <li className="leading-relaxed">Include screenshots, a short demo, or a readme GIF</li>
                <li className="leading-relaxed">Provide clear installation and usage instructions</li>
                <li className="leading-relaxed">Track at least 15 hours with Hackatime</li>
                <li className="leading-relaxed">Avoid minor remixes and simple wrappers</li>
                <li className="leading-relaxed">Ship with heart — polish matters</li>
                <li className="leading-relaxed">Want to target a different platform? Suggest it and we'll consider it!</li>
              </ol>
            </motion.div>

            {/* Tools and How to join */}
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="rounded-2xl bg-white/70 backdrop-blur p-6 ring-1 ring-amber-200 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="text-amber-600" size={18} />
                  <h3 className="text-lg font-semibold text-amber-900">Tools you can use</h3>
                </div>
                <ul className="grid grid-cols-2 gap-2 text-sm text-amber-800">
                  <li className="flex items-center gap-2"><Laptop size={16} className="text-amber-600" /> VS Code extensions</li>
                  <li className="flex items-center gap-2"><Globe size={16} className="text-amber-600" /> Chrome/Firefox plugins</li>
                  <li className="flex items-center gap-2"><Package size={16} className="text-amber-600" /> Slack integrations</li>
                  <li className="flex items-center gap-2"><Camera size={16} className="text-amber-600" /> KiCad, Figma, etc.</li>
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="rounded-2xl bg-white/70 backdrop-blur p-6 ring-1 ring-amber-200 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Users className="text-amber-600" size={18} />
                  <h3 className="text-lg font-semibold text-amber-900">How to get involved</h3>
                </div>
                <ol className="space-y-2 text-sm text-amber-800 list-decimal pl-5">
                  <li>Join the <span className="font-semibold">#the-carnival</span> channel on Slack to ask, share, and vibe</li>
                  <li>Build your extension, plugin, or widget and ship it</li>
                  <li>Track time with Hackatime and prepare your README</li>
                  <li>Submit your project for review and claim rewards</li>
                </ol>
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <motion.div whileHover={{ scale: 1.05, y: -2, transition: { duration: 0.2 } }}>
                    <HashLink to="/#start" className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 ring-1 ring-amber-500/50 transition-colors">Start now</HashLink>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.05, y: -2, transition: { duration: 0.2 } }}>
                    <HashLink to="/#rewards" className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 ring-1 ring-amber-200 transition-colors">See rewards</HashLink>
                  </motion.div>
                </div>
                <div className="mt-3 text-xs text-amber-700 flex items-center gap-2">
                  <Timer size={14} className="text-amber-600" />
                  <span>Every hour of coding unlocks +$5 towards your dev environment.</span>
                </div>
                <div className="mt-2 text-xs text-amber-700 flex items-center gap-2">
                  <Ban size={14} className="text-amber-600" />
                  <span>No trivial remixes or thin wrappers.</span>
                </div>
              </motion.div>
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
              items={["Procreate license 🎨", "Adobe Creative Suite", "Design tools", "Development IDEs"]}
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
        </div>
      </section>

      <section id="inspiration" className="mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-extrabold text-amber-900">💡 Need Inspiration?</h2>
            <p className="mt-2 text-amber-800">Ideas to get your creative gears turning</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              whileHover={{ scale: 1.02, y: -2, transition: { duration: 0.2 } }}
              className="rounded-2xl bg-white/70 backdrop-blur p-6 ring-1 ring-amber-200 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-amber-900 mb-3">🌶️➡️🧊 Browser Extension</h3>
              <p className="text-sm text-amber-800">
                Detect spicy text and offer chill rephrases, with small cognitive-bias notes so you keep your point without losing your tone.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
              whileHover={{ scale: 1.02, y: -2, transition: { duration: 0.2 } }}
              className="rounded-2xl bg-white/70 backdrop-blur p-6 ring-1 ring-amber-200 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-amber-900 mb-3">🎬📱 Figma Plugin</h3>
              <p className="text-sm text-amber-800">
                Turn a flow into a 12–15s teaser (captions + swipe sound) ready for Shorts/TikTok.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.2 }}
              whileHover={{ scale: 1.02, y: -2, transition: { duration: 0.2 } }}
              className="rounded-2xl bg-white/70 backdrop-blur p-6 ring-1 ring-amber-200 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-amber-900 mb-3">⚔️📜💎 VS Code Extension</h3>
              <p className="text-sm text-amber-800">
                Make TODOs/tests into quests with XP, streaks, and rarity drops.
              </p>
            </motion.div>
          </div>

          <div className="text-center mt-8">
            <p className="text-amber-800 font-medium">
              ⚡🎛️ <strong>Bring Your Own:</strong> If it shortens time-to-wow, it belongs on the midway.
            </p>
          </div>
        </div>
      </section>

      <section id="banner-tabs" className="mt-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-extrabold text-amber-900">Carnival Guide</h2>
            <p className="mt-2 text-amber-800">Everything you need to know, organized like carnival banners.</p>
          </div>
          <LandingBannerTabs />
        </div>
      </section>

      <section id="faq" className="mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-extrabold text-amber-900">FAQ</h2>
            <p className="mt-2 text-amber-800">Questions by the campfire — answers under the tents.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FaqTent q="What is the Carnival?" a="🎪 The midway where you build extensions, plugins, and widgets for editors you actually use. Add your ride to the wire and light up the federation!" accent="#f59e0b" />
            <FaqTent q="What can I build?" a="🔌 Extensions for VS Code, Chrome, Figma, KiCad, Unity, Godot—any platform that accepts plugins. If it shortens time-to-wow, it belongs on the midway." accent="#fbbf24" />
            <FaqTent q="What rewards can I get?" a="🎁 Procreate licenses, domain credits, peripherals, computer upgrades, and more. Anything that helps you keep building!" accent="#d97706" />
            <FaqTent q="Where do I join?" a="🎟️ Hop into the Hack Club Slack and find us in #the-carnival. The tents are up, the generator's steady, and the PCB is glowing!" accent="#f59e0b" />
          </div>
        </div>
      </section>
      <section id="start" className="pb-20"></section>
    </>
  );
}

export default App;
