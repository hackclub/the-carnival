import Link from "next/link";
import Header from "@/components/Header";
import FloatingBalloons from "@/components/landing/FloatingBalloons";
import FAQSection from "@/components/home/FAQSection";
import GetInvolvedSection from "@/components/home/GetInvolvedSection";
import LogoSection from "@/components/home/LogoSection";
import RewardSection from "@/components/home/RewardSection";
import SubmissionSection from "@/components/home/SubmissionSection";
import WorkSection from "@/components/home/WorkSection";

export default function Home() {
  return (
    <main className="carnival-home-bg relative min-h-screen overflow-x-clip text-[#5b1f0a]">
      <FloatingBalloons />
      <div className="carnival-paper-grid pointer-events-none absolute inset-0 -z-10 opacity-30" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.32)_0%,_transparent_68%)]" />

      <Header />
      <LogoSection />
      <WorkSection />
      <SubmissionSection />
      <RewardSection />
      <GetInvolvedSection />
      <FAQSection />

      <footer className="px-4 pb-12 sm:px-6 lg:px-8">
        <div className="carnival-card carnival-card-soft mx-auto max-w-6xl px-6 py-8 text-center sm:px-8">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">🎪</span>
            <span className="text-xl font-bold uppercase tracking-[0.08em] text-[#5b1f0a]">
              The Carnival
            </span>
          </div>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#6d3510] sm:text-base">
            Build something you genuinely care about, ship it in public, and
            let the midway fund what comes next.
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="https://hackclub.slack.com/archives/C091ZRTMF16"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--carnival-squircle-radius)] border-2 border-[#74210a] bg-[#f6a61c] px-4 py-2 text-center text-sm font-bold uppercase tracking-[0.04em] text-[#fff7dc] transition-colors duration-200 hover:bg-[#ee9817] sm:w-auto"
            >
              Join #carnival
            </Link>
            <Link
              href="/projects"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--carnival-squircle-radius)] border-2 border-[#74210a] bg-[#fff7dc] px-4 py-2 text-center text-sm font-bold uppercase tracking-[0.04em] text-[#74210a] transition-colors duration-200 hover:bg-[#fff0cf] sm:w-auto"
            >
              Enter the dashboard
            </Link>
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-[#8f4a18]">
            © 2026 YSWS Carnival by Hack Club
          </p>
        </div>
      </footer>
    </main>
  );
}
