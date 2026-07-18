// Pure onboarding-step logic, shared by the checklist component and tests.
// DB reads live in onboarding.ts.

export type OnboardingProgress = {
  hackatimeConnected: boolean;
  hasProject: boolean;
  hasDevlog: boolean;
  // True once any project was submitted for review. Some early participants
  // shipped before devlogs existed; they don't need onboarding either.
  hasSubmittedProject: boolean;
  firstProjectId: string | null;
};

export type OnboardingStep = {
  key: "hackatime" | "project" | "devlog";
  title: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
  isNext: boolean;
};

export function isOnboardingComplete(progress: OnboardingProgress): boolean {
  if (progress.hasSubmittedProject) return true;
  return progress.hackatimeConnected && progress.hasProject && progress.hasDevlog;
}

export function buildOnboardingSteps(progress: OnboardingProgress): OnboardingStep[] {
  const steps: Omit<OnboardingStep, "isNext">[] = [
    {
      key: "hackatime",
      title: "Connect Hackatime",
      description: "Hackatime tracks your coding time — it's how your hours turn into a grant.",
      href: "/account",
      cta: "Connect",
      done: progress.hackatimeConnected,
    },
    {
      key: "project",
      title: "Create your first project",
      description: "Pick an extension or plugin idea (or grab a bounty) and register it.",
      href: "/projects?new=1",
      cta: "Create",
      done: progress.hasProject,
    },
    {
      key: "devlog",
      title: "Post your first devlog",
      description: "Write a short update about what you built — devlogs back up your hours.",
      href: progress.firstProjectId
        ? `/projects/${encodeURIComponent(progress.firstProjectId)}/devlogs/new`
        : "/projects",
      cta: "Write",
      done: progress.hasDevlog,
    },
  ];

  const nextIndex = steps.findIndex((step) => !step.done);
  return steps.map((step, index) => ({ ...step, isNext: index === nextIndex }));
}

export function countDoneSteps(progress: OnboardingProgress): number {
  return buildOnboardingSteps(progress).filter((step) => step.done).length;
}
