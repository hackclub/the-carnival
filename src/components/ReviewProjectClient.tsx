"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  ProjectEditor,
  ProjectStatus,
  ProjectSubmissionChecklist,
  ReviewDecision,
} from "@/db/schema";
import { buildBillyUrl } from "@/lib/constants";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import ProjectEditorBadge from "@/components/ProjectEditorBadge";
import { PROJECT_SUBMISSION_CHECKLIST_ITEMS } from "@/lib/project-submission-checklist";
import toast from "react-hot-toast";

type ReviewItem = {
  id: string;
  decision: ReviewDecision;
  reviewComment: string;
  approvedHours: number | null;
  hackatimeSnapshotSeconds: number;
  createdAt: string; // ISO
  reviewerName: string;
  reviewerEmail: string;
};

type AssignmentItem = {
  reviewerId: string;
  reviewerName: string;
  reviewerEmail: string;
  createdAt: string; // ISO
};

type ReviewableProject = {
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
  creatorName: string;
  creatorEmail: string;
  hackatimeUserId: string | null;
  hackatimeHours: { hours: number; minutes: number } | null;
  hackatimeStartedAt: string | null;
  hackatimeStoppedAt: string | null;
  createdAt: string; // ISO
  submittedAt: string | null; // ISO
};

function formatYmd(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export default function ReviewProjectClient({
  initial,
}: {
  initial: {
    isAdmin: boolean;
    viewerUserId: string;
    project: ReviewableProject;
    reviews: ReviewItem[];
    assignments: AssignmentItem[];
  };
}) {
  const isAdmin = initial.isAdmin;
  const [project, setProject] = useState(initial.project);
  const [reviews, setReviews] = useState<ReviewItem[]>(initial.reviews);
  const [assignments, setAssignments] = useState<AssignmentItem[]>(initial.assignments);
  const [decision, setDecision] = useState<ReviewDecision>("comment");
  const [comment, setComment] = useState("");
  const [approvedHours, setApprovedHours] = useState<string>(() => {
    if (initial.project.approvedHours !== null && initial.project.approvedHours !== undefined) {
      return String(initial.project.approvedHours);
    }
    if (initial.project.hackatimeHours) return String(initial.project.hackatimeHours.hours);
    return "";
  });
  const [submitting, setSubmitting] = useState(false);
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successAt, setSuccessAt] = useState<number | null>(null);

  const approvedHoursValue = useMemo(() => {
    const v = approvedHours.trim();
    if (!v) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    const doubled = n * 2;
    if (Math.abs(doubled - Math.round(doubled)) > 1e-9) return null;
    return Math.round(doubled) / 2;
  }, [approvedHours]);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (comment.trim().length === 0) return false;
    if (decision === "approved") return approvedHoursValue !== null;
    return true;
  }, [approvedHoursValue, comment, decision, submitting]);

  const isAssignedToMe = useMemo(
    () => assignments.some((a) => a.reviewerId === initial.viewerUserId),
    [assignments, initial.viewerUserId],
  );

  const billyLink = useMemo(() => {
    const hackatimeId = project.hackatimeUserId?.trim();
    if (!hackatimeId) return null;
    const start =
      formatYmd(project.hackatimeStartedAt) ??
      formatYmd(project.createdAt) ??
      formatYmd(project.submittedAt ?? project.createdAt);
    const end =
      formatYmd(project.hackatimeStoppedAt) ??
      formatYmd(project.submittedAt) ??
      formatYmd(project.createdAt);
    if (!start || !end) return null;
    return buildBillyUrl(hackatimeId, start, end);
  }, [
    project.createdAt,
    project.hackatimeStartedAt,
    project.hackatimeStoppedAt,
    project.hackatimeUserId,
    project.submittedAt,
  ]);

  const hackatimeLoggedLabel = useMemo(() => {
    if (!project.hackatimeHours) return "Unavailable";
    const h = Math.max(0, Math.floor(project.hackatimeHours.hours));
    const m = Math.max(0, Math.floor(project.hackatimeHours.minutes));
    return `${h}h${String(m).padStart(2, "0")}m`;
  }, [project.hackatimeHours]);

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setSuccessAt(null);

    const toastId = toast.loading("Submitting review…");
    try {
      const res = await fetch(`/api/review/${encodeURIComponent(project.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          comment: comment.trim(),
          approvedHours: decision === "approved" ? approvedHoursValue : null,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { project?: { status?: ProjectStatus }; review?: ReviewItem; error?: unknown }
        | null;

      if (!res.ok) {
        const message =
          typeof data?.error === "string" ? data.error : "Failed to submit review.";
        setError(message);
        toast.error(message, { id: toastId });
        setSubmitting(false);
        return;
      }

      if (data?.project?.status) {
        setProject((p) => ({ ...p, status: data.project!.status! }));
      }

      if (data?.review) {
        setReviews((prev) => [...prev, data.review!]);
      }

      setComment("");
      setDecision("comment");
      setSuccessAt(Date.now());
      toast.success("Review submitted.", { id: toastId });
      setSubmitting(false);
    } catch {
      setError("Failed to submit review.");
      toast.error("Failed to submit review.", { id: toastId });
      setSubmitting(false);
    }
  }, [approvedHoursValue, canSubmit, comment, decision, project.id]);

  const onDeleteReview = useCallback(
    async (reviewId: string) => {
      if (!isAdmin) return;
      const toastId = toast.loading("Deleting comment…");
      try {
        const res = await fetch(`/api/review/comments/${encodeURIComponent(reviewId)}`, {
          method: "DELETE",
        });
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
        if (!res.ok) {
          const message = typeof data?.error === "string" ? data.error : "Failed to delete comment.";
          toast.error(message, { id: toastId });
          return;
        }
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
        toast.success("Deleted.", { id: toastId });
      } catch {
        toast.error("Failed to delete comment.", { id: toastId });
      }
    },
    [isAdmin],
  );

  const onToggleAssignment = useCallback(async () => {
    if (assignmentBusy) return;
    setAssignmentBusy(true);
    const assigning = !isAssignedToMe;
    const toastId = toast.loading(assigning ? "Assigning to you…" : "Removing your assignment…");
    try {
      const res = await fetch(`/api/review/${encodeURIComponent(project.id)}/assignment`, {
        method: assigning ? "POST" : "DELETE",
      });
      const data = (await res.json().catch(() => null)) as
        | { assignments?: AssignmentItem[]; error?: unknown }
        | null;
      if (!res.ok) {
        const message = typeof data?.error === "string" ? data.error : "Failed to update assignment.";
        toast.error(message, { id: toastId });
        setAssignmentBusy(false);
        return;
      }

      setAssignments(data?.assignments ?? []);
      toast.success(assigning ? "Assigned to you." : "Unassigned.", { id: toastId });
      setAssignmentBusy(false);
    } catch {
      toast.error("Failed to update assignment.", { id: toastId });
      setAssignmentBusy(false);
    }
  }, [assignmentBusy, isAssignedToMe, project.id]);

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-foreground font-bold text-2xl truncate">{project.name}</div>
            <div className="text-muted-foreground mt-1 text-sm truncate">
              {project.creatorName}
              {project.creatorEmail ? ` • ${project.creatorEmail}` : ""}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <ProjectEditorBadge editor={project.editor} editorOther={project.editorOther} />
            <ProjectStatusBadge status={project.status} />
          </div>
        </div>
        <div className="text-muted-foreground mt-4">{project.description}</div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="text-foreground font-semibold text-lg">Review info</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-border bg-muted px-4 py-3">
            <div className="text-muted-foreground">Created</div>
            <div className="text-foreground font-semibold">
              {new Date(project.createdAt).toLocaleString()}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-muted px-4 py-3">
            <div className="text-muted-foreground">Submitted</div>
            <div className="text-foreground font-semibold">
              {project.submittedAt ? new Date(project.submittedAt).toLocaleString() : "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-muted px-4 py-3">
            <div className="text-muted-foreground">Hackatime started</div>
            <div className="text-foreground font-semibold">
              {project.hackatimeStartedAt ? new Date(project.hackatimeStartedAt).toLocaleString() : "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-muted px-4 py-3">
            <div className="text-muted-foreground">Hackatime stopped</div>
            <div className="text-foreground font-semibold">
              {project.hackatimeStoppedAt ? new Date(project.hackatimeStoppedAt).toLocaleString() : "—"}
            </div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="text-sm text-muted-foreground">Code</div>
            <div className="text-foreground font-semibold truncate">{project.codeUrl}</div>
          </a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border bg-muted px-4 py-3">
            <div className="text-sm text-muted-foreground">Hackatime project</div>
            <div className="text-foreground font-semibold truncate">
              <span className="font-mono">{project.hackatimeProjectName || "—"}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-muted px-4 py-3">
            <div className="text-sm text-muted-foreground">Hackatime hours (this project)</div>
            <div className="text-foreground font-semibold">{hackatimeLoggedLabel}</div>
          </div>
          {billyLink ? (
            <a
              href={billyLink}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-border bg-muted px-4 py-3 hover:bg-muted/70 transition-colors"
            >
              <div className="text-sm text-muted-foreground">Hackatime review link</div>
              <div className="text-foreground font-semibold truncate">{billyLink}</div>
            </a>
          ) : (
            <div className="rounded-2xl border border-border bg-muted px-4 py-3">
              <div className="text-sm text-muted-foreground">Hackatime review link</div>
              <div className="text-foreground font-semibold">—</div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-muted px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Reviewer assignments</div>
              <div className="text-foreground font-semibold">
                {assignments.length === 0
                  ? "No reviewers assigned"
                  : `${assignments.length} reviewer${assignments.length === 1 ? "" : "s"} assigned`}
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleAssignment}
              disabled={assignmentBusy}
              className="inline-flex items-center justify-center bg-background hover:bg-background/80 disabled:bg-background/50 disabled:cursor-not-allowed text-foreground px-4 py-2 rounded-full font-semibold transition-colors border border-border"
            >
              {assignmentBusy ? "Updating…" : isAssignedToMe ? "Unassign me" : "Assign to me"}
            </button>
          </div>
          {assignments.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {assignments.map((a) => (
                <div key={`${a.reviewerId}-${a.createdAt}`} className="rounded-full border border-border bg-card px-3 py-1">
                  <span className="text-xs text-foreground font-semibold">
                    {a.reviewerName}
                    {a.reviewerId === initial.viewerUserId ? " (You)" : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {project.screenshots?.length ? (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="text-foreground font-semibold text-lg">Screenshots</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {project.screenshots.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt=""
                className="w-full rounded-2xl border border-border object-cover bg-muted"
                referrerPolicy="no-referrer"
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="text-foreground font-semibold text-lg">Leave a review</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setDecision("approved")}
            className={[
              "rounded-2xl border px-4 py-3 text-left transition-colors",
              decision === "approved"
                ? "border-carnival-blue/50 bg-carnival-blue/10"
                : "border-border bg-muted hover:bg-muted/70",
            ].join(" ")}
          >
            <div className="text-foreground font-semibold">Approve</div>
            <div className="text-sm text-muted-foreground">Mark as shipped.</div>
          </button>
          <button
            type="button"
            onClick={() => setDecision("rejected")}
            className={[
              "rounded-2xl border px-4 py-3 text-left transition-colors",
              decision === "rejected"
                ? "border-carnival-blue/50 bg-carnival-blue/10"
                : "border-border bg-muted hover:bg-muted/70",
            ].join(" ")}
          >
            <div className="text-foreground font-semibold">Reject</div>
            <div className="text-sm text-muted-foreground">Send back to work in progress.</div>
          </button>
          <button
            type="button"
            onClick={() => setDecision("comment")}
            className={[
              "rounded-2xl border px-4 py-3 text-left transition-colors",
              decision === "comment"
                ? "border-carnival-blue/50 bg-carnival-blue/10"
                : "border-border bg-muted hover:bg-muted/70",
            ].join(" ")}
          >
            <div className="text-foreground font-semibold">Comment</div>
            <div className="text-sm text-muted-foreground">Keep in review queue.</div>
          </button>
        </div>

        <label className="block">
          <div className="text-sm text-muted-foreground font-medium mb-2">Approved hours</div>
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={approvedHours}
            onChange={(e) => setApprovedHours(e.target.value)}
            disabled={decision !== "approved"}
            className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40 disabled:opacity-60"
            placeholder="e.g. 10.5"
          />
          <div className="text-xs text-muted-foreground mt-2">
            Required for <span className="text-foreground">Approve</span>. Use 0.5-hour increments.
          </div>
        </label>

        <label className="block">
          <div className="text-sm text-muted-foreground font-medium mb-2">Comment</div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={5}
            className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
            placeholder="Be specific and kind. What should they improve?"
          />
        </label>

        {error ? (
          <div className="rounded-2xl border border-carnival-red/40 bg-carnival-red/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="text-sm text-muted-foreground">{successAt ? "Submitted." : null}</div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-full font-bold transition-colors"
          >
            {submitting ? "Submitting…" : "Submit review"}
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="text-foreground font-semibold text-lg">Review history</div>
        {reviews.length === 0 ? (
          <div className="text-muted-foreground">No reviews yet.</div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
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
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => onDeleteReview(r.id)}
                        className="text-xs text-red-200 hover:text-red-100"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="text-foreground mt-3 whitespace-pre-wrap">{r.reviewComment}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
