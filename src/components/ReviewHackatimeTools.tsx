"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, PlatformNestedSurface } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { buildJoeFraudUrl } from "@/lib/constants";

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

type LinkedProject = {
  id: string;
  name: string;
  isDefault: boolean;
  firstDevlogId: string | null;
};

type Props = {
  projectId: string;
  hackatimeUserId: string | null;
  projectStartedAtIso: string | null;
  submittedAtIso: string | null;
  projectCreatedAtIso: string;
  linkedHackatimeProjects?: LinkedProject[];
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

function trustLevelColor(level: string | null): string {
  if (!level) return "bg-gray-500/15 text-gray-300 border-gray-500/30";
  const normalized = level.toLowerCase();
  if (normalized === "high" || normalized === "verified")
    return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (normalized === "medium" || normalized === "normal")
    return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  if (normalized === "low" || normalized === "suspicious")
    return "bg-rose-500/15 text-rose-300 border-rose-500/30";
  return "bg-gray-500/15 text-gray-300 border-gray-500/30";
}

export default function ReviewHackatimeTools({
  projectId,
  hackatimeUserId,
  projectStartedAtIso,
  submittedAtIso,
  projectCreatedAtIso,
  linkedHackatimeProjects = [],
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

  const joeUrl =
    canBuildLinks && defaultStart && defaultEnd
      ? buildJoeFraudUrl(hackatimeUserId!, defaultStart, defaultEnd)
      : null;

  // "Check a custom window": how much time did the creator log for the
  // linked Hackatime project(s) within an arbitrary date range? Read-only —
  // useful for spotting overlap between devlogs before trimming a devlog's
  // considered window in the assessment panel.
  const [customStart, setCustomStart] = useState(defaultStart ?? "");
  const [customEnd, setCustomEnd] = useState(defaultEnd ?? "");
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [customResult, setCustomResult] = useState<{
    startedAt: string;
    endedAt: string;
    projects: Array<{ name: string; seconds: number }>;
    totalSeconds: number;
  } | null>(null);

  const checkCustomWindow = useCallback(async () => {
    if (!customStart || !customEnd) {
      setCustomError("Pick both a start and an end date.");
      return;
    }
    setCustomLoading(true);
    setCustomError(null);
    try {
      const res = await fetch(`/api/review/${encodeURIComponent(projectId)}/hackatime-range`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startedAt: `${customStart}T00:00:00.000Z`,
          endedAt: `${customEnd}T23:59:59.999Z`,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            startedAt?: string;
            endedAt?: string;
            projects?: Array<{ name: string; seconds: number }>;
            totalSeconds?: number;
            error?: unknown;
          }
        | null;
      if (!res.ok || typeof data?.totalSeconds !== "number") {
        setCustomError(
          typeof data?.error === "string" ? data.error : "Failed to fetch the window.",
        );
        setCustomResult(null);
        setCustomLoading(false);
        return;
      }
      setCustomResult({
        startedAt: data.startedAt ?? "",
        endedAt: data.endedAt ?? "",
        projects: Array.isArray(data.projects) ? data.projects : [],
        totalSeconds: data.totalSeconds,
      });
      setCustomLoading(false);
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : "Failed to fetch the window.");
      setCustomResult(null);
      setCustomLoading(false);
    }
  }, [customEnd, customStart, projectId]);

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Hackatime review tools
            </h3>
            {linkedHackatimeProjects.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {linkedHackatimeProjects.map((lp) => (
                  <span
                    key={lp.id}
                    className={[
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      lp.isDefault
                        ? "border-carnival-blue/40 bg-carnival-blue/10 text-carnival-blue"
                        : "border-border bg-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    <code>{lp.name}</code>
                    {lp.isDefault ? (
                      <span className="ml-1 text-[10px] opacity-70">default</span>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : null}
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
        <PlatformNestedSurface className="p-4">
          <div className="text-sm font-semibold text-foreground mb-3">
            Open in external review tools
          </div>
          {!hasHackatimeUserId ? (
            <div className="text-sm text-muted-foreground">
              The creator has no Hackatime user ID on file, so the Joe.fraud
              link cannot be generated.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <a href={joeUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" type="button">
                  Open in Joe.fraud ↗
                </Button>
              </a>
            </div>
          )}
        </PlatformNestedSurface>

        {/* Custom window lookup: time logged for the linked Hackatime
            project(s) within an arbitrary range — read-only reviewer tool. */}
        <PlatformNestedSurface className="p-4 space-y-3">
          <div>
            <div className="text-sm font-semibold text-foreground">Check a custom window</div>
            <div className="mt-1 text-xs text-muted-foreground">
              See how much time was logged for the linked Hackatime project(s) in any range —
              handy for spotting overlap between devlogs before trimming a devlog&apos;s
              considered window.
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <label className="block">
              <div className="text-xs text-muted-foreground mb-1">Start date</div>
              <DatePicker value={customStart} onChange={setCustomStart} />
            </label>
            <label className="block">
              <div className="text-xs text-muted-foreground mb-1">End date</div>
              <DatePicker value={customEnd} onChange={setCustomEnd} />
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={checkCustomWindow}
              loading={customLoading}
              loadingText="Checking…"
            >
              Check window
            </Button>
          </div>
          {customError ? <div className="text-xs text-red-200">{customError}</div> : null}
          {customResult ? (
            <div className="space-y-1.5 rounded-[var(--radius-xl)] border border-border bg-background px-3 py-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Total logged {customStart} → {customEnd}
                </span>
                <span className="font-semibold text-foreground">
                  {formatHours(customResult.totalSeconds)}
                </span>
              </div>
              {customResult.projects.map((p) => (
                <div key={p.name} className="flex items-center justify-between text-xs">
                  <code className="text-muted-foreground">{p.name}</code>
                  <span className="text-foreground">{formatHours(p.seconds)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </PlatformNestedSurface>

        {/* Inline live Hackatime stats */}
        <PlatformNestedSurface className="p-4">
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
            <div className="mt-3 rounded-[var(--radius-xl)] border border-carnival-red/40 bg-carnival-red/10 text-carnival-red px-3 py-2 text-sm">
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
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${trustLevelColor(stats.trustFactor.trustLevel)}`}>
                    {trustBadgeLabel(
                      stats.trustFactor.trustLevel,
                      stats.trustFactor.trustValue,
                    )}
                  </span>
                </span>
                <span>·</span>
                <span>
                  Total in range:{" "}
                  <span className="text-foreground font-semibold">
                    {stats.humanReadableTotal ?? formatHours(stats.totalSeconds)}
                  </span>
                </span>
              </div>

              <div className="rounded-lg  border border-border bg-background/50 p-3">
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
        </PlatformNestedSurface>
      </CardContent>
    </Card>
  );
}
