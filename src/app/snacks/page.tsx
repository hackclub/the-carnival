import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Fredoka, Caveat } from "next/font/google";
import LandingCTAButtons from "@/components/landing/LandingCTAButtons";
import SnacksCountdown from "./countdown";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Snacks — Carnival",
  description:
    "Build a new Carnival extension before June 30. If it's worth 12+ hours, you get $1.50 per hour in snacks on top of your normal grant.",
  openGraph: {
    type: "website",
    title: "Snacks — Carnival",
    description:
      "Build a new Carnival extension before June 30. If it's worth 12+ hours, you get $1.50 per hour in snacks on top of your normal grant.",
    siteName: "Carnival",
    images: ["/snacks/snacks banner.png"],
  },
};

const heroStats = [
  { value: "12+ hours", label: "minimum to qualify" },
  { value: "$1.50 / hr", label: "per approved hour" },
  { value: "in snacks", label: "stacked on the grant" },
];

type FloatingSnack = {
  src: string;
  alt: string;
  className: string;
  rotate: number;
  size: number;
  delay?: string;
};

const heroFloaters: FloatingSnack[] = [
  {
    src: "/snacks/chocolate bar.PNG",
    alt: "",
    className: "hidden md:block left-[3%] top-[6%] w-[140px] lg:w-[180px]",
    rotate: -18,
    size: 360,
    delay: "snack-jiggle-delay-1",
  },
  {
    src: "/snacks/coke.PNG",
    alt: "",
    className: "hidden md:block right-[4%] top-[10%] w-[120px] lg:w-[150px]",
    rotate: 14,
    size: 320,
    delay: "snack-jiggle-delay-3",
  },
];

type StoryBeat = {
  eyebrow: string;
  title: string;
  body: string;
  snack: { src: string; alt: string };
  rotate: number;
  reverse?: boolean;
  delay: string;
};

const beats: StoryBeat[] = [
  {
    eyebrow: "step one",
    title: "Make something new",
    body: "We want extensions and plugins that don't exist yet. Pick a bounty no one's claimed, or invent your own ideeview copies of stuff that's already out there.",
    snack: { src: "/snacks/pizza.PNG", alt: "An animated pizza slice" },
    rotate: -8,
    delay: "snack-jiggle-delay-1",
  },
  {
    eyebrow: "step two",
    title: "Ship before June 30",
    body: "Submit it the normal Carnival way. You get the regular grant — snacks come on top.",
    snack: { src: "/snacks/ice cream.png", alt: "An animated ice cream cone" },
    rotate: 7,
    reverse: true,
    delay: "snack-jiggle-delay-2",
  },
  {
    eyebrow: "step three",
    title: "Eat your hours",
    body: "Hit 12+ approved hours and the snack wallet opens. $1.50 per hour, every hour reviewers approved. Spend it on pizza, cake, coke — whatever.",
    snack: { src: "/snacks/cake.PNG", alt: "An animated slice of cake" },
    rotate: -6,
    delay: "snack-jiggle-delay-3",
  },
];

function snackStyle(rotate: number): CSSProperties {
  return { ["--snack-rot" as string]: `${rotate}deg`, transform: `rotate(${rotate}deg)` };
}

export default function SnacksPage() {
  return (
    <main
      className={`${fredoka.className} carnival-home-bg relative min-h-screen overflow-x-clip text-[#5b1f0a]`}
    >
      <div className="carnival-paper-grid pointer-events-none absolute inset-0 -z-10 opacity-30" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.32)_0%,_transparent_68%)]" />

      {/* minimal header — no extra art, just nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border-2 border-[#74210a] bg-[#fff7dc] px-4 py-2 text-sm font-bold text-[#74210a] transition-colors hover:bg-[#fff0cf]"
        >
          <span aria-hidden="true">←</span>
          <span>Back to Carnival</span>
        </Link>
        <span className="rounded-full border-2 border-[#74210a] bg-[#f6a61c] px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[#fff7dc]">
          Snacks
        </span>
      </header>

      {/* hero — snacks wordmark is the centerpiece */}
      <section className="relative mx-auto max-w-5xl px-5 pt-2 sm:px-8 sm:pt-4">
        {heroFloaters.map((f) => (
          <div
            key={f.src}
            aria-hidden="true"
            className={`pointer-events-none absolute snack-jiggle ${f.delay ?? ""} ${f.className}`}
            style={{ ["--snack-rot" as string]: `${f.rotate}deg` }}
          >
            <Image
              src={f.src}
              alt={f.alt}
              width={f.size}
              height={f.size}
              className="h-auto w-full"
            />
          </div>
        ))}

        <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
          <h1 className="sr-only">Snacks — a Carnival side quest</h1>
          {/* wordmark — overflow-hidden + negative inner margins trim the PNG's transparent padding so the tagline sits flush */}
          <div className="w-full max-w-[460px] overflow-hidden sm:max-w-[520px]">
            <Image
              src="/snacks/snacks banner.png"
              alt="Snacks"
              width={1600}
              height={800}
              priority
              className="-my-[10%] h-auto w-full"
            />
          </div>

          <p className="mt-2 text-[clamp(1.3rem,4.5vw,2rem)] font-semibold leading-[1.15] text-[#5b1f0a] [text-wrap:balance] sm:mt-3">
            Build a thing,{" "}
            <span
              className={`${caveat.className} text-[#e08609]`}
              style={{ fontSize: "1.2em" }}
            >
              get snacks
            </span>
            .
          </p>
          <p className="mt-3 max-w-xl text-[15px] leading-6 text-[#6d3510] [text-wrap:pretty] sm:mt-4 sm:text-base sm:leading-7">
            Build a <strong>new</strong> extension for Carnival before June 30.
            If it&apos;s worth 12+ hours, you get $1.50 per hour in snacks — on
            top of your normal grant.
          </p>

          {/* the criteria, at a glance */}
          <ul
            className="mt-5 grid w-full grid-cols-1 gap-3 text-left sm:mt-6 sm:grid-cols-3 sm:gap-4"
            aria-label="Snacks program criteria"
          >
            {heroStats.map((stat) => (
              <li
                key={stat.label}
                className="rounded-2xl border-2 border-[#74210a] bg-[#fff7dc] p-4 shadow-[3px_3px_0_rgba(116,33,10,1)]"
              >
                <p
                  className={`${caveat.className} text-2xl leading-none text-[#e08609] sm:text-3xl`}
                >
                  {stat.value}
                </p>
                <p className="mt-2 text-sm font-bold text-[#5b1f0a] sm:text-[15px]">
                  {stat.label}
                </p>
              </li>
            ))}
          </ul>

          <LandingCTAButtons />

          <div className="mt-8 sm:mt-10">
            <SnacksCountdown />
          </div>
        </div>
      </section>

      {/* story beats — each step gets its own snack mascot */}
      <section className="relative mx-auto mt-20 max-w-5xl px-5 sm:mt-32 sm:px-8">
        <div className="text-center">
          <h2 className="text-[clamp(2rem,4.5vw,3rem)] font-bold leading-tight">
            How it works
          </h2>
          <p
            className={`${caveat.className} mt-1 text-2xl text-[#e08609] sm:text-3xl`}
          >
            three stops to a sugar rush
          </p>
        </div>

        <div className="mt-12 flex flex-col gap-16 sm:mt-16 sm:gap-28">
          {beats.map((beat) => (
            <div
              key={beat.title}
              className={`flex flex-col items-center gap-6 sm:gap-12 ${
                beat.reverse ? "sm:flex-row-reverse" : "sm:flex-row"
              }`}
            >
              <div
                className="relative w-36 shrink-0 sm:w-56 lg:w-64"
                aria-hidden="false"
              >
                <div
                  className={`snack-jiggle ${beat.delay} aspect-square w-full`}
                  style={snackStyle(beat.rotate)}
                >
                  <Image
                    src={beat.snack.src}
                    alt={beat.snack.alt}
                    width={520}
                    height={520}
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>

              <div
                className={`flex-1 ${beat.reverse ? "sm:text-right" : "sm:text-left"} text-center`}
              >
                <p
                  className={`${caveat.className} text-2xl text-[#e08609] sm:text-3xl`}
                >
                  {beat.eyebrow}
                </p>
                <h3 className="mt-1 text-[clamp(1.6rem,3vw,2.2rem)] font-bold leading-tight">
                  {beat.title}
                </h3>
                <p className="mt-4 text-base leading-7 text-[#6d3510] [text-wrap:pretty] sm:text-lg sm:leading-8">
                  {beat.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* fine print */}
      <section className="relative mx-auto mt-20 max-w-3xl px-5 sm:mt-36 sm:px-8">
        <div className="relative rounded-3xl border-2 border-[#74210a] bg-[#fff7dc] p-8 shadow-[5px_5px_0_rgba(116,33,10,1)] sm:p-10">
          <h3
            className={`${caveat.className} text-3xl text-[#74210a] sm:text-4xl`}
          >
            the fine print
          </h3>
          <ul className="mt-5 space-y-3 text-[15px] leading-7 text-[#6d3510] sm:text-base">
            <li className="flex gap-3">
              <span aria-hidden="true" className="shrink-0 text-[#e08609]">•</span>
              <span>
                It has to be a <strong>new</strong> extension or plugin — fill a
                bounty or come up with your own idea. No copies of things that
                already exist.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="shrink-0 text-[#e08609]">•</span>
              <span>Under 12 approved hours? No snacks.</span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="shrink-0 text-[#e08609]">•</span>
              <span>
                Submit by June 30, 2026. Reviews can finish after — you just
                need to be in by then.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="shrink-0 text-[#e08609]">•</span>
              <span>
                We&apos;ll DM you to sort shipping once your project clears
                review.
              </span>
            </li>
          </ul>
        </div>
      </section>

      <footer className="mx-auto mt-20 max-w-5xl px-5 pb-16 text-center text-sm font-semibold text-[#8f4a18] sm:mt-24 sm:px-8">
        <p>
          A side quest from{" "}
          <Link
            href="/"
            className="font-bold text-[#74210a] underline-offset-4 hover:underline"
          >
            Carnival
          </Link>
          , by Hack Club.
        </p>
        <p className="mt-3 text-[13px] text-[#8f4a18]">
          Snack art by{" "}
          <Link
            href="https://hackclub.enterprise.slack.com/team/U09RM7LQCAD"
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[#74210a] underline-offset-4 hover:underline"
          >
            @Daniiii
          </Link>
          .
        </p>
      </footer>
    </main>
  );
}
