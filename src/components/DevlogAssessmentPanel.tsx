"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Card, CardContent, FormLabel, Input, Textarea } from "@/components/ui";
import type { DevlogAssessmentDecision } from "@/db/schema";
import {
  effectiveSecondsForAssessment,
  type DevlogAssessmentDraft,
} from "@/lib/devlog-assessments";
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

type Props = {
  projectId: string;
  devlogs: ReviewDevlogFull[];
  assessments: Record<string, DevlogAssessmentDraft>;
  onChange: (next: Record<string, DevlogAssessmentDraft>) => void;
  readOnly?: boolean;
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

function DevlogItem({
  projectId,
  devlog,
  draft,
  onChange,
  readOnly,
}: {
  projectId: string;
  devlog: ReviewDevlogFull;
  draft: DevlogAssessmentDraft | undefined;
  onChange: (next: DevlogAssessmentDraft | null) => void;
  readOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = devlog.content.length > 500;
  const preview =
    expanded || !isLong ? devlog.content : `${devlog.content.slice(0, 500).trimEnd()}…`;
  const decision = draft?.decision ?? null;
  const duration = formatDurationHM(devlog.durationSeconds);
  const adjustedPreviewSeconds = draft
    ? effectiveSecondsForAssessment(
        { devlogId: devlog.id, durationSeconds: devlog.durationSeconds },
        { decision: draft.decision, adjustedSeconds: draft.adjustedSeconds ?? null },
      )
    : 0;
  const adjustedPreview = formatDurationHM(adjustedPreviewSeconds);

  const [adjustedHours, adjustedMinutes] = useMemo(() => {
    if (!draft || draft.decision !== "adjusted") return [undefined, undefined];
    const s = Math.max(0, Math.floor(draft.adjustedSeconds ?? 0));
    return [Math.floor(s / 3600), Math.floor(s / 60) % 60];
  }, [draft]);

  function setDecision(next: DevlogAssessmentDecision) {
    if (readOnly) return;
    if (next === "adjusted") {
      onChange({
        devlogId: devlog.id,
        decision: "adjusted",
        adjustedSeconds: draft?.adjustedSeconds ?? devlog.durationSeconds,
        comment: draft?.comment ?? null,
      });
    } else {
      onChange({
        devlogId: devlog.id,
        decision: next,
        adjustedSeconds: null,
        comment: draft?.comment ?? null,
      });
    }
  }

  function setAdjustedSeconds(next: number) {
    onChange({
      devlogId: devlog.id,
      decision: "adjusted",
      adjustedSeconds: Math.max(0, Math.floor(next)),
      comment: draft?.comment ?? null,
    });
  }

  function setAdjustedHM(h: number, m: number) {
    const safeH = Math.max(0, Math.floor(h));
    const safeM = Math.max(0, Math.min(59, Math.floor(m)));
    setAdjustedSeconds(safeH * 3600 + safeM * 60);
  }

  function setComment(next: string) {
    onChange({
      devlogId: devlog.id,
      decision: draft?.decision ?? "accepted",
      adjustedSeconds: draft?.adjustedSeconds ?? null,
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
        <Link
          href={`/projects/${projectId}/devlogs/${devlog.id}`}
          target="_blank"
          rel="noreferrer noopener"
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
        >
          Open ↗
        </Link>
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
  devlogs,
  assessments,
  onChange,
  readOnly,
}: Props) {
  const totalAssessed = useMemo(() => {
    let total = 0;
    for (const d of devlogs) {
      const a = assessments[d.id];
      if (!a) continue;
      total += effectiveSecondsForAssessment(
        { devlogId: d.id, durationSeconds: d.durationSeconds },
        { decision: a.decision, adjustedSeconds: a.adjustedSeconds ?? null },
      );
    }
    return total;
  }, [assessments, devlogs]);

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
                devlog={d}
                draft={assessments[d.id]}
                onChange={(next) => setDraft(d.id, next)}
                readOnly={readOnly}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
