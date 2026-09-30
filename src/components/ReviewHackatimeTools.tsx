"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";

type Props = {
  projectId: string;
  /** YYYY-MM-DD; seeded from the project's considered Hackatime range. */
  defaultStartDate: string;
  defaultEndDate: string;
};

function formatHours(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0h 0m";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export default function ReviewHackatimeTools({ projectId, defaultStartDate, defaultEndDate }: Props) {
  // "Check a custom window": how much time did the creator log for the
  // linked Hackatime project(s) within an arbitrary date range? Read-only —
  // useful for spotting overlap between devlogs before trimming a devlog's
  // considered window in the assessment panel.
  const [customStart, setCustomStart] = useState(defaultStartDate);
  const [customEnd, setCustomEnd] = useState(defaultEndDate);
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
    <div className="space-y-3">
      <div>
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
              Total logged {customResult.startedAt.slice(0, 10) || customStart} →{" "}
              {customResult.endedAt.slice(0, 10) || customEnd}
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
    </div>
  );
}
