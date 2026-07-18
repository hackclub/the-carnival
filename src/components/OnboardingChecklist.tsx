import Link from "next/link";
import { db } from "@/db";
import {
  buildOnboardingSteps,
  getOnboardingProgress,
  isOnboardingComplete,
} from "@/lib/onboarding";

/**
 * Persistent "get started" checklist shown to signed-in users until they've
 * connected Hackatime, created a project, and posted a devlog. Renders
 * nothing once all three are done.
 *
 * variant "landing" matches the marketing page's cream/red look; "app"
 * matches the dark platform surfaces.
 */
export default async function OnboardingChecklist({
  userId,
  variant,
  className = "",
}: {
  userId: string;
  variant: "landing" | "app";
  className?: string;
}) {
  const progress = await getOnboardingProgress(db, userId);
  if (isOnboardingComplete(progress)) return null;

  const steps = buildOnboardingSteps(progress);
  const doneCount = steps.filter((step) => step.done).length;

  const isLanding = variant === "landing";
  const surface = isLanding
    ? "border-2 border-[#74210a] bg-[#fff7dc] shadow-[4px_4px_0_rgba(116,33,10,1)]"
    : "platform-surface-card";
  const heading = isLanding ? "text-[#5b1f0a]" : "text-foreground";
  const muted = isLanding ? "text-[#8f4a18]" : "text-muted-foreground";
  const stepSurface = isLanding
    ? "border border-[#74210a]/30 bg-white/50"
    : "border border-border bg-background/60";
  const nextRing = isLanding ? "ring-2 ring-[#e08609]" : "ring-2 ring-carnival-red/60";
  const ctaClasses = isLanding
    ? "bg-[#b91c1c] text-white hover:bg-[#9a1616]"
    : "bg-carnival-red text-white hover:bg-carnival-red/80";

  return (
    <section
      aria-label="Getting started checklist"
      className={`mx-auto w-full max-w-4xl rounded-2xl p-5 sm:p-6 ${surface} ${className}`}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className={`text-lg font-bold sm:text-xl ${heading}`}>
          🎪 Get rolling — {doneCount}/{steps.length} done
        </h2>
        <p className={`text-sm ${muted}`}>Three steps between you and your first grant.</p>
      </div>

      <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className={`flex flex-col rounded-xl p-4 ${stepSurface} ${step.isNext ? nextRing : ""}`}
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                  step.done
                    ? "bg-emerald-500 text-white"
                    : isLanding
                      ? "bg-[#74210a] text-[#fff7dc]"
                      : "bg-foreground/15 text-foreground"
                }`}
              >
                {step.done ? "✓" : index + 1}
              </span>
              <h3 className={`font-bold leading-tight ${heading}`}>{step.title}</h3>
            </div>
            <p className={`mt-2 flex-1 text-sm leading-5 ${muted}`}>{step.description}</p>
            {!step.done ? (
              <Link
                href={step.href}
                className={`mt-3 inline-flex h-9 items-center justify-center self-start rounded-lg px-4 text-sm font-bold transition-colors ${ctaClasses}`}
              >
                {step.cta}
              </Link>
            ) : (
              <span className={`mt-3 text-xs font-semibold ${muted}`}>Done!</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
