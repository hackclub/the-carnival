"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent } from "@/components/ui";

type HackatimeProject = {
  name: string;
  totalSeconds: number;
  humanReadable: string | null;
  percent: number | null;
};

type HackatimeStats = {
  projectHackatimeName: string;
  startDate: string;
  endDate: string;
  totalSeconds: number;
  humanReadableTotal: string | null;
  humanReadableRange: string | null;
  trustFactor: {
    trustLevel: string | null;
    trustValue: number | null;
  };
  matchedProject: HackatimeProject | null;
  projects: HackatimeProject[];
  creator: {
    slackId: string;
    hackatimeUserId: string | null;
  };
};

type Props = {
  projectId: string;
  hackatimeUserId: string | null;
  projectStartedAtIso: string | null;
  submittedAtIso: string | null;
  projectCreatedAtIso: string;
};

function toDateOnly(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function formatHours(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0h 0m";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function trustBadgeLabel(level: string | null, value: number | null): string {
  if (!level) return "unknown trust";
  if (value === null) return level;
  return `${level} (${value})`;
}

export default function ReviewHackatimeTools({
  projectId,
  hackatimeUserId,
  projectStartedAtIso,
  submittedAtIso,
  projectCreatedAtIso,
}: Props) {
  const defaultStart =
    toDateOnly(projectStartedAtIso) ?? toDateOnly(projectCreatedAtIso) ?? null;
  const defaultEnd = toDateOnly(submittedAtIso) ?? toDateOnly(new Date().toISOString());

  const [stats, setStats] = useState<HackatimeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllProjects, setShowAllProjects] = useState(false);

  const loadStats = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/hackatime-stats`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          details?: string;
        };
        setError(data.error ?? `Request failed (${response.status})`);
        setStats(null);
        return;
      }
      const data = (await response.json()) as HackatimeStats;
      setStats(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const hasHackatimeUserId = Boolean(hackatimeUserId);
  const canBuildLinks = hasHackatimeUserId && defaultStart && defaultEnd;
  const linkDateRange =
    defaultStart && defaultEnd ? `${defaultStart}-${defaultEnd}` : null;

  const billyUrl =
    canBuildLinks && linkDateRange
      ? `https://billy.3kh0.net/?u=${encodeURIComponent(hackatimeUserId!)}&d=${encodeURIComponent(linkDateRange)}`
      : null;
  const joeUrl =
    canBuildLinks && linkDateRange
      ? `https://joe.fraud.hackclub.com/billy?u=${encodeURIComponent(hackatimeUserId!)}&d=${encodeURIComponent(linkDateRange)}`
      : null;

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Hackatime review tools
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Window considered:{" "}
              <span className="text-foreground font-semibold">
                {defaultStart ?? "?"} → {defaultEnd ?? "?"}
              </span>
              {projectStartedAtIso === null ? (
                <span className="ml-2 inline-block rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-600 dark:text-yellow-400">
                  Using project creation date (no Carnival start recorded)
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {/* Outbound review tool links */}
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="text-sm font-semibold text-foreground mb-3">
            Open in external review tools
          </div>
          {!hasHackatimeUserId ? (
            <div className="text-sm text-muted-foreground">
              The creator has no Hackatime user ID on file, so Billy and Joe.fraud
              links cannot be generated.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <a href={billyUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" type="button">
                  Open in Billy ↗
                </Button>
              </a>
              <a href={joeUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" type="button">
                  Open in Joe.fraud ↗
                </Button>
              </a>
            </div>
          )}
        </div>

        {/* Inline live Hackatime stats */}
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-foreground">
              Live Hackatime stats
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={loadStats}
              loading={loading}
              loadingText="Refreshing…"
              className="text-xs py-1 px-3"
            >
              Refresh
            </Button>
          </div>

          {error ? (
            <div className="mt-3 rounded-xl border border-carnival-red/40 bg-carnival-red/10 text-carnival-red px-3 py-2 text-sm">
              {error}
            </div>
          ) : null}

          {loading && !stats ? (
            <div className="mt-3 text-sm text-muted-foreground">
              Loading Hackatime data…
            </div>
          ) : null}

          {stats ? (
            <div className="mt-3 space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Range:{" "}
                  <span className="text-foreground font-semibold">
                    {stats.startDate} → {stats.endDate}
                  </span>
                </span>
                <span>·</span>
                <span>
                  Trust:{" "}
                  <Badge>
                    {trustBadgeLabel(
                      stats.trustFactor.trustLevel,
                      stats.trustFactor.trustValue,
                    )}
                  </Badge>
                </span>
                <span>·</span>
                <span>
                  Total in range:{" "}
                  <span className="text-foreground font-semibold">
                    {stats.humanReadableTotal ?? formatHours(stats.totalSeconds)}
                  </span>
                </span>
              </div>

              <div className="rounded-lg border border-border bg-background/50 p-3">
                <div className="text-xs text-muted-foreground">
                  Hackatime project:{" "}
                  <code className="text-foreground">
                    {stats.projectHackatimeName}
                  </code>
                </div>
                {stats.matchedProject ? (
                  <div className="mt-2 text-sm">
                    <div className="text-foreground font-semibold">
                      {stats.matchedProject.humanReadable ??
                        formatHours(stats.matchedProject.totalSeconds)}
                    </div>
                    {typeof stats.matchedProject.percent === "number" ? (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {stats.matchedProject.percent.toFixed(1)}% of total time
                        in window
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-carnival-red">
                    No matching Hackatime project found for this window.
                  </div>
                )}
              </div>

              {stats.projects.length > 0 ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAllProjects((v) => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showAllProjects
                      ? "Hide other projects in this range"
                      : `Show all ${stats.projects.length} project${stats.projects.length === 1 ? "" : "s"} in this range`}
                  </button>
                  {showAllProjects ? (
                    <ul className="mt-2 space-y-1 text-sm">
                      {stats.projects.map((proj) => (
                        <li
                          key={proj.name}
                          className={`flex items-center justify-between rounded px-2 py-1 ${
                            proj.name.trim().toLowerCase() ===
                            stats.projectHackatimeName.trim().toLowerCase()
                              ? "bg-carnival-blue/10"
                              : ""
                          }`}
                        >
                          <code className="truncate text-foreground">
                            {proj.name}
                          </code>
                          <span className="text-muted-foreground text-xs">
                            {proj.humanReadable ?? formatHours(proj.totalSeconds)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
