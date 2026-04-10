"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  ProjectEditor,
  ProjectStatus,
  ProjectSubmissionChecklist,
  ReviewDecision,
} from "@/db/schema";
import { buildBillyUrl } from "@/lib/constants";
import { Modal } from "@/components/ui";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import ProjectEditorBadge from "@/components/ProjectEditorBadge";
import { PROJECT_SUBMISSION_CHECKLIST_ITEMS } from "@/lib/project-submission-checklist";
import ReviewJustificationSummary from "@/components/ReviewJustificationSummary";
import type { ReviewJustificationPayload } from "@/lib/review-rules";
import {
  formatConsideredHackatimeRangeLabel,
  getProjectConsideredHackatimeRange,
} from "@/lib/hackatime-range";
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
};

function formatHoursMinutes(hours: number, minutes: number) {
  const h = Number.isFinite(hours) ? Math.max(0, Math.floor(hours)) : 0;
  const m = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
  return `${h}h${String(m).padStart(2, "0")}m`;
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

  const billyLink = useMemo(() => {
    const hackatimeId = project.hackatimeUserId?.trim();
    if (!hackatimeId || !canonicalProjectRange) return null;
    return buildBillyUrl(hackatimeId, canonicalProjectRange.startDate, canonicalProjectRange.endDate);
  }, [canonicalProjectRange, project.hackatimeUserId]);

  const screenshots = project.screenshots ?? [];
  const activeScreenshot = screenshots[screenshotIndex] ?? null;

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
          body: JSON.stringify({ status }),
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
                <div className="bg-card border border-border rounded-2xl px-4 py-3 shadow-xl max-w-[720px]">
                  <div className="text-foreground font-semibold">{message}</div>
                  {statusCode || airtableError ? (
                    <div className="text-muted-foreground text-xs mt-1">
                      {statusCode ? `Airtable status: ${statusCode}` : null}
                      {statusCode && airtableError ? " • " : null}
                      {airtableError ? `Airtable error: ${airtableError}` : null}
                    </div>
                  ) : null}
                  {details ? (
                    <pre className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap break-words bg-muted border border-border rounded-xl p-3">
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
        setProject((p) => ({ ...p, status: (data?.project?.status ?? status) as ProjectStatus }));
        toast.success("Updated.", { id: toastId });
        setBusy(false);
      } catch {
        toast.error("Failed to update status.", { id: toastId });
        setBusy(false);
      }
    },
    [project.id],
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

  const onPushToAirtable = useCallback(async () => {
    const confirmed = confirm(
      "Push this project to Airtable? Only do this if the project is missing from Airtable. If it already exists, this will create a duplicate submission.",
    );
    if (!confirmed) return;
    setBusy(true);
    const toastId = toast.loading("Pushing to Airtable…");
    try {
      const res = await fetch(`/api/admin/projects/${encodeURIComponent(project.id)}`, {
        method: "POST",
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
              <div className="bg-card border border-border rounded-2xl px-4 py-3 shadow-xl max-w-[720px]">
                <div className="text-foreground font-semibold">{message}</div>
                {statusCode || airtableError ? (
                  <div className="text-muted-foreground text-xs mt-1">
                    {statusCode ? `Airtable status: ${statusCode}` : null}
                    {statusCode && airtableError ? " • " : null}
                    {airtableError ? `Airtable error: ${airtableError}` : null}
                  </div>
                ) : null}
                {details ? (
                  <pre className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap break-words bg-muted border border-border rounded-xl p-3">
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
      toast.success(recordId ? `Airtable created (${recordId}).` : "Pushed to Airtable.", {
        id: toastId,
      });
      setBusy(false);
    } catch {
      toast.error("Failed to push to Airtable.", { id: toastId });
      setBusy(false);
    }
  }, [project.id]);

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-foreground font-bold text-2xl truncate">{project.name}</div>
            <div className="text-muted-foreground mt-1">Grant review &amp; creator context.</div>
          </div>
          <ProjectStatusBadge status={project.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
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
            <div className="rounded-2xl border border-border bg-muted px-4 py-3">
              <div className="text-sm text-muted-foreground">Hackatime project</div>
              <div className="text-foreground font-semibold truncate">
                <span className="font-mono">{project.hackatimeProjectName || "—"}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-muted px-4 py-3">
              <div className="text-sm text-muted-foreground">Hackatime user_id</div>
              <div className="text-foreground font-semibold truncate">
                <span className="font-mono">{project.hackatimeUserId || "—"}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-muted px-4 py-3">
              <div className="text-sm text-muted-foreground">Hours logged (Hackatime)</div>
              <div className="text-foreground font-semibold">
                {project.hackatimeHours ? formatHoursMinutes(project.hackatimeHours.hours, project.hackatimeHours.minutes) : "—"}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-muted px-4 py-3">
              <div className="text-sm text-muted-foreground">Approved hours</div>
              <div className="text-foreground font-semibold">
                {project.approvedHours !== null && project.approvedHours !== undefined ? `${project.approvedHours}h` : "—"}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-muted px-4 py-3 md:col-span-2">
              <div className="text-sm text-muted-foreground">Considered Hackatime range</div>
              <div className="text-foreground font-semibold">{canonicalProjectRangeLabel}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted px-4 py-4 space-y-3">
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
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide",
                            item.required
                              ? "bg-rose-500/15 text-rose-200"
                              : "bg-emerald-500/15 text-emerald-200",
                          ].join(" ")}
                        >
                          {item.required ? "Required" : "Optional"}
                        </span>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <a
              href={project.playableDemoUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-border bg-muted px-4 py-3 hover:bg-muted/70 transition-colors"
            >
              <div className="text-sm text-muted-foreground">Playable demo link</div>
              <div className="text-foreground font-semibold truncate">{project.playableDemoUrl}</div>
            </a>
            <a
              href={project.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-border bg-muted px-4 py-3 hover:bg-muted/70 transition-colors"
            >
              <div className="text-sm text-muted-foreground">Video</div>
              <div className="text-foreground font-semibold truncate">{project.videoUrl}</div>
            </a>
            <a
              href={project.codeUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-border bg-muted px-4 py-3 hover:bg-muted/70 transition-colors"
            >
              <div className="text-sm text-muted-foreground">GitHub</div>
              <div className="text-foreground font-semibold truncate">{project.codeUrl}</div>
            </a>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Created: {new Date(project.createdAt).toLocaleString()} • Submitted:{" "}
              {project.submittedAt ? new Date(project.submittedAt).toLocaleString() : "—"} • Considered range:{" "}
              {canonicalProjectRangeLabel}
            </div>
            {billyLink ? (
              <a
                href={billyLink}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-carnival-blue hover:underline"
              >
                Review Hackatime (billy)
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
                    className="w-full rounded-2xl border border-border object-cover bg-muted"
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

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
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

      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="text-muted-foreground">
          {project.status === "granted"
            ? "Granted projects are locked for creators."
            : "Granting will lock this project for the creator."}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStatus("granted")}
            disabled={busy || !canGrant}
            className="inline-flex items-center justify-center bg-carnival-blue/20 hover:bg-carnival-blue/30 disabled:bg-carnival-blue/10 disabled:cursor-not-allowed text-foreground px-5 py-3 rounded-full font-semibold transition-colors border border-border"
          >
            Grant
          </button>
          <button
            type="button"
            onClick={() => setStatus("shipped")}
            disabled={busy || !canUngrant}
            className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 disabled:bg-muted/40 disabled:cursor-not-allowed text-foreground px-5 py-3 rounded-full font-semibold transition-colors border border-border"
          >
            Undo grant
          </button>
          <button
            type="button"
            onClick={() => setStatus("in-review")}
            disabled={busy || !canSendBackToReview}
            className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 disabled:bg-muted/40 disabled:cursor-not-allowed text-foreground px-5 py-3 rounded-full font-semibold transition-colors border border-border"
          >
            Back to review queue
          </button>
          <button
            type="button"
            onClick={onPushToAirtable}
            disabled={busy || project.status !== "granted"}
            className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 disabled:bg-muted/40 disabled:cursor-not-allowed text-foreground px-5 py-3 rounded-full font-semibold transition-colors border border-border"
          >
            Push to Airtable
          </button>
          <button
            type="button"
            onClick={onDeleteProject}
            disabled={busy}
            className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-5 py-3 rounded-full font-bold transition-colors"
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
              <div key={r.id} className="rounded-2xl border border-border bg-muted px-4 py-4">
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
                className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 disabled:bg-muted/40 disabled:cursor-not-allowed text-foreground px-4 py-2 rounded-full font-semibold transition-colors border border-border"
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
                className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 disabled:bg-muted/40 disabled:cursor-not-allowed text-foreground px-4 py-2 rounded-full font-semibold transition-colors border border-border"
              >
                Next
              </button>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeScreenshot}
              alt=""
              className="w-full max-h-[70vh] object-contain rounded-2xl border border-border bg-muted"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="text-muted-foreground">No screenshots.</div>
        )}
      </Modal>
    </div>
  );
}
