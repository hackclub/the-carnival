import Image from "next/image";
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
    title: "Build Something Original",
    description:
      "Start with a real annoyance, workflow gap, or playful idea people will actually want to keep using.",
    bullets: ["Quality-of-life upgrades win", "Thin wrappers usually do not"],
  },
  {
    title: "Ship It Open Source",
    description:
      "Publish clear code, a usable release, and enough context that someone else can install and understand it.",
    bullets: ["Add a README and screenshots", "Get real people trying it"],
  },
  {
    title: "Submit and Claim Rewards",
    description:
      "Track honest time with Hackatime, share what you built, and turn the work into grant money for your setup.",
    bullets: ["Every honest hour adds +$4", "Double-dipping is not allowed"],
  },
];

export default function WorkSection() {
  return (
    <section className="relative px-4 py-16 sm:px-6 lg:px-8">
      <SectionBanner id="about" title="How It Works" />

      <div className="mx-auto mt-10 grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-start">
        <div
          className={cx(
            carnivalPanelClassName,
            "group min-h-[360px] px-5 py-6 sm:min-h-[620px] sm:px-6 sm:py-8",
          )}
        >
          <div className="relative h-full min-h-[300px] sm:min-h-[540px]">
            <Image
              src="/tent.png"
              alt=""
              width={674}
              height={440}
              className="absolute left-0 top-0 h-auto w-[44%] max-w-[170px] rotate-[-3deg] object-contain transition-transform duration-300 group-hover:-translate-y-2 sm:max-w-[240px]"
            />

            <div className="absolute left-[22%] top-[18%] hidden h-[46%] w-[52%] min-w-[220px] md:block">
              <Image
                src="/stair-1.png"
                alt=""
                width={550}
                height={700}
                className="absolute left-[8%] top-0 h-full w-auto object-contain"
              />
              <Image
                src="/stair-path-1.png"
                alt=""
                width={550}
                height={700}
                className="absolute left-[8%] top-0 h-full w-auto object-contain"
              />
            </div>

            <div className="absolute left-[24%] top-[50%] hidden h-[20%] w-[58%] md:block">
              <Image
                src="/stair-2.png"
                alt=""
                width={950}
                height={400}
                className="absolute left-0 top-0 h-full w-auto object-contain"
              />
              <Image
                src="/stair-path-2.png"
                alt=""
                width={950}
                height={400}
                className="absolute left-0 top-0 h-full w-auto scale-x-105 object-contain"
              />
            </div>

            <Image
              src="/carousel.png"
              alt=""
              width={562}
              height={606}
              className="absolute right-0 top-[28%] h-auto w-[38%] max-w-[140px] rotate-[4deg] object-contain transition-transform duration-300 group-hover:-translate-y-2 sm:top-[24%] sm:max-w-[200px]"
            />
            <Image
              src="/ferris-wheel.png"
              alt=""
              width={516}
              height={525}
              className="absolute bottom-0 left-[3%] h-auto w-[42%] max-w-[160px] rotate-[-4deg] object-contain transition-transform duration-300 group-hover:-translate-y-2 sm:max-w-[220px]"
            />
          </div>
        </div>

        <div className="space-y-5 lg:pt-8">
          {steps.map((step, index) => (
            <article
              key={step.title}
              className={cx(
                carnivalCardClassName,
                "px-5 py-5 sm:px-6 sm:py-6",
                index === 1 && "lg:ml-10",
                index === 2 && "lg:mr-10",
              )}
            >
              <div className="flex items-start gap-4">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[3px] border-[#74210a] bg-[#f6a61c] text-lg font-bold text-[#fff7dc] shadow-[0_4px_0_#bf6216]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h2 className={cx(carnivalHeadingClassName, "text-xl sm:text-2xl")}>
                    {step.title}
                  </h2>
                  <p className={cx(carnivalCopyClassName, "mt-2")}>
                    {step.description}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {step.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-3">
                        <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#b33d12]" />
                        <span className="text-sm font-semibold leading-6 text-[#74210a] sm:text-base">
                          {bullet}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
