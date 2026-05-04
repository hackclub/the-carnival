export default function Loading() {
  return (
    <>
      <div
        className="navigation-progress"
        role="status"
        aria-label="Loading"
      >
        <div className="navigation-progress__bar" />
      </div>

      <div className="flex min-h-screen bg-[var(--platform-shell-bg)]">
        {/* Sidebar placeholder (desktop only) */}
        <div className="hidden md:flex w-[260px] shrink-0 flex-col border-r border-[var(--platform-border)] bg-[rgba(255,247,220,0.5)] p-4 gap-4">
          <div className="h-10 w-3/4 rounded-[var(--radius-xl)] skeleton-shimmer" />
          <div className="space-y-2 mt-4">
            <div className="h-8 w-full rounded-[var(--radius-lg)] skeleton-shimmer" />
            <div className="h-8 w-5/6 rounded-[var(--radius-lg)] skeleton-shimmer" />
            <div className="h-8 w-4/6 rounded-[var(--radius-lg)] skeleton-shimmer" />
            <div className="h-8 w-5/6 rounded-[var(--radius-lg)] skeleton-shimmer" />
            <div className="h-8 w-3/6 rounded-[var(--radius-lg)] skeleton-shimmer" />
          </div>
          <div className="mt-auto">
            <div className="h-10 w-full rounded-[var(--radius-xl)] skeleton-shimmer" />
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 min-w-0">
          {/* Top bar placeholder */}
          <div className="h-16 border-b border-[var(--platform-border)] bg-[rgba(255,247,220,0.5)] px-6 flex items-center">
            <div className="h-6 w-48 rounded-[var(--radius-lg)] skeleton-shimmer" />
          </div>

          {/* Content skeleton */}
          <div className="px-6 py-8">
            <div className="mx-auto max-w-6xl space-y-6">
              {/* Header card */}
              <div className="h-24 rounded-[var(--radius-2xl)] border border-[var(--platform-border)] skeleton-shimmer" />

              {/* Grid of cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="h-48 rounded-[var(--radius-2xl)] border border-[var(--platform-border)] skeleton-shimmer" />
                <div className="h-48 rounded-[var(--radius-2xl)] border border-[var(--platform-border)] skeleton-shimmer opacity-80" />
                <div className="h-48 rounded-[var(--radius-2xl)] border border-[var(--platform-border)] skeleton-shimmer opacity-60" />
              </div>

              {/* Full-width card */}
              <div className="h-32 rounded-[var(--radius-2xl)] border border-[var(--platform-border)] skeleton-shimmer opacity-50" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
