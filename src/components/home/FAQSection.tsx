"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  SectionBanner,
  carnivalCardClassName,
  carnivalCopyClassName,
  carnivalHeadingClassName,
  carnivalPanelClassName,
  cx,
} from "@/components/home/shared";

const faqs = [
  {
    id: "extension-scope",
    question: "What counts as an extension?",
    answer:
      "Plugins, add-ons, widgets, and other tools that extend an existing app or editor all count. The key is that it meaningfully improves or transforms the experience.",
  },
  {
    id: "track-time",
    question: "How do I track my time?",
    answer:
      "Use Hackatime to log real coding hours. Carnival converts those honest hours into grant money at +$4 per hour, so accuracy matters.",
  },
  {
    id: "teams",
    question: "Can I work in a team?",
    answer:
      "No. Carnival is solo only, so each submission needs to be built and submitted by one person.",
  },
  {
    id: "double-dipping",
    question: "Can I double-dip with another program or event?",
    answer:
      "No. Double-dipping is not allowed. The work you submit to Carnival should not also be claimed for another grant program or event payout.",
  },
  {
    id: "tool-not-listed",
    question: "What if my editor or app is not listed?",
    answer:
      "That is still fair game. If nobody has shipped for that tool yet, you may even qualify for the first-on-a-new-editor bonus.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="relative px-4 pb-20 pt-16 sm:px-6 lg:px-8">
      <SectionBanner id="faq" title="FAQ" />

      <div className="mx-auto mt-10 grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div
          className={cx(
            carnivalPanelClassName,
            "px-5 py-6 sm:px-6 sm:py-8 lg:sticky lg:top-6",
          )}
        >
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8f4a18]">
            Questions by the campfire
          </p>
          <h2
            className={cx(
              carnivalHeadingClassName,
              "mt-3 text-3xl sm:text-[2.4rem]",
            )}
          >
            The fast answers before you ship.
          </h2>
          <p className={cx(carnivalCopyClassName, "mt-4")}>
            If you still feel unsure after this, ask in public. Most Carnival
            questions get resolved faster in the Slack channel.
          </p>

          <div
            className={cx(
              carnivalCardClassName,
              "carnival-card-soft mt-6 px-5 py-5",
            )}
          >
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8f4a18]">
              Need more context?
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <Link
                href="https://hackclub.slack.com/archives/C091ZRTMF16"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full border-[3px] border-[#74210a] bg-[#f6a61c] px-4 py-2 text-center text-sm font-black uppercase tracking-[0.08em] text-[#fff7dc] shadow-[0_5px_0_#bf6216] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_0_#bf6216] active:scale-[0.96] sm:w-auto"
              >
                Ask in #carnival
              </Link>
              <Link
                href="/editors"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full border-[3px] border-[#74210a] bg-[#fff7dc] px-4 py-2 text-center text-sm font-black uppercase tracking-[0.08em] text-[#74210a] shadow-[0_5px_0_#d78b22] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_0_#d78b22] active:scale-[0.96] sm:w-auto"
              >
                Browse editors and apps
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:pt-8">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;

            return (
              <button
                key={faq.id}
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                aria-expanded={isOpen}
                className={cx(
                  carnivalCardClassName,
                  "block w-full overflow-hidden px-5 py-5 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_0_#d78b22,0_20px_34px_rgba(120,53,15,0.15)] sm:px-6",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8f4a18]">
                      Question {index + 1}
                    </p>
                    <h3 className="mt-2 text-xl font-black text-[#5b1f0a] [text-wrap:balance] sm:text-2xl">
                      {faq.question}
                    </h3>
                  </div>
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] border-[#74210a] bg-[#fff0cf] text-[#74210a] shadow-[0_4px_0_#d78b22]">
                    <ChevronDown
                      className={cx(
                        "transition-transform duration-200",
                        isOpen && "rotate-180",
                      )}
                      size={20}
                    />
                  </span>
                </div>

                <div
                  className={cx(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                    isOpen
                      ? "mt-4 grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className={carnivalCopyClassName}>{faq.answer}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
