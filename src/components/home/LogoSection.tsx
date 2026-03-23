import Image from "next/image";
import { AlertTriangle } from "lucide-react";
import Countdown from "@/components/landing/Countdown";
import HeroTypewriter from "@/components/landing/HeroTypewriter";
import LandingCTAButtons from "@/components/landing/LandingCTAButtons";
import {
  carnivalCardClassName,
  carnivalCopyClassName,
  carnivalPanelClassName,
  cx,
} from "@/components/home/shared";

const submissionRules = [
  "Solve a real annoyance or quality-of-life problem.",
  "Make it open source and usable by real people.",
  "Aim for at least 5 real users before you submit.",
  "Double-dipping is not allowed.",
  "Thin wrappers, remixes, and fake time do not count.",
];

export default function LogoSection() {
  return (
    <section className="relative px-4 pb-12 pt-0 sm:px-6 lg:px-8 lg:pb-16">
      <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_top,_rgba(255,252,235,0.92)_0%,_rgba(255,227,154,0.64)_48%,_transparent_100%)]" />

      <div className="mx-auto max-w-6xl">
        <div
          role="alert"
          className={cx(
            carnivalCardClassName,
            "carnival-card-rose px-5 py-5 sm:px-6",
          )}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 shrink-0 text-[#a51d2d]"
              size={20}
            />
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#8d1a2b]">
                Time tracking warning
              </p>
              <p className="mt-2 text-sm leading-6 text-[#74210a] sm:text-base sm:leading-7">
                Don&apos;t cheat Hackatime. No bots, no fake key presses, no UI
                manipulation. If you do, you can be banned from Hackatime and
                future Hack Club events.
              </p>
            </div>
          </div>
        </div>

        <div
          className={cx(
            carnivalPanelClassName,
            "mt-6 px-5 py-7 sm:px-8 sm:py-10 lg:px-12 lg:py-12",
          )}
        >
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="relative w-full max-w-[980px] transition-transform duration-300 hover:-translate-y-1 hover:rotate-[1deg]">
              <div className="relative aspect-[16/7.4] w-full sm:aspect-[16/6.8] lg:aspect-[16/5.8]">
                <Image
                  src="/logo-bg.png"
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 1280px) 980px, 100vw"
                  className="object-contain"
                />
                <Image
                  src="/logo.png"
                  alt="Carnival"
                  fill
                  priority
                  sizes="(min-width: 1280px) 980px, 100vw"
                  className="object-contain px-[8%] py-[10%]"
                />
              </div>
            </div>

            <p className="mt-5 max-w-4xl text-center text-[clamp(1.9rem,4.8vw,4.4rem)] font-black leading-[0.95] text-[#5b1f0a] [text-wrap:balance]">
              Make projects, not excuses, and earn rewards with Carnival.
            </p>
            <p className="mt-4 max-w-3xl text-center text-base leading-7 text-[#6d3510] [text-wrap:pretty] sm:text-lg">
              Build an extension, plugin, or widget for the tools you already
              use. Every honest hour you track turns into{" "}
              <span className="font-black">$4/hr</span> toward your dev setup.
            </p>

            <div
              className={cx(
                carnivalCardClassName,
                "carnival-card-soft mt-7 w-full max-w-4xl px-5 py-4 sm:px-6",
              )}
            >
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8f4a18]">
                Spin up a ride like
              </p>
              <div className="mt-2 min-h-[3.75rem] text-lg font-semibold leading-7 text-[#5b1f0a] [text-wrap:balance] sm:text-xl">
                <HeroTypewriter />
              </div>
            </div>

            <LandingCTAButtons />
          </div>
        </div>

        <div className={cx(carnivalCardClassName, "mt-6 px-5 py-5 sm:px-6")}>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8f4a18]">
            Submission baseline
          </p>
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {submissionRules.map((rule) => (
              <li key={rule} className="flex items-start gap-3">
                <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#b33d12]" />
                <span className={carnivalCopyClassName}>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8">
          <Countdown />
        </div>
      </div>
    </section>
  );
}
