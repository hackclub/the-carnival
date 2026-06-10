"use client";

import { useState } from "react";

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

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="mt-8">
      {faqs.map((faq, index) => {
        const isOpen = openIndex === index;

        return (
          <div
            key={faq.id}
            className="border-b-2 border-dashed border-[#b4621f]/40"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? -1 : index)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 py-5 text-left"
            >
              <span className="text-lg font-bold text-[#5b1f0a] [text-wrap:balance] sm:text-xl">
                {faq.question}
              </span>
              <span
                aria-hidden="true"
                className={`shrink-0 text-3xl font-bold leading-none text-[#e08609] transition-transform duration-200 ${
                  isOpen ? "rotate-45" : ""
                }`}
              >
                +
              </span>
            </button>

            <div
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <p className="pb-5 text-base leading-7 text-[#6d3510] [text-wrap:pretty]">
                  {faq.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
