"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ProjectEditor,
  ProjectStatus,
  ProjectSubmissionChecklist,
  ReviewDecision,
} from "@/db/schema";
import { buildJoeFraudUrl } from "@/lib/constants";
import { Modal } from "@/components/ui";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import ProjectEditorBadge from "@/components/ProjectEditorBadge";
import { PROJECT_SUBMISSION_CHECKLIST_ITEMS } from "@/lib/project-submission-checklist";
import ReviewJustificationSummary from "@/components/ReviewJustificationSummary";
import LinkChip from "@/components/LinkChip";
import { DatePicker } from "@/components/ui/date-picker";
import type { ReviewJustificationPayload } from "@/lib/review-rules";
import {
  formatConsideredHackatimeRangeLabel,
  getProjectConsideredHackatimeRange,
  parseConsideredHackatimeRange,
} from "@/lib/hackatime-range";
import { useHackatimeRangePreview } from "@/hooks/useHackatimeRangePreview";
import {
  formatHoursMinutes,
  toDateInputValue,
  type HackatimeRangePreview,
} from "@/lib/project-form-utils";
import toast from "react-hot-toast";

type GrantProject = {
  id: string;
  name: string;
  description: string;
  editor: ProjectEditor;
  editorOther: string;
  hackatimeProjectName: string;
  videoUrl: string;
  playableDemoUrl: string;
  codeUrl: string;
  screenshots: string[];
  submissionChecklist: ProjectSubmissionChecklist | null;
  status: ProjectStatus;
  approvedHours: number | null;
  createdAt: string; // ISO
  submittedAt: string | null; // ISO
  hackatimeUserId: string | null;
  hackatimeHours: { hours: number; minutes: number } | null;
  hackatimeStartedAt: string | null;
  hackatimeStoppedAt: string | null;
  /** Airtable record id once pushed — pushes UPDATE this record by default. */
  airtableRecordId: string | null;
  /** True while the linked record is a pre-grant [PREVIEW] push. */
  airtableRecordIsPreview: boolean;
  /** Final human-written "Specific Technical Features" justification. */
  grantTechnicalJustification: string | null;
};

type GrantCreator = {
  id: string;
  name: string;
  email: string;
  slackId: string;
  verificationStatus: string;
};

type GrantReviewItem = {
  id: string;
  decision: ReviewDecision;
  reviewComment: string;
  approvedHours: number | null;
  reviewJustification: ReviewJustificationPayload | null;
  createdAt: string; // ISO
  reviewerName: string;
  reviewerEmail: string;
  /** Pass-1 reviewer's draft of the technical justification, if any. */
  specificTechnicalFeatures: string | null;
  rejectionCategory: string | null;
};

function trustLevelColor(level: string | null): string {
  if (!level) return "bg-gray-500/15 text-gray-300 border-gray-500/30";
  const n = level.toLowerCase();
  if (n === "high" || n === "verified") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (n === "medium" || n === "normal") return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  if (n === "low" || n === "suspicious") return "bg-rose-500/15 text-rose-300 border-rose-500/30";
  return "bg-gray-500/15 text-gray-300 border-gray-500/30";
}

export default function AdminGrantClient({
  initial,
}: {
  initial: { project: GrantProject; creator: GrantCreator; reviews: GrantReviewItem[] };
}) {
  const [project, setProject] = useState(initial.project);
  const [busy, setBusy] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const [showScreenshots, setShowScreenshots] = useState(false);
  const [screenshotIndex, setScreenshotIndex] = useState(0);

  // Pass 2: the human-written "Specific Technical Features" justification.
  // Seeded from the saved value, falling back to the pass-1 reviewer's draft.
  const passOneDraft = useMemo(() => {
    const approvedWithDraft = [...initial.reviews]
      .reverse()
      .find((r) => r.decision === "approved" && (r.specificTechnicalFeatures ?? "").trim());
    return approvedWithDraft?.specificTechnicalFeatures?.trim() ?? "";
  }, [initial.reviews]);
  const [technicalJustification, setTechnicalJustification] = useState(
    initial.project.grantTechnicalJustification?.trim() || passOneDraft,
  );
  const [justificationSaving, setJustificationSaving] = useState(false);

  // Airtable payload preview (dry run of the exact fields a grant would send).
  const [preview, setPreview] = useState<{
    fields: Record<string, unknown>;
    justificationText: string;
    hoursInvariantOk: boolean;
    hoursInvariantError: string | null;
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadAirtablePreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch(
        `/api/admin/projects/${encodeURIComponent(project.id)}/airtable-preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ technicalJustification }),
        },
      );
      const data = (await res.json().catch(() => null)) as {
        fields?: Record<string, unknown>;
        justificationText?: string;
        hoursInvariantOk?: boolean;
        hoursInvariantError?: string | null;
        error?: unknown;
      } | null;
      if (!res.ok || !data?.fields) {
        toast.error(typeof data?.error === "string" ? data.error : "Failed to load preview.");
        setPreviewLoading(false);
        return;
      }
      setPreview({
        fields: data.fields,
        justificationText: data.justificationText ?? "",
        hoursInvariantOk: data.hoursInvariantOk !== false,
        hoursInvariantError: data.hoursInvariantError ?? null,
      });
      setPreviewOpen(true);
      setPreviewLoading(false);
    } catch {
      toast.error("Failed to load preview.");
      setPreviewLoading(false);
    }
  }, [project.id, technicalJustification]);

  const saveTechnicalJustification = useCallback(async () => {
    setJustificationSaving(true);
    const toastId = toast.loading("Saving justification…");
    try {
      const res = await fetch(`/api/admin/projects/${encodeURIComponent(project.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantTechnicalJustification: technicalJustification }),
      });
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Failed to save.", { id: toastId });
        setJustificationSaving(false);
        return;
      }
      setProject((p) => ({ ...p, grantTechnicalJustification: technicalJustification || null }));
      toast.success("Justification saved.", { id: toastId });
      setJustificationSaving(false);
    } catch {
      toast.error("Failed to save.", { id: toastId });
      setJustificationSaving(false);
    }
  }, [project.id, technicalJustification]);

  const [trustLevel, setTrustLevel] = useState<{ level: string | null; value: number | null } | null>(null);
  useEffect(() => {
    fetch(`/api/projects/${project.id}/hackatime-stats`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { trustFactor?: { trustLevel?: string | null; trustValue?: number | null } };
        setTrustLevel({
          level: data.trustFactor?.trustLevel ?? null,
          value: data.trustFactor?.trustValue ?? null,
        });
      })
      .catch(() => {});
  }, [project.id]);

  const canGrant = useMemo(() => project.status === "shipped", [project.status]);
  const canUngrant = useMemo(() => project.status === "granted", [project.status]);
  const canSendBackToReview = useMemo(() => project.status === "shipped", [project.status]);
  const canonicalProjectRange = useMemo(
    () =>
      getProjectConsideredHackatimeRange({
        hackatimeStartedAt: project.hackatimeStartedAt,
        hackatimeStoppedAt: project.hackatimeStoppedAt,
        submittedAt: project.submittedAt,
        createdAt: project.createdAt,
      }),
    [project.createdAt, project.hackatimeStartedAt, project.hackatimeStoppedAt, project.submittedAt],
  );
  const canonicalProjectRangeLabel = useMemo(
    () => formatConsideredHackatimeRangeLabel(canonicalProjectRange),
    [canonicalProjectRange],
  );
  const [rangeStartDate, setRangeStartDate] = useState(canonicalProjectRange?.startDate ?? "");
  const [rangeEndDate, setRangeEndDate] = useState(canonicalProjectRange?.endDate ?? "");
  const [rangeSaving, setRangeSaving] = useState(false);

  const editableRange = useMemo(
    () =>
      parseConsideredHackatimeRange({
        startDate: rangeStartDate,
        endDate: rangeEndDate,
      }),
    [rangeEndDate, rangeStartDate],
  );

  const localRangePreview = useMemo<HackatimeRangePreview | null>(() => {
    if (
      !editableRange.ok ||
      !canonicalProjectRange ||
      canonicalProjectRange.startDate !== editableRange.value.startDate ||
      canonicalProjectRange.endDate !== editableRange.value.endDate
    ) {
      return null;
    }
    return {
        hackatimeTotalSeconds: project.hackatimeHours
          ? project.hackatimeHours.hours * 3600 + project.hackatimeHours.minutes * 60
          : null,
        hackatimeHours: project.hackatimeHours,
    };
  }, [canonicalProjectRange, editableRange, project.hackatimeHours]);

  const { preview: rangePreview, loading: rangePreviewLoading, error: rangePreviewError } =
    useHackatimeRangePreview({
      enabled: project.status !== "granted" && !!project.hackatimeProjectName.trim(),
      endpoint: `/api/admin/projects/${encodeURIComponent(project.id)}/hackatime-preview`,
      body: editableRange.ok ? { consideredHackatimeRange: editableRange.value } : null,
      rangeError: !editableRange.ok && (rangeStartDate || rangeEndDate) ? editableRange.error : null,
      localPreview: localRangePreview,
    });

  const previewHoursLabel = useMemo(() => {
    if (rangePreview?.hackatimeHours) {
      return formatHoursMinutes(rangePreview.hackatimeHours.hours, rangePreview.hackatimeHours.minutes);
    }
    return project.hackatimeHours ? formatHoursMinutes(project.hackatimeHours.hours, project.hackatimeHours.minutes) : "—";
  }, [project.hackatimeHours, rangePreview]);

  const joeFraudLink = useMemo(() => {
    const hackatimeId = project.hackatimeUserId?.trim();
    if (!hackatimeId || !canonicalProjectRange) return null;
    return buildJoeFraudUrl(hackatimeId, canonicalProjectRange.startDate, canonicalProjectRange.endDate);
  }, [canonicalProjectRange, project.hackatimeUserId]);

  const screenshots = project.screenshots ?? [];
  const activeScreenshot = screenshots[screenshotIndex] ?? null;

  const onSaveRange = useCallback(async () => {
    if (project.status === "granted") {
      toast.error("Granted projects cannot change their considered Hackatime range.");
      return;
    }
    if (!editableRange.ok) {
      toast.error(editableRange.error);
      return;
    }

    setRangeSaving(true);
    const toastId = toast.loading("Saving considered range…");
    try {
      const res = await fetch(`/api/admin/projects/${encodeURIComponent(project.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consideredHackatimeRange: editableRange.value }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            project?: {
              status?: ProjectStatus;
              approvedHours?: number | null;
              hackatimeStartedAt?: string | null;
              hackatimeStoppedAt?: string | null;
              hackatimeTotalSeconds?: number | null;
              submittedAt?: string | null;
            };
            notice?: unknown;
            error?: unknown;
          }
        | null;
      if (!res.ok) {
        const message = typeof data?.error === "string" ? data.error : "Failed to save considered range.";
        toast.error(message, { id: toastId });
        setRangeSaving(false);
        return;
      }

      setProject((prev) => ({
        ...prev,
        status: (data?.project?.status ?? prev.status) as ProjectStatus,
        approvedHours:
          data?.project?.approvedHours !== undefined ? data.project.approvedHours ?? null : prev.approvedHours,
        hackatimeStartedAt:
          data?.project?.hackatimeStartedAt !== undefined
            ? data.project.hackatimeStartedAt
            : prev.hackatimeStartedAt,
        hackatimeStoppedAt:
          data?.project?.hackatimeStoppedAt !== undefined
            ? data.project.hackatimeStoppedAt
            : prev.hackatimeStoppedAt,
        hackatimeHours:
          typeof data?.project?.hackatimeTotalSeconds === "number"
            ? {
                hours: Math.floor(data.project.hackatimeTotalSeconds / 3600),
                minutes: Math.floor(data.project.hackatimeTotalSeconds / 60) % 60,
              }
            : prev.hackatimeHours,
        submittedAt:
          data?.project?.submittedAt !== undefined ? data.project.submittedAt ?? null : prev.submittedAt,
      }));
      setRangeStartDate(toDateInputValue(data?.project?.hackatimeStartedAt ?? null));
      setRangeEndDate(toDateInputValue(data?.project?.hackatimeStoppedAt ?? null));
      const notice = typeof data?.notice === "string" ? data.notice : null;
      toast.success(notice ?? "Updated.", { id: toastId });
      setRangeSaving(false);
    } catch {
      toast.error("Failed to save considered range.", { id: toastId });
      setRangeSaving(false);
    }
  }, [editableRange, project.id, project.status]);

  const setStatus = useCallback(
    async (status: Extract<ProjectStatus, "shipped" | "granted" | "in-review">) => {
      setBusy(true);
      const toastId = toast.loading(
        status === "granted" ? "Granting…" : status === "in-review" ? "Sending back to review…" : "Reverting…",
      );
      try {
        const res = await fetch(`/api/admin/projects/${encodeURIComponent(project.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            // Grants carry the pass-2 technical justification; the server
            // refuses to grant without it.
            ...(status === "granted"
              ? { grantTechnicalJustification: technicalJustification }
              : {}),
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | {
              project?: { status?: ProjectStatus };
              error?: unknown;
              details?: unknown;
              hints?: unknown;
              statusCode?: unknown;
              airtableError?: unknown;
            }
          | null;
        if (!res.ok) {
          const message = typeof data?.error === "string" ? data.error : "Failed to update status.";
          const details = typeof data?.details === "string" ? data.details : null;
          const hints = Array.isArray(data?.hints)
            ? data?.hints.filter((h): h is string => typeof h === "string")
            : [];
          const statusCode =
            typeof data?.statusCode === "number" ? data.statusCode : undefined;
          const airtableError =
            typeof data?.airtableError === "string" ? data.airtableError : undefined;

          if (details || hints.length) {
            toast.custom(
              (t) => (
                <div className="platform-surface-card px-4 py-3 shadow-xl max-w-[720px]">
                  <div className="text-foreground font-semibold">{message}</div>
                  {statusCode || airtableError ? (
                    <div className="text-muted-foreground text-xs mt-1">
                      {statusCode ? `Airtable status: ${statusCode}` : null}
                      {statusCode && airtableError ? " • " : null}
                      {airtableError ? `Airtable error: ${airtableError}` : null}
                    </div>
                  ) : null}
                  {details ? (
                    <pre className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap break-words bg-muted border border-border rounded-[var(--radius-xl)] p-3">
                      {details}
                    </pre>
                  ) : null}
                  {hints.length ? (
                    <div className="mt-3 text-sm">
                      <div className="text-foreground font-semibold">What may be wrong</div>
                      <ul className="mt-2 space-y-1 text-muted-foreground list-disc pl-5">
                        {hints.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="mt-3 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => toast.dismiss(t.id)}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ),
              { id: toastId, duration: 20000 },
            );
          } else {
            toast.error(message, { id: toastId });
          }
          setBusy(false);
          return;
        }
        setProject((p) => ({
          ...p,
          status: (data?.project?.status ?? status) as ProjectStatus,
          ...(status === "granted"
            ? { grantTechnicalJustification: technicalJustification || null }
            : {}),
        }));
        toast.success(
          status === "granted" ? "Granted — the creator has been notified." : "Updated.",
          { id: toastId },
        );
        setBusy(false);
      } catch {
        toast.error("Failed to update status.", { id: toastId });
        setBusy(false);
      }
    },
    [project.id, technicalJustification],
  );

  const onDeleteProject = useCallback(async () => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    setBusy(true);
    const toastId = toast.loading("Deleting project…");
    try {
      const res = await fetch(`/api/admin/projects/${encodeURIComponent(project.id)}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
      if (!res.ok) {
        const message = typeof data?.error === "string" ? data.error : "Failed to delete project.";
        toast.error(message, { id: toastId });
        setBusy(false);
        return;
      }
      toast.success("Deleted.", { id: toastId });
      window.location.href = "/admin/grants";
    } catch {
      toast.error("Failed to delete project.", { id: toastId });
      setBusy(false);
    }
  }, [project.id]);

  const onPushToAirtable = useCallback(async (opts?: { createNew?: boolean; preview?: boolean }) => {
    const createNew = opts?.createNew === true;
    const preview = opts?.preview === true;
    // Default push UPDATES the linked Airtable record (idempotent). Creating
    // an additional record is an explicit, warned escape hatch. Preview
    // pushes a [PREVIEW]-marked record before granting; the grant later
    // promotes it in place.
    const confirmed = preview
      ? confirm(
          "Push a [PREVIEW] record to Airtable? It is clearly marked (Review Status: \"[PREVIEW] Do not process\") so you can inspect the justification in Airtable before granting. Granting will overwrite it with the real record; sending the project back to review deletes it.",
        )
      : createNew
        ? confirm(
            "Create an ADDITIONAL Airtable record for this project? This is only for when the existing record must be kept and a second submission row is genuinely needed. It WILL result in two records.",
          )
        : project.airtableRecordId
          ? confirm(
              `Push to Airtable? This updates the existing record (${project.airtableRecordId}) with the current data — no duplicate is created.`,
            )
          : confirm("Push this project to Airtable? A new record will be created and linked.");
    if (!confirmed) return;
    setBusy(true);
    const toastId = toast.loading(preview ? "Pushing preview to Airtable…" : "Pushing to Airtable…");
    try {
      const res = await fetch(`/api/admin/projects/${encodeURIComponent(project.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          preview
            ? { preview: true, technicalJustification }
            : { createNew },
        ),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            airtableRecordId?: unknown;
            error?: unknown;
            details?: unknown;
            hints?: unknown;
            statusCode?: unknown;
            airtableError?: unknown;
          }
        | null;
      if (!res.ok) {
        const message = typeof data?.error === "string" ? data.error : "Failed to push to Airtable.";
        const details = typeof data?.details === "string" ? data.details : null;
        const hints = Array.isArray(data?.hints)
          ? data?.hints.filter((h): h is string => typeof h === "string")
          : [];
        const statusCode = typeof data?.statusCode === "number" ? data.statusCode : undefined;
        const airtableError = typeof data?.airtableError === "string" ? data.airtableError : undefined;

        if (details || hints.length) {
          toast.custom(
            (t) => (
              <div className="platform-surface-card px-4 py-3 shadow-xl max-w-[720px]">
                <div className="text-foreground font-semibold">{message}</div>
                {statusCode || airtableError ? (
                  <div className="text-muted-foreground text-xs mt-1">
                    {statusCode ? `Airtable status: ${statusCode}` : null}
                    {statusCode && airtableError ? " • " : null}
                    {airtableError ? `Airtable error: ${airtableError}` : null}
                  </div>
                ) : null}
                {details ? (
                  <pre className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap break-words bg-muted border border-border rounded-[var(--radius-xl)] p-3">
                    {details}
                  </pre>
                ) : null}
                {hints.length ? (
                  <div className="mt-3 text-sm">
                    <div className="text-foreground font-semibold">What may be wrong</div>
                    <ul className="mt-2 space-y-1 text-muted-foreground list-disc pl-5">
                      {hints.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-3 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => toast.dismiss(t.id)}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ),
            { id: toastId, duration: 20000 },
          );
        } else {
          toast.error(message, { id: toastId });
        }
        setBusy(false);
        return;
      }

      const recordId = typeof data?.airtableRecordId === "string" ? data.airtableRecordId : null;
      const mode = (data as { mode?: unknown } | null)?.mode === "updated" ? "updated" : "created";
      if (recordId) {
        setProject((p) => ({ ...p, airtableRecordId: recordId, airtableRecordIsPreview: preview }));
      }
      toast.success(
        recordId
          ? preview
            ? `Preview record ${mode} in Airtable (${recordId}) — open the table to inspect the justification.`
            : `Airtable record ${mode} (${recordId}).`
          : "Pushed to Airtable.",
        { id: toastId },
      );
      setBusy(false);
    } catch {
      toast.error("Failed to push to Airtable.", { id: toastId });
      setBusy(false);
    }
  }, [project.id, project.airtableRecordId, technicalJustification]);

  return (
    <div className="space-y-6">
      <div className="platform-surface-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-foreground font-bold text-2xl truncate">{project.name}</div>
            <div className="text-muted-foreground mt-1">Grant review &amp; creator context.</div>
          </div>
          <ProjectStatusBadge status={project.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="platform-surface-card p-6 space-y-4">
          <div className="text-foreground font-semibold text-lg">Project</div>
          <div className="text-muted-foreground">{project.description}</div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Editor:{" "}
              <span className="text-foreground">
                <ProjectEditorBadge editor={project.editor} editorOther={project.editorOther} />
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowReviews(true)}
              className="text-sm font-semibold text-carnival-blue hover:underline"
            >
              View review comments
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-3">
              <div className="text-sm text-muted-foreground">Hackatime project</div>
              <div className="text-foreground font-semibold truncate">
                <span className="font-mono">{project.hackatimeProjectName || "—"}</span>
              </div>
            </div>
            <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-3">
              <div className="text-sm text-muted-foreground">Hackatime user_id</div>
              <div className="text-foreground font-semibold truncate">
                <span className="font-mono">{project.hackatimeUserId || "—"}</span>
              </div>
            </div>
            <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-3">
              <div className="text-sm text-muted-foreground">Hours logged (Hackatime)</div>
              <div className="text-foreground font-semibold">
                {project.hackatimeHours ? formatHoursMinutes(project.hackatimeHours.hours, project.hackatimeHours.minutes) : "—"}
              </div>
            </div>
            <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-3">
              <div className="text-sm text-muted-foreground">Approved hours</div>
              <div className="text-foreground font-semibold">
                {project.approvedHours !== null && project.approvedHours !== undefined ? `${project.approvedHours}h` : "—"}
              </div>
            </div>
            <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-3">
              <div className="text-sm text-muted-foreground">Trust level</div>
              <div className="mt-1">
                {trustLevel ? (
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${trustLevelColor(trustLevel.level)}`}>
                    {trustLevel.level ?? "unknown"}{trustLevel.value !== null ? ` (${trustLevel.value})` : ""}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Loading…</span>
                )}
              </div>
            </div>
            <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-3">
              <div className="text-sm text-muted-foreground">Considered Hackatime range</div>
              <div className="text-foreground font-semibold">{canonicalProjectRangeLabel}</div>
            </div>
          </div>

          <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-4 space-y-3">
            <div>
              <div className="text-foreground font-semibold">Edit considered Hackatime range</div>
              <div className="text-sm text-muted-foreground mt-1">
                Adjust the project’s canonical Hackatime window and refresh the stored hours.
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <div className="text-xs text-muted-foreground mb-1">Start date</div>
                <DatePicker value={rangeStartDate} onChange={(v) => setRangeStartDate(v)} disabled={rangeSaving || project.status === "granted"} />
              </label>
              <label className="block">
                <div className="text-xs text-muted-foreground mb-1">End date</div>
                <DatePicker value={rangeEndDate} onChange={(v) => setRangeEndDate(v)} disabled={rangeSaving || project.status === "granted"} />
              </label>
            </div>
            {!editableRange.ok ? (
              <div className="text-xs text-red-200">{editableRange.error}</div>
            ) : null}
            {rangePreviewLoading ? (
              <div className="text-xs text-muted-foreground">Refreshing Hackatime hours…</div>
            ) : null}
            {rangePreviewError ? (
              <div className="text-xs text-red-200">{rangePreviewError}</div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="text-muted-foreground">
                Previewed Hackatime hours: <span className="text-foreground font-semibold">{previewHoursLabel}</span>
              </div>
              <button
                type="button"
                onClick={onSaveRange}
                disabled={rangeSaving || project.status === "granted" || !editableRange.ok}
                className="inline-flex items-center justify-center bg-background hover:bg-background/80 disabled:bg-background/50 disabled:cursor-not-allowed text-foreground px-4 py-2 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border"
              >
                {rangeSaving ? "Saving…" : "Save range"}
              </button>
            </div>
            {project.status === "granted" ? (
              <div className="text-xs text-muted-foreground">
                Granted projects keep their final Hackatime range locked.
              </div>
            ) : null}
          </div>

          <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-4 space-y-3">
            <div className="text-foreground font-semibold">Submission checklist</div>
            {project.submissionChecklist ? (
              <div className="space-y-2">
                {PROJECT_SUBMISSION_CHECKLIST_ITEMS.map((item) => {
                  const checked = project.submissionChecklist?.[item.key] ?? false;
                  return (
                    <div key={item.key} className="flex items-start justify-between gap-3">
                      <div className="text-sm text-foreground">{item.label}</div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span
                          className={[
                            "text-xs font-semibold uppercase tracking-wide",
                            checked ? "text-emerald-300" : "text-muted-foreground",
                          ].join(" ")}
                        >
                          {checked ? "Checked" : "Unchecked"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No checklist state was saved for this submission.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {project.playableDemoUrl ? <LinkChip label="Demo" url={project.playableDemoUrl} /> : null}
            {project.videoUrl ? <LinkChip label="Video" url={project.videoUrl} /> : null}
            {project.codeUrl ? <LinkChip label="GitHub" url={project.codeUrl} /> : null}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Created: {new Date(project.createdAt).toLocaleString()} • Submitted:{" "}
              {project.submittedAt ? new Date(project.submittedAt).toLocaleString() : "—"} • Considered range:{" "}
              {canonicalProjectRangeLabel}
            </div>
            {joeFraudLink ? (
              <a
                href={joeFraudLink}
                target="_blank"
                rel="noreferrer"
                className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-3 hover:bg-muted/70 transition-colors"
              >
                Review Hackatime (Joe.fraud)
              </a>
            ) : null}
          </div>

          {project.screenshots?.length ? (
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-foreground font-semibold">Screenshots</div>
                <button
                  type="button"
                  onClick={() => {
                    setScreenshotIndex(0);
                    setShowScreenshots(true);
                  }}
                  className="text-sm font-semibold text-carnival-blue hover:underline"
                >
                  View screenshots
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.screenshots.map((url, idx) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="w-full rounded-[var(--radius-2xl)] border border-border object-cover bg-muted"
                    referrerPolicy="no-referrer"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setScreenshotIndex(idx);
                      setShowScreenshots(true);
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="platform-surface-card p-6 space-y-4">
          <div className="text-foreground font-semibold text-lg">Creator</div>
          <div className="text-sm text-muted-foreground">
            <div>
              <span className="text-muted-foreground">Name:</span>{" "}
              <span className="text-foreground font-semibold">{initial.creator.name}</span>
            </div>
            <div className="mt-1">
              <span className="text-muted-foreground">Email:</span>{" "}
              <span className="text-foreground font-mono">{initial.creator.email || "—"}</span>
            </div>
            <div className="mt-1">
              <span className="text-muted-foreground">Slack:</span>{" "}
              <span className="text-foreground font-mono">{initial.creator.slackId || "—"}</span>
            </div>
            <div className="mt-1">
              <span className="text-muted-foreground">Verification:</span>{" "}
              <span className="text-foreground font-mono">{initial.creator.verificationStatus || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pass 2 — the human-written hours justification. The server refuses
          to grant without it; the pass-1 reviewer's draft (if any) seeds the
          editor. This text is internal — the creator never sees it. */}
      <div className="platform-surface-card p-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-foreground font-semibold text-lg">
              Specific technical features (hours justification)
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Human-written, required to grant. Name the technical qualities that justify the
              approved hours — specific features, not just languages. Goes to the Unified
              Database; never shown to the creator.
            </div>
          </div>
          <a
            href={`/review/${encodeURIComponent(project.id)}`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-sm font-semibold text-carnival-blue hover:underline"
          >
            Open full review view ↗
          </a>
        </div>
        {passOneDraft && passOneDraft !== technicalJustification ? (
          <div className="rounded-[var(--radius-xl)] border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            Pass-1 reviewer draft: “{passOneDraft}”{" "}
            <button
              type="button"
              onClick={() => setTechnicalJustification(passOneDraft)}
              className="font-semibold text-carnival-blue hover:underline"
            >
              Use draft
            </button>
          </div>
        ) : null}
        <textarea
          value={technicalJustification}
          onChange={(e) => setTechnicalJustification(e.target.value)}
          rows={4}
          disabled={busy || project.status === "granted"}
          className="w-full bg-background border border-border rounded-[var(--radius-2xl)] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
          placeholder='e.g. "content-script messaging between tabs, OAuth device flow, custom esbuild pipeline, options page with synced storage"'
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {project.airtableRecordId
              ? project.airtableRecordIsPreview
                ? `Linked Airtable record: ${project.airtableRecordId} (PREVIEW — promoted on grant, deleted if sent back to review)`
                : `Linked Airtable record: ${project.airtableRecordId}`
              : "No Airtable record yet — a preview push or the grant creates one."}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveTechnicalJustification}
              disabled={busy || justificationSaving || project.status === "granted"}
              className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 disabled:bg-muted/40 disabled:cursor-not-allowed text-foreground px-4 py-2 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border"
            >
              {justificationSaving ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={loadAirtablePreview}
              disabled={previewLoading}
              className="inline-flex items-center justify-center bg-carnival-blue/15 hover:bg-carnival-blue/25 disabled:opacity-50 text-foreground px-4 py-2 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border"
            >
              {previewLoading ? "Building preview…" : "Preview Airtable payload"}
            </button>
            {project.status === "shipped" ? (
              <button
                type="button"
                onClick={() => onPushToAirtable({ preview: true })}
                disabled={busy}
                className="inline-flex items-center justify-center bg-carnival-blue/15 hover:bg-carnival-blue/25 disabled:opacity-50 text-foreground px-4 py-2 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border"
                title="Push a [PREVIEW]-marked record to Airtable so you can inspect the justification in the table itself. The grant later overwrites it in place."
              >
                Push [PREVIEW] to Airtable
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="platform-surface-card p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="text-muted-foreground">
          {project.status === "granted"
            ? "Granted projects are locked for creators."
            : "Granting sends the record to Airtable, credits tokens, and notifies the creator — the only approval notification they receive."}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setStatus("granted")}
            disabled={busy || !canGrant || !technicalJustification.trim()}
            title={
              !technicalJustification.trim()
                ? "Write the Specific Technical Features justification first."
                : undefined
            }
            className="inline-flex items-center justify-center bg-carnival-blue/20 hover:bg-carnival-blue/30 disabled:bg-carnival-blue/10 disabled:cursor-not-allowed text-foreground px-5 py-3 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border"
          >
            Grant
          </button>
          <button
            type="button"
            onClick={() => setStatus("shipped")}
            disabled={busy || !canUngrant}
            className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 disabled:bg-muted/40 disabled:cursor-not-allowed text-foreground px-5 py-3 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border"
          >
            Undo grant
          </button>
          <button
            type="button"
            onClick={() => setStatus("in-review")}
            disabled={busy || !canSendBackToReview}
            className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 disabled:bg-muted/40 disabled:cursor-not-allowed text-foreground px-5 py-3 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border"
          >
            Back to review queue
          </button>
          <button
            type="button"
            onClick={() => onPushToAirtable()}
            disabled={busy || project.status !== "granted"}
            className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 disabled:bg-muted/40 disabled:cursor-not-allowed text-foreground px-5 py-3 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border"
          >
            {project.airtableRecordId ? "Push update to Airtable" : "Push to Airtable"}
          </button>
          {project.airtableRecordId ? (
            <button
              type="button"
              onClick={() => onPushToAirtable({ createNew: true })}
              disabled={busy || project.status !== "granted"}
              className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 disabled:bg-muted/40 disabled:cursor-not-allowed text-muted-foreground px-4 py-3 rounded-[var(--radius-xl)] text-sm transition-colors border border-border"
              title="Creates a second Airtable record. Only for exceptional cases."
            >
              Create additional record…
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDeleteProject}
            disabled={busy}
            className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-5 py-3 rounded-[var(--radius-xl)] font-bold transition-colors"
          >
            Delete project
          </button>
        </div>
      </div>

      <Modal
        open={showReviews}
        onClose={() => setShowReviews(false)}
        title="Review comments"
        description="All review history for this project."
        maxWidth="lg"
      >
        {initial.reviews.length === 0 ? (
          <div className="text-muted-foreground">No reviews yet.</div>
        ) : (
          <div className="space-y-3">
            {initial.reviews.map((r) => (
              <div key={r.id} className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-foreground font-semibold truncate">
                      {r.reviewerName}
                      {r.reviewerEmail ? ` • ${r.reviewerEmail}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {r.decision}
                    </span>
                    {r.approvedHours !== null && r.approvedHours !== undefined ? (
                      <span className="text-xs font-semibold text-foreground">
                        {r.approvedHours}h approved
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="text-foreground mt-3 whitespace-pre-wrap">{r.reviewComment}</div>
                {r.reviewJustification ? (
                  <ReviewJustificationSummary justification={r.reviewJustification} />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={showScreenshots}
        onClose={() => setShowScreenshots(false)}
        title={`Screenshots (${screenshots.length > 0 ? screenshotIndex + 1 : 0}/${screenshots.length})`}
        description="Click next/prev to view larger screenshots."
        maxWidth="2xl"
      >
        {activeScreenshot ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setScreenshotIndex((i) => Math.max(0, i - 1))}
                disabled={screenshotIndex <= 0}
                className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 disabled:bg-muted/40 disabled:cursor-not-allowed text-foreground px-4 py-2 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border"
              >
                Prev
              </button>
              <a
                href={activeScreenshot}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-carnival-blue hover:underline truncate"
              >
                Open original
              </a>
              <button
                type="button"
                onClick={() => setScreenshotIndex((i) => Math.min(screenshots.length - 1, i + 1))}
                disabled={screenshotIndex >= screenshots.length - 1}
                className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 disabled:bg-muted/40 disabled:cursor-not-allowed text-foreground px-4 py-2 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border"
              >
                Next
              </button>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeScreenshot}
              alt=""
              className="w-full max-h-[70vh] object-contain rounded-[var(--radius-2xl)] border border-border bg-muted"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="text-muted-foreground">No screenshots.</div>
        )}
      </Modal>

      {/* Dry run of the EXACT payload a grant/push would send — same builder
          as the live push, so this can never diverge from reality. */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Airtable payload preview"
        description="This is exactly what will be sent to the Unified Database."
        maxWidth="2xl"
      >
        {preview ? (
          <div className="space-y-4">
            {!preview.hoursInvariantOk ? (
              <div className="rounded-[var(--radius-2xl)] border border-carnival-red/40 bg-carnival-red/10 px-4 py-3 text-sm text-red-200">
                {preview.hoursInvariantError ??
                  "Hours invariant violated — the payload hours do not match the approved hours."}
              </div>
            ) : (
              <div className="rounded-[var(--radius-2xl)] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                Hours check passed: Override Hours Spent matches the approved hours derived from
                the review.
              </div>
            )}

            <div>
              <div className="text-foreground font-semibold mb-2">
                Override Hours Spent Justification (as sent)
              </div>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words bg-muted border border-border rounded-[var(--radius-xl)] p-3 max-h-[320px] overflow-y-auto">
                {preview.justificationText || "—"}
              </pre>
            </div>

            <div>
              <div className="text-foreground font-semibold mb-2">All fields</div>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words bg-muted border border-border rounded-[var(--radius-xl)] p-3 max-h-[320px] overflow-y-auto">
                {JSON.stringify(preview.fields, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground">No preview loaded.</div>
        )}
      </Modal>
    </div>
  );
}
