import Typewriter from "typewriter-effect";
import { HashLink } from 'react-router-hash-link';
import { motion } from "framer-motion";
import { Wrench, Users, Globe, Laptop, Camera, Package, Timer, Ban, ListChecks } from "lucide-react";
import TentCard from "./components/TentCard";
import FaqTent from "./components/FAQCard";

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
        <span className="text-md text-center pt-10">Every hour coding unlocks +$5 to expand your dev environment.</span>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <HashLink
            to="/#start"
            className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-sm ring-1 ring-amber-500/50 transition-colors"
          >
            Start
          </HashLink>
          <HashLink
            to="/#rewards"
            className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 ring-1 ring-amber-200 transition-colors"
          >
            See rewards
          </HashLink>
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
                <li className="leading-relaxed">Build something useful that improves your workflow or helps others</li>
                <li className="leading-relaxed">Get at least 10 users to try it and share feedback</li>
                <li className="leading-relaxed">Open-source your project so others can learn</li>
                <li className="leading-relaxed">Support macOS/Linux and Windows where practical</li>
                <li className="leading-relaxed">Include screenshots, a short demo, or a readme GIF</li>
                <li className="leading-relaxed">Make it self-contained — no relying on pre-installed tools</li>
                <li className="leading-relaxed">Provide clear build and run instructions for all platforms</li>
                <li className="leading-relaxed">Track at least 15 hours with Hackatime</li>
                <li className="leading-relaxed">Avoid minor remixes and simple wrappers</li>
                <li className="leading-relaxed">Ship with heart — polish matters</li>
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
                  <li className="flex items-center gap-2"><Laptop size={16} className="text-amber-600" /> Any language or stack</li>
                  <li className="flex items-center gap-2"><Globe size={16} className="text-amber-600" /> Web, desktop, terminal, or mobile</li>
                  <li className="flex items-center gap-2"><Package size={16} className="text-amber-600" /> Ship single-binary or portable bundles</li>
                  <li className="flex items-center gap-2"><Camera size={16} className="text-amber-600" /> Screenshots or short demos</li>
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
                  <li>Join the <span className="font-semibold">#carnival</span> channel on Slack to ask, share, and vibe</li>
                  <li>Build something awesome and ship it</li>
                  <li>Track time with Hackatime and prepare your README</li>
                  <li>Submit your project for review and claim rewards</li>
                </ol>
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <HashLink to="/#start" className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 ring-1 ring-amber-500/50 transition-colors">Start now</HashLink>
                  <HashLink to="/#rewards" className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 ring-1 ring-amber-200 transition-colors">See rewards</HashLink>
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
            <p className="mt-2 text-amber-800">Unlock perks as you code—stack credits, hosting, and real hardware.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <TentCard
              title="AI Credits"
              description="Use credits on top AI APIs and models to supercharge your builds."
              items={["Model inference credits", "Embedding/search usage", "Fine-tuning allowances"]}
              accentHex="#f59e0b"
            />
            <TentCard
              title="Hosting"
              description="Deploy faster with sponsored hosting tiers and bandwidth boosts."
              items={["Static and serverless tiers", "DB/storage credits", "CDN egress boosts"]}
              accentHex="#fbbf24"
            />
            <TentCard
              title="Hardware"
              description="Level up your rig with components earned through consistent coding."
              items={["RAM upgrades", "CPU and coolers", "Motherboards and more"]}
              accentHex="#d97706"
            />
          </div>
        </div>
      </section>

      <section id="faq" className="mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-extrabold text-amber-900">FAQ</h2>
            <p className="mt-2 text-amber-800">Questions by the campfire — answers under the tents.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FaqTent q="What is YSWS Carnival?" a="A themed series where you build real projects, track time, and earn rewards like AI credits, hosting, or hardware." accent="#f59e0b" />
            <FaqTent q="How do I get rewards?" a="Track at least 15 hours, meet the criteria, submit your project, and claim your perks once approved." accent="#fbbf24" />
            <FaqTent q="Do I need to open-source?" a="Yes, projects should be open-source so others can learn from your work." accent="#d97706" />
            <FaqTent q="Where do I ask questions?" a="Join the Hack Club Slack and hop into the #carnival channel — we’re happy to help." accent="#f59e0b" />
          </div>
        </div>
      </section>
      <section id="start" className="pb-20"></section>
    </>
  );
}

export default App;
