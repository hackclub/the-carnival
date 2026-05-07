import {
  SectionBanner,
  carnivalCardClassName,
  carnivalCopyClassName,
  carnivalHeadingClassName,
  carnivalPanelClassName,
  cx,
} from "@/components/home/shared";

const rewardCards = [
  {
    icon: "🎨",
    title: "Creative Tools",
    items: [
      "Procreate license",
      "JetBrains IDE license",
      "Design tools",
      "Cursor Pro",
    ],
  },
  {
    icon: "🖥️",
    title: "Hardware & Setup",
    items: [
      "Peripherals",
      "Computer upgrades",
      "Development hardware",
      "Specialty devices",
    ],
  },
  {
    icon: "🔑",
    title: "Infrastructure",
    items: [
      "Domain credits",
      "Cloud hosting",
      "API access",
      "Development services",
    ],
  },
];

export default function RewardSection() {
  return (
    <section className="relative px-4 py-16 sm:px-6 lg:px-8">
      <SectionBanner id="rewards" title="Rewards" />

      <div
        className={cx(
          carnivalPanelClassName,
          "mx-auto mt-10 max-w-6xl px-5 py-8 sm:px-8 sm:py-10",
        )}
      >
        <div className="relative z-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8f4a18]">
            Upgrade your setup
          </p>
          <h2
            className={cx(
              carnivalHeadingClassName,
              "mt-3 text-3xl sm:text-[2.4rem]",
            )}
          >
            Turn honest hours into tools you actually want.
          </h2>
          <p className={cx(carnivalCopyClassName, "mx-auto mt-3 max-w-2xl")}>
            Carnival grants are meant to make your workflow better, faster, or
            weirder in the best possible way.
          </p>
        </div>

        <div className="relative mt-10">
          <span className="carnival-wood-strip absolute left-4 right-4 top-1/2 hidden h-5 -translate-y-1/2 rounded-full md:block" />

          <div className="relative grid gap-5 md:grid-cols-3">
            {rewardCards.map((card) => (
              <article
                key={card.title}
                className={cx(carnivalCardClassName, "px-5 py-6 sm:px-6")}
              >
                <h3 className="flex items-center gap-3 text-2xl font-bold text-[#5b1f0a] sm:text-[1.75rem]">
                  <span className="text-[2rem]" role="img" aria-hidden="true">
                    {card.icon}
                  </span>
                  <span className="[text-wrap:balance]">{card.title}</span>
                </h3>
                <ul className="mt-5 space-y-3">
                  {card.items.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#b33d12]" />
                      <span className={carnivalCopyClassName}>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
