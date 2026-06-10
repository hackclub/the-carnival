import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import Header from "@/components/Header";
import FAQ from "@/components/home/FAQ";
import Countdown from "@/components/landing/Countdown";
import FloatingBalloons from "@/components/landing/FloatingBalloons";
import HeroTypewriter from "@/components/landing/HeroTypewriter";
import LandingCTAButtons from "@/components/landing/LandingCTAButtons";

const finePrint = [
  "Solve a real annoyance or quality-of-life problem.",
  "Make it open source and usable by real people.",
  "Aim for at least 5 real users before you submit.",
  "No double-dipping with other programs or events.",
  "Thin wrappers, remixes, and fake time don't count.",
];

const bonuses = [
  {
    amount: "+$10",
    title: "First on a new editor",
    description:
      "Ship the first original extension for an editor or app nobody else has claimed yet.",
    hue: 0,
    tilt: "-rotate-3",
  },
  {
    amount: "+$25",
    title: "Goes viral",
    description:
      "Make something people love — think 100+ GitHub stars or 250+ social likes.",
    hue: -45,
    tilt: "rotate-2 translate-y-3",
  },
  {
    amount: "+$5–20",
    title: "Wildcard",
    description:
      "Extra love for projects that are especially creative, funny, or technically sharp.",
    hue: 150,
    tilt: "-rotate-1 translate-y-1",
  },
];

const prizeBooth = [
  {
    title: "Creative tools",
    items: [
      "Procreate license",
      "JetBrains IDE license",
      "Design tools",
      "Cursor Pro",
    ],
  },
  {
    title: "Hardware & setup",
    items: [
      "Peripherals",
      "Computer upgrades",
      "Development hardware",
      "Specialty devices",
    ],
  },
  {
    title: "Infrastructure",
    items: [
      "Domain credits",
      "Cloud hosting",
      "API access",
      "Development services",
    ],
  },
];

function Scribble({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-block px-3 py-1">
      <Image
        src="/logo-bg2.png"
        alt=""
        fill
        sizes="600px"
        className="-rotate-1 scale-x-110 scale-y-125 object-fill opacity-90"
      />
      <span className="relative">{children}</span>
    </span>
  );
}

function BrickRoad({ flip = false }: { flip?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`relative mx-auto my-4 w-[min(480px,72%)] ${flip ? "-scale-x-100" : ""}`}
    >
      <Image
        src="/stair-2.png"
        alt=""
        width={950}
        height={400}
        className="h-auto w-full"
      />
      <Image
        src="/stair-path-2.png"
        alt=""
        width={950}
        height={400}
        className="absolute inset-0 h-auto w-full scale-x-105"
      />
    </div>
  );
}

function PrizeBalloon({
  amount,
  hue,
  tilt,
}: {
  amount: string;
  hue: number;
  tilt: string;
}) {
  return (
    <div className={`relative w-28 sm:w-32 ${tilt}`}>
      <Image
        src="/orange-balloon.png"
        alt=""
        width={155}
        height={250}
        className="h-auto w-full"
        style={hue ? { filter: `hue-rotate(${hue}deg)` } : undefined}
      />
      <span className="absolute inset-x-0 top-[38%] -translate-y-1/2 text-center text-2xl font-black text-[#fff7dc] sm:text-[1.7rem]">
        {amount}
      </span>
      <svg
        aria-hidden="true"
        viewBox="0 0 40 70"
        className="mx-auto -mt-2 h-14 w-6 text-[#74210a]"
      >
        <path
          d="M20 2 C 10 18, 30 32, 20 48 C 14 58, 25 63, 21 69"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default function Home() {
  return (
    <main className="carnival-home-bg relative min-h-screen overflow-x-clip text-[#5b1f0a]">
      <FloatingBalloons />
      <div className="carnival-paper-grid pointer-events-none absolute inset-0 -z-10 opacity-30" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.32)_0%,_transparent_68%)]" />

      <Header />

      {/* Hero */}
      <section className="relative px-4 pt-4 sm:px-6 sm:pt-8">
        <Image
          src="/left-ropes.png"
          alt=""
          width={248}
          height={463}
          className="pointer-events-none absolute left-[3%] top-0 hidden h-auto w-[clamp(48px,6vw,92px)] opacity-90 lg:block"
        />
        <Image
          src="/right-ropes.png"
          alt=""
          width={233}
          height={375}
          className="pointer-events-none absolute right-[3%] top-0 hidden h-auto w-[clamp(48px,6vw,88px)] opacity-90 lg:block"
        />

        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <h1 className="sr-only">The Carnival — a Hack Club event</h1>
          <div className="relative w-full max-w-[620px] -rotate-1 transition-transform duration-300 hover:rotate-0">
            <Image
              src="/logo-bg.png"
              alt=""
              width={950}
              height={330}
              priority
              className="h-auto w-full"
            />
            <Image
              src="/logo.png"
              alt="Carnival"
              width={1470}
              height={540}
              priority
              className="absolute inset-0 h-full w-full object-contain p-[7%]"
            />
          </div>

          <p className="mt-8 max-w-3xl text-[clamp(2rem,5vw,3.4rem)] font-bold leading-[1.02] [text-wrap:balance]">
            Make <Scribble>projects,</Scribble> not excuses.
          </p>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#6d3510] [text-wrap:pretty] sm:text-lg sm:leading-8">
            Carnival is Hack Club&apos;s fair for builders of little things —
            extensions, plugins, and widgets for the tools you already live in.
            Ship one open source, and every honest hour you track becomes{" "}
            <strong>$4</strong> toward your dream setup.
          </p>

          <div className="mt-6 max-w-2xl text-base font-semibold text-[#8f4a18] sm:text-lg">
            <span>on the midway right now:&nbsp;</span>
            <span className="inline-block italic">
              <HeroTypewriter />
            </span>
          </div>

          <LandingCTAButtons />
        </div>

        {/* The midway */}
        <div className="mx-auto mt-14 max-w-5xl sm:mt-20">
          <div className="flex items-end justify-center gap-[3%] px-2">
            <div className="w-[26%] max-w-[230px] -rotate-2">
              <Image
                src="/ferris-wheel.png"
                alt="A hand-drawn ferris wheel"
                width={516}
                height={525}
                className="carnival-bob h-auto w-full"
              />
            </div>
            <div className="w-[40%] max-w-[360px]">
              <Image
                src="/tent.png"
                alt="A hand-drawn circus tent flying a Hack Club flag"
                width={674}
                height={440}
                className="carnival-bob carnival-bob-delay-1 h-auto w-full"
              />
            </div>
            <div className="w-[28%] max-w-[250px] rotate-2">
              <Image
                src="/carousel.png"
                alt="A hand-drawn carousel"
                width={562}
                height={606}
                className="carnival-bob carnival-bob-delay-2 h-auto w-full"
              />
            </div>
          </div>
          <Image
            src="/railing.png"
            alt=""
            width={2160}
            height={226}
            className="-mt-2 h-auto w-full sm:-mt-4"
          />
        </div>

        <Countdown />
      </section>

      {/* How it works */}
      <section
        id="about"
        className="relative mx-auto mt-20 max-w-3xl scroll-mt-8 px-4 text-center sm:mt-28 sm:px-6"
      >
        <h2 className="text-[clamp(1.9rem,4vw,2.8rem)] font-bold">
          <Scribble>How it works</Scribble>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#6d3510]">
          Three stops between you and the prize booth.
        </p>

        <div className="mt-12 flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:gap-8 sm:text-left">
          <span
            aria-hidden="true"
            className="-rotate-6 text-7xl font-black leading-none text-[#e08609]"
          >
            1
          </span>
          <div className="max-w-md">
            <h3 className="text-2xl font-bold">Find an itch</h3>
            <p className="mt-2 leading-7 text-[#6d3510] [text-wrap:pretty]">
              Start with a real annoyance, a workflow gap, or a playful idea
              people will actually want to keep around. Quality-of-life
              upgrades win; thin wrappers usually don&apos;t.
            </p>
          </div>
        </div>

        <BrickRoad />

        <div className="flex flex-col items-center gap-3 text-center sm:flex-row-reverse sm:items-start sm:gap-8 sm:text-right">
          <span
            aria-hidden="true"
            className="rotate-3 text-7xl font-black leading-none text-[#e08609]"
          >
            2
          </span>
          <div className="max-w-md">
            <h3 className="text-2xl font-bold">Build it in the open</h3>
            <p className="mt-2 leading-7 text-[#6d3510] [text-wrap:pretty]">
              Publish clear code, a usable release, a README with screenshots —
              enough that a stranger can install it and get it. Then go find
              real people to try it.
            </p>
          </div>
        </div>

        <BrickRoad flip />

        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:gap-8 sm:text-left">
          <span
            aria-hidden="true"
            className="-rotate-3 text-7xl font-black leading-none text-[#e08609]"
          >
            3
          </span>
          <div className="max-w-md">
            <h3 className="text-2xl font-bold">Cash in your tickets</h3>
            <p className="mt-2 leading-7 text-[#6d3510] [text-wrap:pretty]">
              Track honest time with Hackatime, submit what you built, and the
              hours turn into grant money for your setup — plus bonuses for
              standout work.
            </p>
            <p className="mt-4 max-w-md text-sm font-semibold leading-6 text-[#a51d2d]">
              One serious thing: don&apos;t cheat Hackatime. No bots, no fake
              key presses, no UI tricks — that&apos;s a ban from Hackatime and
              future Hack Club events.
            </p>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-xl">
          <h3 className="text-xl font-bold">
            The fine print, written big
          </h3>
          <ul className="mt-4 space-y-2 text-left text-base leading-7 text-[#6d3510]">
            {finePrint.map((rule) => (
              <li key={rule} className="flex gap-3">
                <span aria-hidden="true" className="font-bold text-[#e08609]">
                  —
                </span>
                {rule}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Bonuses */}
      <section className="mx-auto mt-24 max-w-5xl px-4 text-center sm:px-6">
        <h2 className="text-[clamp(1.9rem,4vw,2.8rem)] font-bold">
          <Scribble>Step right up</Scribble>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#6d3510]">
          Bonus prizes stack on top of your tracked hours.
        </p>

        <div className="mt-12 flex flex-wrap items-start justify-center gap-x-10 gap-y-12 sm:gap-x-16">
          {bonuses.map((bonus) => (
            <div key={bonus.title} className="flex w-60 flex-col items-center">
              <PrizeBalloon
                amount={bonus.amount}
                hue={bonus.hue}
                tilt={bonus.tilt}
              />
              <h3 className="mt-3 text-lg font-bold">{bonus.title}</h3>
              <p className="mt-1 text-sm leading-6 text-[#6d3510] [text-wrap:pretty]">
                {bonus.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Prize booth */}
      <section
        id="rewards"
        className="mx-auto mt-24 max-w-4xl scroll-mt-8 px-4 text-center sm:px-6"
      >
        <h2 className="text-[clamp(1.9rem,4vw,2.8rem)] font-bold">
          <Scribble>The prize booth</Scribble>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#6d3510] [text-wrap:pretty]">
          Grants are for making your workflow better, faster, or weirder in the
          best possible way.
        </p>

        <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-6">
          {prizeBooth.map((group) => (
            <div key={group.title}>
              <h3 className="text-xl font-bold underline decoration-[#e08609]/70 decoration-wavy underline-offset-8">
                {group.title}
              </h3>
              <ul className="mt-5 space-y-2 text-base leading-7 text-[#6d3510]">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Say hi */}
      <section className="mx-auto mt-24 max-w-2xl px-4 text-center sm:px-6">
        <h2 className="text-[clamp(1.9rem,4vw,2.8rem)] font-bold">
          <Scribble>Come say hi</Scribble>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#6d3510] [text-wrap:pretty]">
          The fastest way to get unstuck is to show people the messy version.
          The #carnival channel is full of people doing exactly that — and when
          you&apos;re ready, start a project and let the hours count.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="https://hackclub.slack.com/archives/C091ZRTMF16"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--carnival-squircle-radius)] border-2 border-[#74210a] bg-[#f6a61c] px-6 py-2 text-center text-sm font-bold text-[#fff7dc] transition-colors duration-200 hover:bg-[#ee9817] sm:w-auto"
          >
            Open #carnival on Slack
          </Link>
          <Link
            href="/projects/new"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--carnival-squircle-radius)] border-2 border-[#74210a] bg-[#fff7dc] px-6 py-2 text-center text-sm font-bold text-[#74210a] transition-colors duration-200 hover:bg-[#fff0cf] sm:w-auto"
          >
            Start a project
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="mx-auto mt-24 max-w-2xl scroll-mt-8 px-4 sm:px-6"
      >
        <h2 className="text-center text-[clamp(1.9rem,4vw,2.8rem)] font-bold">
          <Scribble>Honest questions</Scribble>
        </h2>
        <FAQ />
        <p className="mt-6 text-center text-base leading-7 text-[#6d3510]">
          Still unsure? Ask in{" "}
          <Link
            href="https://hackclub.slack.com/archives/C091ZRTMF16"
            target="_blank"
            rel="noreferrer"
            className="font-bold underline decoration-[#e08609] decoration-wavy underline-offset-4"
          >
            #carnival
          </Link>{" "}
          or browse the{" "}
          <Link
            href="/editors"
            className="font-bold underline decoration-[#e08609] decoration-wavy underline-offset-4"
          >
            editors and apps
          </Link>
          .
        </p>
      </section>

      <footer className="mt-24 px-4 pb-14 text-center">
        <Image
          src="/tent.png"
          alt=""
          width={674}
          height={440}
          className="mx-auto h-auto w-28"
        />
        <p className="mt-4 text-lg font-bold">See you on the midway.</p>
        <p className="mt-2 text-sm text-[#6d3510]">
          <Link
            href="https://hackclub.slack.com/archives/C091ZRTMF16"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-[#e08609] decoration-wavy underline-offset-4"
          >
            #carnival
          </Link>
          {" · "}
          <Link
            href="/explore"
            className="underline decoration-[#e08609] decoration-wavy underline-offset-4"
          >
            dashboard
          </Link>
          {" · "}
          <Link
            href="/editors"
            className="underline decoration-[#e08609] decoration-wavy underline-offset-4"
          >
            editors &amp; apps
          </Link>
        </p>
        <p className="mt-6 text-xs font-semibold text-[#8f4a18]">
          © 2026 The Carnival, a Hack Club thing — drawn with markers, built
          with love.
        </p>
      </footer>
    </main>
  );
}
