"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Card, CardContent, FormLabel, Input, Textarea } from "@/components/ui";
import type { DevlogAssessmentDecision, DevlogHackatimeProjectAdjustment } from "@/db/schema";
import {
  assessmentDeflatesHours,
  effectiveSecondsForAssessment,
  sumHackatimeAdjustmentSeconds,
  type DevlogAssessmentDraft,
} from "@/lib/devlog-assessments";
import { buildHackatimeDevlogReviewUrls } from "@/lib/constants";
import { formatDurationHM } from "@/lib/devlog-shared";
import { aiDeflatedSeconds } from "@/lib/review/config";
import { REVIEW_DEFLATION_REASON_OPTIONS } from "@/lib/review-rules";
import { DateTimePicker } from "@/components/ui/date-picker";
import toast from "react-hot-toast";

/** ISO timestamp → datetime-local input value (local time, minute precision). */
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type ReviewDevlogFull = {
  id: string;
  title: string;
  content: string;
  authorName: string;
  createdAt: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  attachments: string[];
  usedAi: boolean;
  aiUsageDescription: string | null;
  hackatimeProjectNameSnapshot: string;
};

export type DevlogHackatimeBreakdownEntry = {
  name: string;
  seconds: number;
};

type Props = {
  projectId: string;
  hackatimeUserId?: string | null;
  devlogs: ReviewDevlogFull[];
  assessments: Record<string, DevlogAssessmentDraft>;
  // Must accept functional updates (React setState dispatch): draft edits are
  // applied against the LATEST state, never against a render-time snapshot.
  // With a plain `(next) => void` signature, async flows (e.g. the reviewed-
  // window Hackatime pull resolving after the reviewer ticked reasons or
  // typed a note) would overwrite those fields with a stale copy.
  onChange: React.Dispatch<React.SetStateAction<Record<string, DevlogAssessmentDraft>>>;
  onRefreshHackatime?: (devlogId: string) => void;
  refreshingDevlogIds?: Set<string>;
  readOnly?: boolean;
  hackatimeBreakdownByDevlogId?: Record<string, DevlogHackatimeBreakdownEntry[]>;
  hackatimeBreakdownConfigured?: boolean;
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const DECISION_STYLE: Record<DevlogAssessmentDecision, string> = {
  accepted: "border-emerald-500/60 bg-emerald-500/10 text-emerald-200",
  rejected: "border-carnival-red/60 bg-carnival-red/10 text-red-200",
  adjusted: "border-amber-500/60 bg-amber-500/10 text-amber-200",
};

function AssessmentButtons({
  devlogId,
  current,
  onSelect,
  disabled,
}: {
  devlogId: string;
  current: DevlogAssessmentDecision | null;
  onSelect: (decision: DevlogAssessmentDecision) => void;
  disabled?: boolean;
}) {
  const opts: Array<{ key: DevlogAssessmentDecision; label: string }> = [
    { key: "accepted", label: "Accept" },
    { key: "adjusted", label: "Adjust" },
    { key: "rejected", label: "Reject" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((o) => {
        const active = current === o.key;
        return (
          <button
            key={`${devlogId}-${o.key}`}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(o.key)}
            className={[
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              active
                ? DECISION_STYLE[o.key]
                : "border-border bg-background hover:bg-muted text-foreground",
              disabled ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function DevlogHackatimeBreakdown({
  entries,
  configured,
  devlogProjectName,
}: {
  entries: DevlogHackatimeBreakdownEntry[];
  configured: boolean;
  devlogProjectName: string;
}) {
  const nonZero = entries.filter((e) => e.seconds > 0);
  if (!configured) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Per-project breakdown unavailable (admin timeline not configured).
        {devlogProjectName ? (
          <>
            {" "}Recorded under <code className="text-foreground">{devlogProjectName}</code>.
          </>
        ) : null}
      </div>
    );
  }
  if (nonZero.length === 0) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        No linked Hackatime project recorded time in this window.
      </div>
    );
  }

  const total = nonZero.reduce((acc, e) => acc + e.seconds, 0);
  const recordedKey = devlogProjectName.trim().toLowerCase();
  return (
    <div className="rounded-[var(--radius-xl)] border border-border bg-muted/40 px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Hackatime contribution in this window</span>
        <span className="font-semibold text-foreground">{formatDurationHM(total).label}</span>
      </div>
      <ul className="space-y-1">
        {nonZero.map((entry) => {
          const percent = total > 0 ? Math.round((entry.seconds / total) * 1000) / 10 : 0;
          const isRecorded = entry.name.trim().toLowerCase() === recordedKey;
          return (
            <li key={entry.name} className="text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <code className="truncate text-foreground">{entry.name}</code>
                  {isRecorded ? (
                    <span className="rounded-full border border-carnival-blue/30 bg-carnival-blue/10 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide text-carnival-blue">
                      recorded
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {formatDurationHM(entry.seconds).label}
                  </span>
                  <span>{percent.toFixed(1)}%</span>
                </div>
              </div>
              <div
                className="mt-1 h-1 w-full overflow-hidden rounded-full bg-background"
                aria-hidden="true"
              >
                <div
                  className={`h-full ${isRecorded ? "bg-carnival-blue" : "bg-emerald-500/70"}`}
                  style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ProjectAdjustmentRow({
  name,
  capSeconds,
  seconds,
  onChangeSeconds,
  disabled,
}: {
  name: string;
  capSeconds: number;
  seconds: number;
  onChangeSeconds: (next: number) => void;
  disabled?: boolean;
}) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;

  function setHM(h: number, m: number) {
    const safeH = Math.max(0, Math.floor(h));
    const safeM = Math.max(0, Math.min(59, Math.floor(m)));
    onChangeSeconds(safeH * 3600 + safeM * 60);
  }

  return (
    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
      <div className="min-w-0">
        <FormLabel size="small">Hackatime project</FormLabel>
        <div className="truncate">
          <code className="text-sm text-foreground">{name}</code>
        </div>
      </div>
      <label className="block">
        <FormLabel size="small">Hours</FormLabel>
        <Input
          size="small"
          type="number"
          min={0}
          step={1}
          value={hours}
          onChange={(e) => setHM(Number(e.target.value || 0), minutes)}
          disabled={disabled}
        />
      </label>
      <label className="block">
        <FormLabel size="small">Minutes</FormLabel>
        <Input
          size="small"
          type="number"
          min={0}
          max={59}
          step={1}
          value={minutes}
          onChange={(e) => setHM(hours, Number(e.target.value || 0))}
          disabled={disabled}
        />
      </label>
      <div className="pb-2 text-xs text-muted-foreground whitespace-nowrap">
        of {formatDurationHM(capSeconds).label} logged
      </div>
    </div>
  );
}

function DevlogItem({
  projectId,
  hackatimeUserId,
  devlog,
  draft,
  onChange,
  onRefreshHackatime,
  refreshing,
  readOnly,
  breakdownEntries,
  breakdownConfigured,
}: {
  projectId: string;
  hackatimeUserId?: string | null;
  devlog: ReviewDevlogFull;
  draft: DevlogAssessmentDraft | undefined;
  onChange: (
    update: (prev: DevlogAssessmentDraft | undefined) => DevlogAssessmentDraft | null,
  ) => void;
  onRefreshHackatime?: (devlogId: string) => void;
  refreshing?: boolean;
  readOnly?: boolean;
  breakdownEntries: DevlogHackatimeBreakdownEntry[] | undefined;
  breakdownConfigured: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const reviewUrls = buildHackatimeDevlogReviewUrls({
    hackatimeId: hackatimeUserId,
    startedAt: devlog.startedAt,
    endedAt: devlog.endedAt,
  });
  const isLong = devlog.content.length > 500;
  const preview =
    expanded || !isLong ? devlog.content : `${devlog.content.slice(0, 500).trimEnd()}…`;
  const decision = draft?.decision ?? null;
  const duration = formatDurationHM(devlog.durationSeconds);

  const contributingEntries = useMemo(
    () =>
      breakdownConfigured ? (breakdownEntries ?? []).filter((e) => e.seconds > 0) : [],
    [breakdownConfigured, breakdownEntries],
  );
  const breakdownTotalSeconds = useMemo(
    () => contributingEntries.reduce((acc, e) => acc + e.seconds, 0),
    [contributingEntries],
  );
  // With 2+ contributing Hackatime projects the reviewer adjusts each project's
  // contribution individually; their sum is the devlog's counted time.
  const multiProject = contributingEntries.length >= 2;

  const adjustedPreviewSeconds = draft
    ? effectiveSecondsForAssessment(
        {
          devlogId: devlog.id,
          durationSeconds: devlog.durationSeconds,
          hackatimeBreakdownTotalSeconds: breakdownConfigured ? breakdownTotalSeconds : null,
        },
        { decision: draft.decision, adjustedSeconds: draft.adjustedSeconds ?? null },
      )
    : 0;
  const adjustedPreview = formatDurationHM(adjustedPreviewSeconds);

  // Deflation is tied to this devlog's time range: whenever the assessment
  // counts fewer seconds than the devlog logged, the reviewer must pick at
  // least one reason and write a note HERE — these feed the per-devlog
  // deflation breakdown in the Airtable justification. There is no generic
  // project-level deflation reason anymore.
  const deflates = draft
    ? assessmentDeflatesHours(
        {
          devlogId: devlog.id,
          durationSeconds: devlog.durationSeconds,
          hackatimeBreakdownTotalSeconds: breakdownConfigured ? breakdownTotalSeconds : null,
        },
        { decision: draft.decision, adjustedSeconds: draft.adjustedSeconds ?? null },
      )
    : false;

  const [adjustedHours, adjustedMinutes] = useMemo(() => {
    if (!draft || draft.decision !== "adjusted") return [undefined, undefined];
    const s = Math.max(0, Math.floor(draft.adjustedSeconds ?? 0));
    return [Math.floor(s / 3600), Math.floor(s / 60) % 60];
  }, [draft]);

  function defaultProjectAdjustments(): DevlogHackatimeProjectAdjustment[] {
    return contributingEntries.map((e) => ({ name: e.name, seconds: e.seconds }));
  }

  function setDecision(next: DevlogAssessmentDecision) {
    if (readOnly) return;
    if (next === "adjusted") {
      if (multiProject) {
        onChange((prev) => {
          const adjustments = prev?.hackatimeAdjustments?.length
            ? prev.hackatimeAdjustments
            : defaultProjectAdjustments();
          return {
            devlogId: devlog.id,
            decision: "adjusted",
            adjustedSeconds: sumHackatimeAdjustmentSeconds(adjustments),
            hackatimeAdjustments: adjustments,
            deflationReasons: prev?.deflationReasons ?? null,
            // Per-project splits are scoped to the original window.
            reviewedWindow: null,
            reviewedWindowSeconds: null,
            comment: prev?.comment ?? null,
          };
        });
      } else {
        onChange((prev) => ({
          devlogId: devlog.id,
          decision: "adjusted",
          adjustedSeconds: prev?.adjustedSeconds ?? devlog.durationSeconds,
          hackatimeAdjustments: null,
          deflationReasons: prev?.deflationReasons ?? null,
          reviewedWindow: prev?.reviewedWindow ?? null,
          reviewedWindowSeconds: prev?.reviewedWindowSeconds ?? null,
          comment: prev?.comment ?? null,
        }));
      }
    } else {
      onChange((prev) => ({
        devlogId: devlog.id,
        decision: next,
        adjustedSeconds: null,
        hackatimeAdjustments: null,
        // Accepting a devlog is not a deflation — clear any lingering reasons.
        deflationReasons: next === "accepted" ? null : prev?.deflationReasons ?? null,
        // A reviewed window only exists on adjusted assessments.
        reviewedWindow: null,
        reviewedWindowSeconds: null,
        comment: prev?.comment ?? null,
      }));
    }
  }

  function setAdjustedSeconds(next: number) {
    onChange((prev) => ({
      devlogId: devlog.id,
      decision: "adjusted",
      adjustedSeconds: Math.max(0, Math.floor(next)),
      hackatimeAdjustments: null,
      deflationReasons: prev?.deflationReasons ?? null,
      // Manual hour edits keep the reviewed window — the reviewer may deflate
      // below the window's pulled time, never above it (server-enforced).
      reviewedWindow: prev?.reviewedWindow ?? null,
      reviewedWindowSeconds: prev?.reviewedWindowSeconds ?? null,
      comment: prev?.comment ?? null,
    }));
  }

  function setAdjustedHM(h: number, m: number) {
    const safeH = Math.max(0, Math.floor(h));
    const safeM = Math.max(0, Math.min(59, Math.floor(m)));
    setAdjustedSeconds(safeH * 3600 + safeM * 60);
  }

  function setProjectAdjustmentSeconds(name: string, nextSeconds: number) {
    const cap = contributingEntries.find((e) => e.name === name)?.seconds ?? 0;
    const clamped = Math.min(Math.max(0, Math.floor(nextSeconds)), cap);
    onChange((prev) => {
      const current = prev?.hackatimeAdjustments?.length
        ? prev.hackatimeAdjustments
        : defaultProjectAdjustments();
      const next = current.map((e) => (e.name === name ? { ...e, seconds: clamped } : e));
      return {
        devlogId: devlog.id,
        decision: "adjusted",
        adjustedSeconds: sumHackatimeAdjustmentSeconds(next),
        hackatimeAdjustments: next,
        deflationReasons: prev?.deflationReasons ?? null,
        reviewedWindow: null,
        reviewedWindowSeconds: null,
        comment: prev?.comment ?? null,
      };
    });
  }

  function setComment(next: string) {
    onChange((prev) => ({
      devlogId: devlog.id,
      decision: prev?.decision ?? "accepted",
      adjustedSeconds: prev?.adjustedSeconds ?? null,
      hackatimeAdjustments: prev?.hackatimeAdjustments ?? null,
      deflationReasons: prev?.deflationReasons ?? null,
      reviewedWindow: prev?.reviewedWindow ?? null,
      reviewedWindowSeconds: prev?.reviewedWindowSeconds ?? null,
      comment: next.trim() ? next : null,
    }));
  }

  function toggleDeflationReason(reason: string) {
    if (readOnly || !draft) return;
    onChange((prev) => {
      if (!prev) return null;
      const current = prev.deflationReasons ?? [];
      const next = current.includes(reason)
        ? current.filter((item) => item !== reason)
        : [...current, reason];
      return {
        devlogId: devlog.id,
        decision: prev.decision,
        adjustedSeconds: prev.adjustedSeconds ?? null,
        hackatimeAdjustments: prev.hackatimeAdjustments ?? null,
        deflationReasons: next,
        reviewedWindow: prev.reviewedWindow ?? null,
        reviewedWindowSeconds: prev.reviewedWindowSeconds ?? null,
        comment: prev.comment ?? null,
      };
    });
  }

  // ---------------------------------------------------------------------
  // Reviewer-overridden considered window ("trim overlap").
  // Devlog windows can overlap (Jul 12-15 and Jul 14-23): time already
  // counted by one devlog gets trimmed from the other by narrowing the
  // window considered for it. Applying pulls Hackatime for exactly the
  // trimmed range and uses THAT as the counted time; the server re-pulls
  // and enforces the same number on submit, and the justification shows the
  // reviewer's window instead of the creator's original.
  // ---------------------------------------------------------------------
  const [windowStart, setWindowStart] = useState(() => toDatetimeLocalValue(devlog.startedAt));
  const [windowEnd, setWindowEnd] = useState(() => toDatetimeLocalValue(devlog.endedAt));
  const [windowPulling, setWindowPulling] = useState(false);

  async function pullAndApplyWindow() {
    if (readOnly || windowPulling) return;
    const start = new Date(windowStart);
    const end = new Date(windowEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      toast.error("Pick a valid window (end after start).");
      return;
    }
    const origStart = new Date(devlog.startedAt);
    const origEnd = new Date(devlog.endedAt);
    if (start < origStart || end > origEnd) {
      toast.error("The reviewed window must lie inside the devlog's own time range.");
      return;
    }
    setWindowPulling(true);
    const toastId = toast.loading("Pulling Hackatime for the window…");
    try {
      const res = await fetch(`/api/review/${encodeURIComponent(projectId)}/hackatime-range`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startedAt: start.toISOString(),
          endedAt: end.toISOString(),
          hackatimeProjectName: devlog.hackatimeProjectNameSnapshot || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { totalSeconds?: number; error?: unknown }
        | null;
      if (!res.ok || typeof data?.totalSeconds !== "number") {
        toast.error(
          typeof data?.error === "string" ? data.error : "Failed to pull Hackatime for the window.",
          { id: toastId },
        );
        setWindowPulling(false);
        return;
      }
      const seconds = Math.max(0, Math.floor(data.totalSeconds));
      // Functional update: the fetch may resolve AFTER the reviewer ticked
      // reasons or typed the note — merge against the latest draft, never the
      // click-time snapshot, so nothing they entered meanwhile is lost.
      onChange((prev) => {
        const existingReasons = prev?.deflationReasons ?? [];
        return {
          devlogId: devlog.id,
          decision: "adjusted",
          adjustedSeconds: seconds,
          hackatimeAdjustments: null,
          // Trimming an overlapping window is the typical cause — preselect it,
          // the reviewer can still change the reasons.
          deflationReasons: existingReasons.length > 0 ? existingReasons : ["overlappingWindow"],
          reviewedWindow: { startedAt: start.toISOString(), endedAt: end.toISOString() },
          reviewedWindowSeconds: seconds,
          comment: prev?.comment ?? null,
        };
      });
      toast.success(`Window applied: ${formatDurationHM(seconds).label} counted.`, { id: toastId });
      setWindowPulling(false);
    } catch {
      toast.error("Failed to pull Hackatime for the window.", { id: toastId });
      setWindowPulling(false);
    }
  }

  function clearReviewedWindow() {
    if (readOnly || !draft) return;
    onChange((prev) => {
      if (!prev) return null;
      return {
        devlogId: devlog.id,
        decision: prev.decision,
        adjustedSeconds: prev.adjustedSeconds ?? null,
        hackatimeAdjustments: prev.hackatimeAdjustments ?? null,
        deflationReasons: prev.deflationReasons ?? null,
        reviewedWindow: null,
        reviewedWindowSeconds: null,
        comment: prev.comment ?? null,
      };
    });
  }

  // One-click AI deflation: when AI use was declared (or determined) for this
  // devlog, Carnival's rule approves one third of the claimed time
  // (AI_APPROVED_HOURS_FACTOR in src/lib/review/config.ts). Reviewers can
  // still lower the result further, never raise it above the cap.
  function applyAiDeflation() {
    if (readOnly) return;
    if (multiProject) {
      const adjustments = defaultProjectAdjustments().map((e) => ({
        ...e,
        seconds: aiDeflatedSeconds(e.seconds),
      }));
      onChange((prev) => ({
        devlogId: devlog.id,
        decision: "adjusted",
        adjustedSeconds: sumHackatimeAdjustmentSeconds(adjustments),
        hackatimeAdjustments: adjustments,
        deflationReasons: ["aiUsage"],
        reviewedWindow: null,
        reviewedWindowSeconds: null,
        comment: prev?.comment ?? "AI usage — approved at 1/3 of claimed time per program rule.",
      }));
    } else {
      onChange((prev) => {
        // When a reviewed window is applied, the AI rule takes 1/3 of THAT
        // window's pulled time (the window already excludes trimmed overlap).
        const baseSeconds = prev?.reviewedWindowSeconds ?? devlog.durationSeconds;
        return {
          devlogId: devlog.id,
          decision: "adjusted",
          adjustedSeconds: aiDeflatedSeconds(baseSeconds),
          hackatimeAdjustments: null,
          deflationReasons: prev?.reviewedWindow
            ? Array.from(new Set([...(prev?.deflationReasons ?? []), "aiUsage"]))
            : ["aiUsage"],
          reviewedWindow: prev?.reviewedWindow ?? null,
          reviewedWindowSeconds: prev?.reviewedWindowSeconds ?? null,
          comment: prev?.comment ?? "AI usage — approved at 1/3 of claimed time per program rule.",
        };
      });
    }
  }

  return (
    <li className="rounded-[var(--radius-xl)]  border border-border bg-background/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-semibold text-foreground">{devlog.title}</div>
            {devlog.usedAi ? (
              <span className="rounded-full bg-amber-500/15 text-amber-200 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                AI
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{devlog.authorName}</span>
            <span>·</span>
            <span>
              {formatDateTime(devlog.startedAt)} → {formatDateTime(devlog.endedAt)}
            </span>
            <span>·</span>
            <span className="font-semibold text-foreground">{duration.label}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {onRefreshHackatime ? (
            <button
              type="button"
              onClick={() => onRefreshHackatime(devlog.id)}
              disabled={refreshing}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh Hackatime"}
            </button>
          ) : null}
          {reviewUrls ? (
            <a
              href={reviewUrls.joeFraudUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Joe.fraud ↗
            </a>
          ) : null}
          <Link
            href={`/projects/${projectId}/devlogs/${devlog.id}`}
            target="_blank"
            rel="noreferrer noopener"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Open ↗
          </Link>
        </div>
      </div>

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {preview}
      </p>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {expanded ? "Show less" : "Show full devlog"}
        </button>
      ) : null}

      {devlog.usedAi && devlog.aiUsageDescription ? (
        <div className="rounded-[var(--radius-xl)] border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
          <span className="font-semibold text-amber-200">AI used:</span>{" "}
          {devlog.aiUsageDescription}
        </div>
      ) : null}

      {devlog.attachments && devlog.attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {devlog.attachments.map((url, i) => (
            <a
              key={`${devlog.id}-att-${i}`}
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              className="block overflow-hidden rounded-lg  border border-border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="h-20 w-28 object-cover"
                referrerPolicy="no-referrer"
              />
            </a>
          ))}
        </div>
      ) : null}

      <DevlogHackatimeBreakdown
        entries={breakdownEntries ?? []}
        configured={breakdownConfigured}
        devlogProjectName={devlog.hackatimeProjectNameSnapshot}
      />

      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <AssessmentButtons
              devlogId={devlog.id}
              current={decision}
              onSelect={setDecision}
              disabled={readOnly}
            />
            {devlog.usedAi && !readOnly ? (
              <button
                type="button"
                onClick={applyAiDeflation}
                className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
                title="AI-assisted work is approved at 1/3 of the claimed time (program rule)."
              >
                Apply AI rule (1/3)
              </button>
            ) : null}
          </div>
          {decision ? (
            <Badge variant="info">
              Counts as {adjustedPreview.label} toward approved hours
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Pending assessment</span>
          )}
        </div>

        {decision === "adjusted" ? (
          multiProject ? (
            <div className="space-y-3 rounded-[var(--radius-xl)] border border-border bg-muted/30 px-3 py-3">
              <div className="text-xs text-muted-foreground">
                Adjust how much each linked Hackatime project counts toward this devlog. The
                devlog&apos;s counted time is their total.
              </div>
              {contributingEntries.map((entry) => {
                const adjustments = draft?.hackatimeAdjustments?.length
                  ? draft.hackatimeAdjustments
                  : null;
                const seconds =
                  adjustments?.find((a) => a.name === entry.name)?.seconds ?? entry.seconds;
                return (
                  <ProjectAdjustmentRow
                    key={`${devlog.id}-adj-${entry.name}`}
                    name={entry.name}
                    capSeconds={entry.seconds}
                    seconds={seconds}
                    onChangeSeconds={(next) => setProjectAdjustmentSeconds(entry.name, next)}
                    disabled={readOnly}
                  />
                );
              })}
              <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
                <span className="text-muted-foreground">Counted total</span>
                <span className="font-semibold text-foreground">{adjustedPreview.label}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_auto_1fr]">
              <label className="block">
                <FormLabel size="small">Hours</FormLabel>
                <Input
                  size="small"
                  type="number"
                  min={0}
                  step={1}
                  value={adjustedHours ?? 0}
                  onChange={(e) =>
                    setAdjustedHM(Number(e.target.value || 0), adjustedMinutes ?? 0)
                  }
                  disabled={readOnly}
                />
              </label>
              <label className="block">
                <FormLabel size="small">Minutes</FormLabel>
                <Input
                  size="small"
                  type="number"
                  min={0}
                  max={59}
                  step={1}
                  value={adjustedMinutes ?? 0}
                  onChange={(e) =>
                    setAdjustedHM(adjustedHours ?? 0, Number(e.target.value || 0))
                  }
                  disabled={readOnly}
                />
              </label>
              <div className="self-end text-xs text-muted-foreground">
                Can&apos;t exceed the devlog&apos;s logged time ({duration.label}).
              </div>
            </div>

            {/* Reviewer-overridden considered window: trim time already
                counted by an overlapping devlog. Applying pulls Hackatime for
                exactly this range and counts that instead of the creator's
                original window; the server re-verifies the pull on submit. */}
            <div className="space-y-2 rounded-[var(--radius-xl)] border border-border bg-muted/30 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-foreground">
                  Considered window (override)
                </div>
                {draft?.reviewedWindow ? (
                  <span className="rounded-full bg-carnival-blue/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-carnival-blue">
                    Window applied
                    {typeof draft.reviewedWindowSeconds === "number"
                      ? ` — ${formatDurationHM(draft.reviewedWindowSeconds).label} in range`
                      : ""}
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground">
                Overlapping with another devlog? Narrow the window considered for this one —
                must stay inside {formatDateTime(devlog.startedAt)} → {formatDateTime(devlog.endedAt)}.
                Applying pulls Hackatime for the trimmed range and counts that time.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <FormLabel size="small">Window start</FormLabel>
                  <DateTimePicker value={windowStart} onChange={setWindowStart} />
                </label>
                <label className="block">
                  <FormLabel size="small">Window end</FormLabel>
                  <DateTimePicker value={windowEnd} onChange={setWindowEnd} />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={pullAndApplyWindow}
                  disabled={readOnly || windowPulling}
                  className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {windowPulling ? "Pulling Hackatime…" : "Pull Hackatime & apply window"}
                </button>
                {draft?.reviewedWindow ? (
                  <button
                    type="button"
                    onClick={clearReviewedWindow}
                    disabled={readOnly || windowPulling}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    Clear window
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          )
        ) : null}

        {deflates ? (
          <div className="space-y-2 rounded-[var(--radius-xl)] border border-amber-500/30 bg-amber-500/5 px-3 py-3">
            <div className="text-xs font-semibold text-foreground">
              Deflation reasons for this time range ({formatDateTime(devlog.startedAt)} →{" "}
              {formatDateTime(devlog.endedAt)})
            </div>
            <div className="text-xs text-muted-foreground">
              Required: this assessment counts less time than the devlog logged. These reasons go
              into the hours justification for exactly this range.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {REVIEW_DEFLATION_REASON_OPTIONS.map((option) => (
                <label
                  key={option.key}
                  className="flex items-start gap-2 rounded-[var(--radius-xl)] border border-border bg-background px-2.5 py-1.5"
                >
                  <input
                    type="checkbox"
                    checked={(draft?.deflationReasons ?? []).includes(option.key)}
                    onChange={() => toggleDeflationReason(option.key)}
                    disabled={readOnly}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-carnival-blue"
                  />
                  <span className="text-xs text-foreground">{option.label}</span>
                </label>
              ))}
            </div>
            {(draft?.deflationReasons ?? []).length === 0 ? (
              <div className="text-xs font-semibold text-red-300">
                Tick at least one reason — the review can’t be submitted without it.
              </div>
            ) : null}
          </div>
        ) : null}

        {decision && decision !== "accepted" ? (
          <label className="block">
            <FormLabel size="small">
              {decision === "rejected"
                ? "Why is this devlog rejected? (required)"
                : deflates
                  ? "Why the reduction? (required)"
                  : "Why the adjustment?"}
            </FormLabel>
            <Textarea
              size="small"
              rows={2}
              value={draft?.comment ?? ""}
              onChange={(e) => setComment(e.target.value)}
              maxLength={2000}
              placeholder={
                decision === "rejected"
                  ? "Explain what's missing or unverifiable."
                  : "Describe the reason for lowering the counted time."
              }
              disabled={readOnly}
            />
            {deflates && !(draft?.comment ?? "").trim() ? (
              <div className="mt-1 text-xs font-semibold text-red-300">
                A note is required here for this reduction — the project-level review comment
                doesn’t count.
              </div>
            ) : null}
          </label>
        ) : null}
      </div>
    </li>
  );
}

export default function DevlogAssessmentPanel({
  projectId,
  hackatimeUserId,
  devlogs,
  assessments,
  onChange,
  onRefreshHackatime,
  refreshingDevlogIds,
  readOnly,
  hackatimeBreakdownByDevlogId,
  hackatimeBreakdownConfigured = false,
}: Props) {
  const totalAssessed = useMemo(() => {
    let total = 0;
    for (const d of devlogs) {
      const a = assessments[d.id];
      if (!a) continue;
      const breakdownTotal = hackatimeBreakdownConfigured
        ? (hackatimeBreakdownByDevlogId?.[d.id] ?? []).reduce(
            (acc, e) => acc + Math.max(0, e.seconds),
            0,
          )
        : null;
      total += effectiveSecondsForAssessment(
        {
          devlogId: d.id,
          durationSeconds: d.durationSeconds,
          hackatimeBreakdownTotalSeconds: breakdownTotal,
        },
        { decision: a.decision, adjustedSeconds: a.adjustedSeconds ?? null },
      );
    }
    return total;
  }, [assessments, devlogs, hackatimeBreakdownByDevlogId, hackatimeBreakdownConfigured]);

  const totalLogged = useMemo(
    () => devlogs.reduce((acc, d) => acc + Math.max(0, d.durationSeconds || 0), 0),
    [devlogs],
  );

  const assessedCount = Object.keys(assessments).length;
  const totalFormatted = formatDurationHM(totalAssessed);
  const loggedFormatted = formatDurationHM(totalLogged);

  // Functional update against the LATEST drafts map. Building the next map
  // from the `assessments` prop (a render-time snapshot) would let a slow
  // async edit clobber fields the reviewer changed in the meantime.
  function setDraft(
    devlogId: string,
    update: (prev: DevlogAssessmentDraft | undefined) => DevlogAssessmentDraft | null,
  ) {
    onChange((prevMap) => {
      const next = update(prevMap[devlogId]);
      const clone = { ...prevMap };
      if (next === null) {
        delete clone[devlogId];
      } else {
        clone[devlogId] = next;
      }
      return clone;
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">Creator devlogs</h3>
              <Badge>{devlogs.length}</Badge>
              <Badge variant="info">
                {assessedCount}/{devlogs.length} assessed
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Accept, adjust, or reject each devlog. Approved hours total is derived from your
              assessments.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Logged · counted</div>
            <div className="text-sm font-semibold text-foreground">
              {loggedFormatted.label} · {totalFormatted.label}
            </div>
          </div>
        </div>

        {devlogs.length === 0 ? (
          <div className="mt-4 rounded-[var(--radius-xl)] border border-dashed border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
            The creator has not posted any devlogs for this project.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {devlogs.map((d) => (
              <DevlogItem
                key={d.id}
                projectId={projectId}
                hackatimeUserId={hackatimeUserId}
                devlog={d}
                draft={assessments[d.id]}
                onChange={(update) => setDraft(d.id, update)}
                onRefreshHackatime={onRefreshHackatime}
                refreshing={refreshingDevlogIds?.has(d.id) ?? false}
                readOnly={readOnly}
                breakdownEntries={hackatimeBreakdownByDevlogId?.[d.id]}
                breakdownConfigured={hackatimeBreakdownConfigured}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
