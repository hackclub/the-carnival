import Image from "next/image";

type SectionBannerProps = {
  title: string;
  id?: string;
  className?: string;
};

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const carnivalPanelClassName = "carnival-panel";
export const carnivalCardClassName = "carnival-card";
export const carnivalCopyClassName =
  "text-sm leading-6 text-[#6d3510] sm:text-base sm:leading-7 [text-wrap:pretty]";
export const carnivalHeadingClassName =
  "font-bold uppercase tracking-[0.08em] text-[#5b1f0a] [text-wrap:balance]";

export function SectionBanner({ title, id, className }: SectionBannerProps) {
  return (
    <div
      id={id}
      className={cx(
        "relative mx-auto flex max-w-6xl items-center justify-center px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8",
        className,
      )}
    >
      <div className="relative w-full">
        <Image
          src="/railing.png"
          alt=""
          width={2160}
          height={226}
          className="h-auto w-full"
        />
        <Image
          src="/left-ropes.png"
          alt=""
          width={248}
          height={463}
          className="pointer-events-none absolute left-[5%] top-[-72px] hidden h-auto w-[clamp(42px,8vw,108px)] sm:block"
        />
        <Image
          src="/right-ropes.png"
          alt=""
          width={233}
          height={375}
          className="pointer-events-none absolute right-[5%] top-[-56px] hidden h-auto w-[clamp(42px,8vw,104px)] sm:block"
        />

        <div className="absolute left-1/2 top-1/2 w-full max-w-[88vw] -translate-x-1/2 -translate-y-[44%] px-3 sm:max-w-none sm:px-0">
          <span className="inline-flex min-h-10 w-full items-center justify-center rounded-[var(--carnival-squircle-radius)] border-[3px] border-[#74210a] bg-[#f6a61c] px-3 py-1.5 text-center text-sm font-bold text-[#fff7dc] shadow-[0_5px_0_#bf6216,0_14px_24px_rgba(120,53,15,0.16)] sm:w-auto sm:px-6 sm:py-3 sm:text-2xl">
            {title}
          </span>
        </div>
      </div>
    </div>
  );
}
