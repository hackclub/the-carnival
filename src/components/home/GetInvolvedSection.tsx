import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  SectionBanner,
  carnivalCardClassName,
  carnivalCopyClassName,
  carnivalHeadingClassName,
  carnivalPanelClassName,
  cx,
} from "@/components/home/shared";

const steps = [
  {
    title: "Join the #carnival channel",
    desc: "Ask questions, share progress, and trade ideas with the community in Slack.",
  },
  {
    title: "Set up Hackatime",
    desc: "Track real coding time so your hours can convert into grant money.",
  },
  {
    title: "Build your extension",
    desc: "Ship something original for an editor, app, browser, or creative tool.",
  },
  {
    title: "Submit for review",
    desc: "Show the screenshots, explain the work, and claim your rewards.",
  },
];

export default function GetInvolvedSection() {
  return (
    <section className="relative px-4 py-16 sm:px-6 lg:px-8">
      <SectionBanner title="Get Involved" />

      <div className="mx-auto mt-10 grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className={cx(carnivalPanelClassName, "px-5 py-7 sm:px-8 sm:py-8")}>
          <div className="relative">
            <ul className="space-y-4">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className={cx(carnivalCardClassName, "px-5 py-5 sm:px-6")}
                >
                  <div className="flex items-start gap-4">
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[3px] border-[#74210a] bg-[#f6a61c] text-lg font-black text-[#fff7dc] shadow-[0_4px_0_#bf6216]">
                      {index + 1}
                    </span>
                    <div>
                      <h2
                        className={cx(
                          carnivalHeadingClassName,
                          "text-xl sm:text-2xl",
                        )}
                      >
                        {step.title}
                      </h2>
                      <p className={cx(carnivalCopyClassName, "mt-2")}>
                        {step.desc}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-5 lg:pt-8">
          <div className={cx(carnivalCardClassName, "px-5 py-5 sm:px-6")}>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8f4a18]">
              Join the midway
            </p>
            <h2
              className={cx(
                carnivalHeadingClassName,
                "mt-2 text-2xl sm:text-[2rem]",
              )}
            >
              Build in public and ask for feedback early.
            </h2>
            <p className={cx(carnivalCopyClassName, "mt-3")}>
              The fastest way to get unstuck is to show people what you&apos;re
              making while it&apos;s still messy.
            </p>
            <Link
              href="https://hackclub.slack.com/archives/C091ZRTMF16"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--carnival-squircle-radius)] border-2 border-[#74210a] bg-[#f6a61c] px-4 py-2 text-center text-sm font-black uppercase tracking-[0.04em] text-[#fff7dc] transition-colors duration-200 hover:bg-[#ee9817] sm:w-auto"
            >
              Open #carnival on Slack
              <ArrowRight size={16} />
            </Link>
          </div>

          <div
            className={cx(
              carnivalCardClassName,
              "carnival-card-soft px-5 py-5 sm:px-6",
            )}
          >
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8f4a18]">
              When you&apos;re ready
            </p>
            <h2
              className={cx(
                carnivalHeadingClassName,
                "mt-2 text-2xl sm:text-[2rem]",
              )}
            >
              Start a project, track your hours, then submit the best version.
            </h2>
            <p className={cx(carnivalCopyClassName, "mt-3")}>
              Your grant value grows from real progress, polished screenshots,
              and a clear explanation of why the tool matters.
            </p>
            <Link
              href="/projects/new"
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--carnival-squircle-radius)] border-2 border-[#74210a] bg-[#fff7dc] px-4 py-2 text-center text-sm font-black uppercase tracking-[0.04em] text-[#74210a] transition-colors duration-200 hover:bg-[#fff0cf] sm:w-auto"
            >
              Start a project
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
