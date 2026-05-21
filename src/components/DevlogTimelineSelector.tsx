"use client";

import { useMemo, useState } from "react";
import { PlatformNestedSurface } from "@/components/ui";

export type TimelineSpan = {
  startTime: number; // Unix epoch seconds (float)
  endTime: number;
  duration: number;
  projectsEdited: Array<{ name: string; repoUrl: string | null }>;
  editors: string[];
  languages: string[];
  hasLinkedProject: boolean;
};

type Props = {
  date: string; // YYYY-MM-DD
  spans: TimelineSpan[];
  linkedProjectNames: string[];
  totalCodedTime: number;
  /** Called whenever the derived window changes. Null when nothing is selected. */
  onWindowChange: (window: DevlogWindow | null) => void;
};

function formatTime(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatHoursMinutes(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

type DevlogWindow = { startedAt: Date; endedAt: Date };

/** Smallest window covering the given span indices, or null if none are valid. */
function windowFromIndices(
  spans: TimelineSpan[],
  indices: Iterable<number>,
): DevlogWindow | null {
  let minStart = Infinity;
  let maxEnd = -Infinity;
  for (const i of indices) {
    const span = spans[i];
    if (!span) continue;
    if (span.startTime < minStart) minStart = span.startTime;
    if (span.endTime > maxEnd) maxEnd = span.endTime;
  }
  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) return null;
  return { startedAt: new Date(minStart * 1000), endedAt: new Date(maxEnd * 1000) };
}

/** Horizontal bar visualization of spans within a time window. */
function TimelineBar({
  spans,
  selectedIndices,
  onToggle,
}: {
  spans: TimelineSpan[];
  selectedIndices: Set<number>;
  onToggle: (i: number) => void;
}) {
  if (spans.length === 0) return null;

  const minTime = Math.min(...spans.map((s) => s.startTime));
  const maxTime = Math.max(...spans.map((s) => s.endTime));
  const range = maxTime - minTime;
  if (range <= 0) return null;

  return (
    <div className="relative h-8 w-full rounded-lg bg-muted/50 overflow-hidden border border-border">
      {spans.map((span, i) => {
        const left = ((span.startTime - minTime) / range) * 100;
        const width = Math.max(0.5, ((span.endTime - span.startTime) / range) * 100);
        const isSelected = selectedIndices.has(i);
        const isLinked = span.hasLinkedProject;

        return (
          <button
            key={i}
            type="button"
            onClick={() => onToggle(i)}
            title={`${formatTime(span.startTime)} – ${formatTime(span.endTime)} (${formatDuration(span.duration)})\n${span.projectsEdited.map((p) => p.name).join(", ") || "No projects"}`}
            className={[
              "absolute top-1 bottom-1 rounded transition-all cursor-pointer",
              isSelected
                ? "opacity-100 ring-2 ring-white/50"
                : "opacity-60 hover:opacity-80",
              isLinked
                ? isSelected
                  ? "bg-carnival-blue"
                  : "bg-carnival-blue/70"
                : isSelected
                  ? "bg-muted-foreground"
                  : "bg-muted-foreground/50",
            ].join(" ")}
            style={{ left: `${left}%`, width: `${width}%`, minWidth: "4px" }}
          />
        );
      })}
    </div>
  );
}

export default function DevlogTimelineSelector({
  date,
  spans,
  linkedProjectNames,
  totalCodedTime,
  onWindowChange,
}: Props) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  const derivedWindow = useMemo(
    () => windowFromIndices(spans, selectedIndices),
    [selectedIndices, spans],
  );

  const selectedDuration = useMemo(() => {
    let total = 0;
    for (const i of selectedIndices) {
      total += spans[i]?.duration ?? 0;
    }
    return total;
  }, [selectedIndices, spans]);

  function toggle(i: number) {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      onWindowChange(windowFromIndices(spans, next));
      return next;
    });
  }

  function selectAll() {
    const all = new Set(spans.map((_, i) => i));
    setSelectedIndices(all);
    onWindowChange(windowFromIndices(spans, all));
  }

  function clearAll() {
    setSelectedIndices(new Set());
    onWindowChange(null);
  }

  const linkedNames = linkedProjectNames.join(", ") || "none";

  if (spans.length === 0) {
    return (
      <PlatformNestedSurface className="px-4 py-3 text-sm text-muted-foreground">
        No coding activity found on {date}. Try a different date, or use the manual
        time pickers below.
      </PlatformNestedSurface>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {spans.length} span{spans.length === 1 ? "" : "s"} ·{" "}
          <span className="text-foreground font-semibold">{formatHoursMinutes(totalCodedTime)}</span>{" "}
          total · linked projects:{" "}
          <span className="text-foreground font-medium">{linkedNames}</span>
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="font-semibold text-carnival-blue hover:underline"
          >
            Select all
          </button>
          {selectedIndices.size > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="font-semibold text-muted-foreground hover:underline"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {/* Visual bar */}
      <TimelineBar spans={spans} selectedIndices={selectedIndices} onToggle={toggle} />

      {/* Span list */}
      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
        {spans.map((span, i) => {
          const isSelected = selectedIndices.has(i);
          const projectNames = span.projectsEdited.map((p) => p.name).join(", ");

          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              className={[
                "w-full text-left rounded-[var(--radius-xl)] border px-3 py-2 transition-colors",
                isSelected
                  ? "border-carnival-blue/50 bg-carnival-blue/10"
                  : "border-border bg-background hover:border-muted-foreground/30",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={[
                      "flex-shrink-0 h-3.5 w-3.5 rounded border-2 mt-0.5",
                      isSelected
                        ? "border-carnival-blue bg-carnival-blue"
                        : "border-muted-foreground/40 bg-transparent",
                    ].join(" ")}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {formatTime(span.startTime)} – {formatTime(span.endTime)}
                      <span className="ml-2 text-xs text-muted-foreground font-normal">
                        ({formatDuration(span.duration)})
                      </span>
                    </div>
                    {projectNames ? (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {span.hasLinkedProject ? (
                          <span className="text-carnival-blue font-medium">
                            {projectNames}
                          </span>
                        ) : (
                          projectNames
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
                {span.hasLinkedProject ? (
                  <span className="flex-shrink-0 text-xs font-semibold text-carnival-blue bg-carnival-blue/10 border border-carnival-blue/30 rounded-full px-2 py-0.5">
                    linked
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected range summary */}
      {derivedWindow ? (
        <PlatformNestedSurface className="px-3 py-2 text-sm">
          <span className="text-muted-foreground">Selected window: </span>
          <span className="font-semibold text-foreground">
            {formatTime(derivedWindow.startedAt.getTime() / 1000)} –{" "}
            {formatTime(derivedWindow.endedAt.getTime() / 1000)}
          </span>
          <span className="text-muted-foreground">
            {" "}· {formatHoursMinutes(selectedDuration)} raw span time
            {selectedIndices.size > 1 ? ` across ${selectedIndices.size} spans` : ""}
          </span>
        </PlatformNestedSurface>
      ) : (
        <PlatformNestedSurface className="px-3 py-2 text-sm text-muted-foreground">
          Select one or more spans above to set your working window, or use the manual
          pickers below.
        </PlatformNestedSurface>
      )}
    </div>
  );
}
