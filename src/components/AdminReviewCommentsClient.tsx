"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReviewDecision } from "@/db/schema";
import ReviewJustificationSummary from "@/components/ReviewJustificationSummary";
import type { ReviewJustificationPayload } from "@/lib/review-rules";

type ViewMode = "flat" | "grouped";

type FlatComment = {
  id: string;
  reviewerId: string;
  reviewerName: string;
  projectId: string;
  projectName: string;
  decision: ReviewDecision;
  reviewComment: string;
  reviewJustification: ReviewJustificationPayload | null;
  createdAt: string;
};

type GroupedReviewer = {
  reviewerId: string;
  reviewerName: string;
  projects: Array<{ projectId: string; projectName: string }>;
};

type FlatResponse = {
  mode: "flat";
  comments?: FlatComment[];
  error?: string;
};

type GroupedResponse = {
  mode: "grouped";
  reviewers?: GroupedReviewer[];
  error?: string;
};

const VIEW_FILTERS: Array<{ label: string; value: ViewMode }> = [
  { label: "Flat comments", value: "flat" },
  { label: "By reviewer", value: "grouped" },
];

function parseMode(searchParams: ReturnType<typeof useSearchParams>): ViewMode {
  const mode = searchParams.get("mode") ?? searchParams.get("view");
  if (mode === "grouped") return "grouped";

  const groupBy = searchParams.get("groupBy");
  if (groupBy === "reviewer") return "grouped";

  const grouped = searchParams.get("grouped");
  if (grouped === "1" || grouped === "true") return "grouped";

  return "flat";
}

function formatDecision(decision: ReviewDecision): string {
  if (decision === "approved") return "Approved";
  if (decision === "rejected") return "Rejected";
  return "Comment";
}

export default function AdminReviewCommentsClient() {
  const searchParams = useSearchParams();
  const activeMode = useMemo(() => parseMode(searchParams), [searchParams]);
  const [flatComments, setFlatComments] = useState<FlatComment[] | null>(null);
  const [groupedReviewers, setGroupedReviewers] = useState<GroupedReviewer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    setFlatComments(null);
    setGroupedReviewers(null);

    const url = `/api/admin/review/comments?mode=${encodeURIComponent(activeMode)}`;

    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as FlatResponse | GroupedResponse | null;
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load reviewer comments.");
        }

        if (cancelled) return;

        if (activeMode === "grouped") {
          const reviewers = data && "reviewers" in data && Array.isArray(data.reviewers) ? data.reviewers : [];
          setGroupedReviewers(reviewers);
          return;
        }

        const comments = data && "comments" in data && Array.isArray(data.comments) ? data.comments : [];
        setFlatComments(comments);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load reviewer comments.");
        setFlatComments([]);
        setGroupedReviewers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [activeMode]);

  const loading = activeMode === "grouped" ? groupedReviewers === null : flatComments === null;

  return (
    <div className="space-y-6">
      <div className="mb-2 flex flex-wrap gap-2">
        {VIEW_FILTERS.map((filter) => {
          const isActive = filter.value === activeMode;
          return (
            <Link
              key={filter.value}
              href={`/admin/review/comments?mode=${filter.value}`}
              className={`inline-flex items-center rounded-[var(--radius-xl)] border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-carnival-red text-white border-carnival-red"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      {loading ? (
        <div className="platform-surface-card p-8">
          <div className="text-foreground font-semibold text-lg">Loading reviewer comments…</div>
          <div className="text-muted-foreground mt-1">Fetching the latest reviewer feedback.</div>
        </div>
      ) : error ? (
        <div className="platform-surface-card p-8">
          <div className="text-foreground font-semibold text-lg">Could not load reviewer comments</div>
          <div className="text-muted-foreground mt-1">{error}</div>
        </div>
      ) : activeMode === "flat" ? (
        flatComments && flatComments.length > 0 ? (
          <>
            <div className="text-sm text-muted-foreground">
              Showing latest reviewer comments <span className="text-foreground font-semibold">({flatComments.length})</span>
            </div>
            <div className="space-y-3">
              {flatComments.map((comment) => (
                <div key={comment.id} className="platform-surface-card px-5 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-foreground font-semibold truncate">{comment.reviewerName}</div>
                      <div className="text-sm text-muted-foreground truncate">{comment.projectName}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(comment.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {formatDecision(comment.decision)}
                    </span>
                  </div>
                  <div className="text-foreground mt-3 whitespace-pre-wrap">{comment.reviewComment}</div>
                  {comment.reviewJustification ? (
                    <ReviewJustificationSummary justification={comment.reviewJustification} />
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                    <Link
                      href={`/review/${comment.projectId}`}
                      className="font-semibold text-carnival-blue hover:underline"
                    >
                      Open review page
                    </Link>
                    <Link
                      href={`/admin/grants/${comment.projectId}`}
                      className="font-semibold text-carnival-blue hover:underline"
                    >
                      Open admin project
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="platform-surface-card p-8">
            <div className="text-foreground font-semibold text-lg">No reviewer comments yet</div>
            <div className="text-muted-foreground mt-1">
              Comments appear here after reviewers submit project feedback.
            </div>
          </div>
        )
      ) : groupedReviewers && groupedReviewers.length > 0 ? (
        <>
          <div className="text-sm text-muted-foreground">
            Showing reviewers with commented projects{" "}
            <span className="text-foreground font-semibold">({groupedReviewers.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {groupedReviewers.map((reviewer) => (
              <div key={reviewer.reviewerId} className="platform-surface-card p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-foreground font-bold text-xl truncate">{reviewer.reviewerName}</div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {reviewer.projects.length} project{reviewer.projects.length === 1 ? "" : "s"}
                  </div>
                </div>

                {reviewer.projects.length === 0 ? (
                  <div className="text-sm text-muted-foreground mt-4">No projects.</div>
                ) : (
                  <div className="space-y-3 mt-4">
                    {reviewer.projects.map((project) => (
                      <div
                        key={project.projectId}
                        className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-3"
                      >
                        <div className="text-foreground font-semibold truncate">{project.projectName}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                          <Link
                            href={`/review/${project.projectId}`}
                            className="font-semibold text-carnival-blue hover:underline"
                          >
                            Open review page
                          </Link>
                          <Link
                            href={`/admin/grants/${project.projectId}`}
                            className="font-semibold text-carnival-blue hover:underline"
                          >
                            Open admin project
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="platform-surface-card p-8">
          <div className="text-foreground font-semibold text-lg">No reviewer activity yet</div>
          <div className="text-muted-foreground mt-1">
            Reviewers show up here after leaving at least one comment.
          </div>
        </div>
      )}
    </div>
  );
}
