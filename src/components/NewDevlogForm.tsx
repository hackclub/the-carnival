"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import DevlogAttachmentsInput from "@/components/DevlogAttachmentsInput";
import { Button, Card, CardContent, FormLabel, Input, Textarea } from "@/components/ui";
import { DateTimePicker } from "@/components/ui/date-picker";
import { formatDurationHM } from "@/lib/devlog-shared";

type DevlogFormMode = "create" | "edit";

type DevlogInitial = {
  title: string;
  content: string;
  attachments: string[];
  usedAi: boolean;
  aiUsageDescription: string | null;
  startedAtIso: string;
  endedAtIso: string;
};

type NewDevlogFormProps = {
  projectId: string;
  projectName: string;
  hackatimeProjectName: string;
  floorIso: string;
  ceilingIso: string;
  mode?: DevlogFormMode;
  devlogId?: string;
  initial?: DevlogInitial;
  canEditWindow?: boolean;
  windowLockedReason?: string;
};

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function NewDevlogForm({
  projectId,
  projectName,
  hackatimeProjectName,
  floorIso,
  ceilingIso,
  mode = "create",
  devlogId,
  initial,
  canEditWindow = true,
  windowLockedReason,
}: NewDevlogFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [attachments, setAttachments] = useState<string[]>(initial?.attachments ?? []);
  const [usedAi, setUsedAi] = useState(initial?.usedAi ?? false);
  const [aiDesc, setAiDesc] = useState(initial?.aiUsageDescription ?? "");
  const [startedAt, setStartedAt] = useState(
    toDatetimeLocalValue(initial?.startedAtIso ?? floorIso),
  );
  const [endedAt, setEndedAt] = useState(
    toDatetimeLocalValue(initial?.endedAtIso ?? ceilingIso),
  );
  const [previewSeconds, setPreviewSeconds] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const startedIso = useMemo(() => fromDatetimeLocalValue(startedAt), [startedAt]);
  const endedIso = useMemo(() => fromDatetimeLocalValue(endedAt), [endedAt]);

  const windowError = useMemo(() => {
    if (!canEditWindow) return null;
    if (!startedIso || !endedIso) return null;
    const s = new Date(startedIso).getTime();
    const e = new Date(endedIso).getTime();
    const floor = new Date(floorIso).getTime();
    const ceiling = new Date(ceilingIso).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e)) return "Choose valid start and end times.";
    if (e <= s) return "End time must be after start time.";
    if (s < floor - 1000) {
      return `Start can't be earlier than ${new Date(floor).toLocaleString()} (end of your last devlog or project start).`;
    }
    if (e > ceiling + 1000) {
      return "End can't be later than now.";
    }
    return null;
  }, [canEditWindow, ceilingIso, endedIso, floorIso, startedIso]);

  useEffect(() => {
    if (!canEditWindow) {
      setPreviewSeconds(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }
    if (!startedIso || !endedIso || windowError) {
      setPreviewSeconds(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    const timer = window.setTimeout(async () => {
      try {
        const url = new URL(
          `/api/projects/${encodeURIComponent(projectId)}/devlogs/preview`,
          window.location.origin,
        );
        url.searchParams.set("startedAt", startedIso);
        url.searchParams.set("endedAt", endedIso);
        const res = await fetch(url.toString());
        const data = (await res.json().catch(() => null)) as
          | { durationSeconds?: number | null; error?: unknown }
          | null;
        if (cancelled) return;
        if (!res.ok) {
          const msg = typeof data?.error === "string" ? data.error : "Failed to preview hours.";
          setPreviewError(msg);
          setPreviewSeconds(null);
        } else {
          setPreviewSeconds(
            typeof data?.durationSeconds === "number" ? data.durationSeconds : null,
          );
        }
      } catch {
        if (cancelled) return;
        setPreviewError("Failed to preview hours.");
        setPreviewSeconds(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canEditWindow, endedIso, projectId, startedIso, windowError]);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (!title.trim() || !content.trim()) return false;
    if (canEditWindow && (!startedIso || !endedIso)) return false;
    if (windowError) return false;
    if (attachments.length < 1) return false;
    if (usedAi && !aiDesc.trim()) return false;
    return true;
  }, [
    aiDesc,
    attachments.length,
    canEditWindow,
    content,
    endedIso,
    startedIso,
    submitting,
    title,
    usedAi,
    windowError,
  ]);

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    const toastId = toast.loading(isEdit ? "Saving devlog…" : "Posting devlog…");
    try {
      const url = isEdit
        ? `/api/projects/${encodeURIComponent(projectId)}/devlogs/${encodeURIComponent(
            devlogId ?? "",
          )}`
        : `/api/projects/${encodeURIComponent(projectId)}/devlogs`;
      const method = isEdit ? "PATCH" : "POST";
      const body: Record<string, unknown> = {
        title: title.trim(),
        content: content.trim(),
        attachments,
        usedAi,
        aiUsageDescription: usedAi ? aiDesc.trim() : null,
      };
      if (canEditWindow) {
        body.startedAt = startedIso;
        body.endedAt = endedIso;
      }
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as
        | { devlog?: { id?: string }; error?: unknown }
        | null;
      if (!res.ok) {
        const msg =
          typeof data?.error === "string"
            ? data.error
            : isEdit
              ? "Failed to save devlog."
              : "Failed to post devlog.";
        setSubmitError(msg);
        toast.error(msg, { id: toastId });
        setSubmitting(false);
        return;
      }
      toast.success(isEdit ? "Devlog updated." : "Devlog posted.", { id: toastId });
      const resultId = data?.devlog?.id ?? devlogId;
      router.push(
        resultId
          ? `/projects/${projectId}/devlogs/${resultId}`
          : `/projects/${projectId}/devlogs`,
      );
      router.refresh();
    } catch {
      const msg = isEdit ? "Failed to save devlog." : "Failed to post devlog.";
      toast.error(msg, { id: toastId });
      setSubmitting(false);
      setSubmitError(msg);
    }
  }, [
    aiDesc,
    attachments,
    canEditWindow,
    canSubmit,
    content,
    devlogId,
    endedIso,
    isEdit,
    projectId,
    router,
    startedIso,
    title,
    usedAi,
  ]);

  const previewLabel = useMemo(() => {
    if (!canEditWindow) return null;
    if (previewLoading) return "Calculating Hackatime time…";
    if (previewError) return previewError;
    if (previewSeconds === null) return "Pick a start and end time to preview Hackatime time.";
    const d = formatDurationHM(previewSeconds);
    return `Hackatime time for this window: ${d.label}.`;
  }, [canEditWindow, previewError, previewLoading, previewSeconds]);

  const cancelHref = isEdit && devlogId
    ? `/projects/${projectId}/devlogs/${devlogId}`
    : `/projects/${projectId}`;

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">{projectName}</div>
            <h1 className="text-xl font-semibold text-foreground">
              {isEdit ? "Edit devlog" : "New devlog"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Record what you worked on. Hackatime seconds logged against{" "}
              <span className="font-mono text-foreground">{hackatimeProjectName}</span>{" "}
              within your chosen window are what count toward this devlog.
            </p>
          </div>

          <label className="block">
            <FormLabel>Title</FormLabel>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Implemented the login flow"
              maxLength={200}
            />
          </label>

          <label className="block">
            <FormLabel>What did you work on?</FormLabel>
            <Textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe what you built, what broke, and what's next."
              maxLength={20000}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <div className="font-semibold text-foreground">Attachments</div>
            <p className="text-xs text-muted-foreground mt-1">
              At least one image is required. Think screenshots, before/after shots, diagrams, or
              a short GIF.
            </p>
          </div>
          <DevlogAttachmentsInput
            projectId={projectId}
            value={attachments}
            onChange={setAttachments}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <div className="font-semibold text-foreground">Working window</div>
            <p className="text-xs text-muted-foreground mt-1">
              Pick the time range you worked during. Start can't be earlier than the end of your
              last devlog (or the project start), and end can't be in the future.
            </p>
          </div>

          {!canEditWindow ? (
            <div className="rounded-[var(--radius-xl)] border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              {windowLockedReason ??
                "The time window for this devlog is locked because newer devlogs exist. Edit title, description, attachments, or AI declaration only."}
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <FormLabel>Started at</FormLabel>
              <DateTimePicker
                value={startedAt}
                onChange={(v) => setStartedAt(v)}
                disabled={!canEditWindow}
              />
            </label>
            <label className="block">
              <FormLabel>Ended at</FormLabel>
              <DateTimePicker
                value={endedAt}
                onChange={(v) => setEndedAt(v)}
                disabled={!canEditWindow}
              />
            </label>
          </div>

          {canEditWindow ? (
            windowError ? (
              <div className="rounded-[var(--radius-xl)] border border-carnival-red/40 bg-carnival-red/10 px-3 py-2 text-sm text-red-200">
                {windowError}
              </div>
            ) : (
              <div className="rounded-[var(--radius-xl)] border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                {previewLabel}
              </div>
            )
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={usedAi}
              onChange={(e) => setUsedAi(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border accent-carnival-blue"
            />
            <div>
              <div className="font-semibold text-foreground">I used AI for this session</div>
              <p className="text-xs text-muted-foreground">
                If AI helped you write code, brainstorm, or debug during this window, check this.
              </p>
            </div>
          </label>
          {usedAi ? (
            <label className="block">
              <FormLabel>What did you use AI for?</FormLabel>
              <Textarea
                rows={3}
                value={aiDesc}
                onChange={(e) => setAiDesc(e.target.value)}
                placeholder="e.g. Rubber-ducked the auth bug and pair-programmed a retry helper."
                maxLength={2000}
              />
              <div className="text-xs text-muted-foreground mt-1">{aiDesc.trim().length}/2000</div>
            </label>
          ) : null}
        </CardContent>
      </Card>

      {submitError ? (
        <div className="rounded-[var(--radius-2xl)] border border-carnival-red/40 bg-carnival-red/10 px-4 py-3 text-sm text-red-200">
          {submitError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button variant="outline" onClick={() => router.push(cancelHref)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={!canSubmit}
          loading={submitting}
          loadingText={isEdit ? "Saving…" : "Posting…"}
        >
          {isEdit ? "Save changes" : "Post devlog"}
        </Button>
      </div>
    </div>
  );
}
