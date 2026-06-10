"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Card, CardContent, FormLabel, Input, Textarea } from "@/components/ui";
import type { DevlogAssessmentDecision, DevlogHackatimeProjectAdjustment } from "@/db/schema";
import {
  effectiveSecondsForAssessment,
  sumHackatimeAdjustmentSeconds,
  type DevlogAssessmentDraft,
} from "@/lib/devlog-assessments";
import { buildHackatimeDevlogReviewUrls } from "@/lib/constants";
import { formatDurationHM } from "@/lib/devlog-shared";

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
  onChange: (next: Record<string, DevlogAssessmentDraft>) => void;
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
  onChange: (next: DevlogAssessmentDraft | null) => void;
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
        const adjustments = draft?.hackatimeAdjustments?.length
          ? draft.hackatimeAdjustments
          : defaultProjectAdjustments();
        onChange({
          devlogId: devlog.id,
          decision: "adjusted",
          adjustedSeconds: sumHackatimeAdjustmentSeconds(adjustments),
          hackatimeAdjustments: adjustments,
          comment: draft?.comment ?? null,
        });
      } else {
        onChange({
          devlogId: devlog.id,
          decision: "adjusted",
          adjustedSeconds: draft?.adjustedSeconds ?? devlog.durationSeconds,
          hackatimeAdjustments: null,
          comment: draft?.comment ?? null,
        });
      }
    } else {
      onChange({
        devlogId: devlog.id,
        decision: next,
        adjustedSeconds: null,
        hackatimeAdjustments: null,
        comment: draft?.comment ?? null,
      });
    }
  }

  function setAdjustedSeconds(next: number) {
    onChange({
      devlogId: devlog.id,
      decision: "adjusted",
      adjustedSeconds: Math.max(0, Math.floor(next)),
      hackatimeAdjustments: null,
      comment: draft?.comment ?? null,
    });
  }

  function setAdjustedHM(h: number, m: number) {
    const safeH = Math.max(0, Math.floor(h));
    const safeM = Math.max(0, Math.min(59, Math.floor(m)));
    setAdjustedSeconds(safeH * 3600 + safeM * 60);
  }

  function setProjectAdjustmentSeconds(name: string, nextSeconds: number) {
    const cap = contributingEntries.find((e) => e.name === name)?.seconds ?? 0;
    const clamped = Math.min(Math.max(0, Math.floor(nextSeconds)), cap);
    const current = draft?.hackatimeAdjustments?.length
      ? draft.hackatimeAdjustments
      : defaultProjectAdjustments();
    const next = current.map((e) => (e.name === name ? { ...e, seconds: clamped } : e));
    onChange({
      devlogId: devlog.id,
      decision: "adjusted",
      adjustedSeconds: sumHackatimeAdjustmentSeconds(next),
      hackatimeAdjustments: next,
      comment: draft?.comment ?? null,
    });
  }

  function setComment(next: string) {
    onChange({
      devlogId: devlog.id,
      decision: draft?.decision ?? "accepted",
      adjustedSeconds: draft?.adjustedSeconds ?? null,
      hackatimeAdjustments: draft?.hackatimeAdjustments ?? null,
      comment: next.trim() ? next : null,
    });
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
            <>
              <a
                href={reviewUrls.billyUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Billy ↗
              </a>
              <a
                href={reviewUrls.joeFraudUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Joe.fraud ↗
              </a>
            </>
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
          <AssessmentButtons
            devlogId={devlog.id}
            current={decision}
            onSelect={setDecision}
            disabled={readOnly}
          />
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
          )
        ) : null}

        {decision && decision !== "accepted" ? (
          <label className="block">
            <FormLabel size="small">
              {decision === "rejected" ? "Why is this devlog rejected?" : "Why the adjustment?"}
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

  function setDraft(devlogId: string, next: DevlogAssessmentDraft | null) {
    const clone = { ...assessments };
    if (next === null) {
      delete clone[devlogId];
    } else {
      clone[devlogId] = next;
    }
    onChange(clone);
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
                onChange={(next) => setDraft(d.id, next)}
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
