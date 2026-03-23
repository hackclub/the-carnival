import {
  SectionBanner,
  carnivalCardClassName,
  carnivalCopyClassName,
  carnivalHeadingClassName,
  carnivalPanelClassName,
  cx,
} from "@/components/home/shared";

const rewards = [
  {
    amount: "+$10",
    subtitle: "First on a new editor/app",
    description:
      "Ship the first original extension for an editor or app nobody else has claimed yet.",
  },
  {
    amount: "+$25",
    subtitle: "Goes viral",
    description:
      "Make something people love. Think 100+ GitHub stars or 250+ social likes.",
  },
  {
    amount: "+$5 to $20",
    subtitle: "Wildcard bonus",
    description:
      "Extra love for projects that are especially creative, funny, or technically sharp.",
  },
];

export default function SubmissionSection() {
  return (
    <section className="relative px-4 py-16 sm:px-6 lg:px-8">
      <SectionBanner title="Submission" />

      <div
        className={cx(
          carnivalPanelClassName,
          "mx-auto mt-10 max-w-6xl px-5 py-8 sm:px-8 sm:py-10",
        )}
      >
        <div className="relative z-10 text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8f4a18]">
            Sweet deals on submission
          </p>
          <h2
            className={cx(
              carnivalHeadingClassName,
              "mt-3 text-3xl sm:text-[2.4rem]",
            )}
          >
            Bonus boosts for standout builds.
          </h2>
          <p className={cx(carnivalCopyClassName, "mx-auto mt-3 max-w-2xl")}>
            Be original, make something people genuinely want to use, and stack
            bonus grant money on top of your tracked hours.
          </p>
        </div>

        <div className="relative mt-10">
          <span className="carnival-wood-strip absolute left-4 right-4 top-1/2 hidden h-5 -translate-y-1/2 rounded-full md:block" />

          <div className="relative grid gap-5 md:grid-cols-3">
            {rewards.map((reward) => (
              <article
                key={reward.subtitle}
                className={cx(
                  carnivalCardClassName,
                  "carnival-card-soft px-5 py-6 text-center sm:px-6",
                )}
              >
                <p className="text-4xl font-black leading-none text-[#5b1f0a] sm:text-5xl">
                  {reward.amount}
                </p>
                <h3 className="mt-3 text-lg font-black uppercase tracking-[0.08em] text-[#8f4a18] [text-wrap:balance]">
                  {reward.subtitle}
                </h3>
                <p className={cx(carnivalCopyClassName, "mt-4")}>
                  {reward.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
