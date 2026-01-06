"use client";

import { useCallback, useMemo, useState } from "react";
import type { ProjectStatus, ReviewDecision } from "@/db/schema";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import toast from "react-hot-toast";

type ReviewItem = {
  id: string;
  decision: ReviewDecision;
  reviewComment: string;
  createdAt: string; // ISO
  reviewerName: string;
  reviewerEmail: string;
};

type ReviewableProject = {
  id: string;
  name: string;
  description: string;
  hackatimeProjectName: string;
  playableUrl: string;
  codeUrl: string;
  screenshots: string[];
  status: ProjectStatus;
  creatorName: string;
  creatorEmail: string;
};

export default function ReviewProjectClient({
  initial,
}: {
  initial: { isAdmin: boolean; project: ReviewableProject; reviews: ReviewItem[] };
}) {
  const isAdmin = initial.isAdmin;
  const [project, setProject] = useState(initial.project);
  const [reviews, setReviews] = useState<ReviewItem[]>(initial.reviews);
  const [decision, setDecision] = useState<ReviewDecision>("comment");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successAt, setSuccessAt] = useState<number | null>(null);

  const canSubmit = useMemo(() => {
    return comment.trim().length > 0 && !submitting;
  }, [comment, submitting]);

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
        body: JSON.stringify({ decision, comment: comment.trim() }),
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
        setReviews((prev) => [data.review!, ...prev]);
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
  }, [canSubmit, comment, decision, project.id]);

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
          <ProjectStatusBadge status={project.status} />
        </div>
        <div className="text-muted-foreground mt-4">{project.description}</div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="text-foreground font-semibold text-lg">Links</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href={project.playableUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-border bg-muted px-4 py-3 hover:bg-muted/70 transition-colors"
          >
            <div className="text-sm text-muted-foreground">Playable</div>
            <div className="text-foreground font-semibold truncate">{project.playableUrl}</div>
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
        <div className="text-sm text-muted-foreground">
          Hackatime project: <span className="font-mono text-foreground">{project.hackatimeProjectName}</span>
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


