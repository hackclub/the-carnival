import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import ReviewJustificationSummary from "@/components/ReviewJustificationSummary";
import { db } from "@/db";
import {
  devlog,
  peerReview,
  peerReviewDevlogAssessment,
  project,
  user,
  type DevlogAssessmentDecision,
  type ReviewDecision,
} from "@/db/schema";
import { hydrateReviewJustification } from "@/lib/review-justification";
import { REVIEW_DEFLATION_REASON_OPTIONS } from "@/lib/review-rules";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const DEFLATION_REASON_LABELS = new Map<string, string>(
  REVIEW_DEFLATION_REASON_OPTIONS.map((option) => [option.key, option.label]),
);

function formatSeconds(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor(safe / 60) % 60;
  return `${hours}h ${minutes}m`;
}

function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

function reviewDecisionBadgeClass(decision: ReviewDecision): string {
  if (decision === "approved") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (decision === "rejected") return "bg-rose-500/15 text-rose-300 border-rose-500/30";
  return "bg-gray-500/15 text-gray-300 border-gray-500/30";
}

function assessmentDecisionBadgeClass(decision: DevlogAssessmentDecision): string {
  if (decision === "accepted") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (decision === "rejected") return "bg-rose-500/15 text-rose-300 border-rose-500/30";
  return "bg-amber-500/15 text-amber-300 border-amber-500/30";
}

export default async function AdminGrantReviewsPage(props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession({ disableCookieCache: true });
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/grants");
  if (role !== "admin") redirect("/projects");

  const { id } = await props.params;

  const projectRows = await db
    .select({
      id: project.id,
      name: project.name,
      status: project.status,
      hackatimeProjectName: project.hackatimeProjectName,
      approvedHours: project.approvedHours,
      creatorName: user.name,
      creatorEmail: user.email,
    })
    .from(project)
    .leftJoin(user, eq(project.creatorId, user.id))
    .where(eq(project.id, id))
    .limit(1);

  const p = projectRows[0];
  if (!p) notFound();

  const reviews = await db
    .select({
      id: peerReview.id,
      decision: peerReview.decision,
      reviewComment: peerReview.reviewComment,
      approvedHours: peerReview.approvedHours,
      hackatimeSnapshotSeconds: peerReview.hackatimeSnapshotSeconds,
      reviewEvidenceChecklist: peerReview.reviewEvidenceChecklist,
      reviewedHackatimeRangeStart: peerReview.reviewedHackatimeRangeStart,
      reviewedHackatimeRangeEnd: peerReview.reviewedHackatimeRangeEnd,
      hourAdjustmentReasonMetadata: peerReview.hourAdjustmentReasonMetadata,
      specificTechnicalFeatures: peerReview.specificTechnicalFeatures,
      rejectionCategory: peerReview.rejectionCategory,
      createdAt: peerReview.createdAt,
      reviewerName: user.name,
      reviewerEmail: user.email,
    })
    .from(peerReview)
    .leftJoin(user, eq(peerReview.reviewerId, user.id))
    .where(eq(peerReview.projectId, p.id))
    .orderBy(asc(peerReview.createdAt), asc(peerReview.id));

  // The review that determined the accept/grant: the latest approved one.
  const finalReview = [...reviews].reverse().find((r) => r.decision === "approved") ?? null;

  const assessments = finalReview
    ? await db
        .select({
          id: peerReviewDevlogAssessment.id,
          devlogId: peerReviewDevlogAssessment.devlogId,
          decision: peerReviewDevlogAssessment.decision,
          adjustedSeconds: peerReviewDevlogAssessment.adjustedSeconds,
          deflationReasons: peerReviewDevlogAssessment.deflationReasons,
          reviewedStartedAt: peerReviewDevlogAssessment.reviewedStartedAt,
          reviewedEndedAt: peerReviewDevlogAssessment.reviewedEndedAt,
          reviewedWindowSeconds: peerReviewDevlogAssessment.reviewedWindowSeconds,
          comment: peerReviewDevlogAssessment.comment,
          titleSnapshot: peerReviewDevlogAssessment.devlogTitleSnapshot,
          durationSecondsSnapshot: peerReviewDevlogAssessment.devlogDurationSecondsSnapshot,
          startedAtSnapshot: peerReviewDevlogAssessment.devlogStartedAtSnapshot,
          endedAtSnapshot: peerReviewDevlogAssessment.devlogEndedAtSnapshot,
          liveTitle: devlog.title,
          liveDurationSeconds: devlog.durationSeconds,
          liveStartedAt: devlog.startedAt,
          liveEndedAt: devlog.endedAt,
        })
        .from(peerReviewDevlogAssessment)
        .leftJoin(devlog, eq(peerReviewDevlogAssessment.devlogId, devlog.id))
        .where(eq(peerReviewDevlogAssessment.reviewId, finalReview.id))
        .orderBy(
          asc(peerReviewDevlogAssessment.devlogStartedAtSnapshot),
          asc(devlog.startedAt),
          asc(peerReviewDevlogAssessment.createdAt),
        )
    : [];

  // Frozen view: prefer the snapshot captured at review time; fall back to the
  // live devlog only for rows created before snapshots existed.
  const assessmentEntries = assessments.map((a) => {
    const loggedSeconds = Math.max(
      0,
      Math.floor(a.durationSecondsSnapshot ?? a.liveDurationSeconds ?? 0),
    );
    const countedSeconds =
      a.decision === "accepted"
        ? loggedSeconds
        : a.decision === "rejected"
          ? 0
          : Math.max(0, Math.floor(a.adjustedSeconds ?? 0));
    return {
      id: a.id,
      devlogId: a.devlogId,
      title: a.titleSnapshot ?? a.liveTitle ?? "Deleted devlog",
      startedAt: a.startedAtSnapshot ?? a.liveStartedAt,
      endedAt: a.endedAtSnapshot ?? a.liveEndedAt,
      decision: a.decision,
      loggedSeconds,
      countedSeconds,
      reviewedStartedAt: a.reviewedStartedAt,
      reviewedEndedAt: a.reviewedEndedAt,
      reviewedWindowSeconds: a.reviewedWindowSeconds,
      deflationReasons: (Array.isArray(a.deflationReasons) ? a.deflationReasons : []).map(
        (key) => DEFLATION_REASON_LABELS.get(key) ?? key,
      ),
      note: a.comment?.trim() || null,
    };
  });

  const totalLoggedSeconds = assessmentEntries.reduce((acc, e) => acc + e.loggedSeconds, 0);
  const totalCountedSeconds = assessmentEntries.reduce((acc, e) => acc + e.countedSeconds, 0);

  const finalJustification = finalReview
    ? hydrateReviewJustification({
        decision: finalReview.decision as ReviewDecision,
        fallbackHackatimeProjectName: p.hackatimeProjectName,
        reviewEvidenceChecklist: finalReview.reviewEvidenceChecklist,
        reviewedHackatimeRangeStart: finalReview.reviewedHackatimeRangeStart,
        reviewedHackatimeRangeEnd: finalReview.reviewedHackatimeRangeEnd,
        hourAdjustmentReasonMetadata: finalReview.hourAdjustmentReasonMetadata,
      })
    : null;

  return (
    <AppShell title="Review details">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link
          href={`/admin/grants/${encodeURIComponent(p.id)}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to grant page
        </Link>
        <ProjectStatusBadge status={p.status} />
      </div>

      <div className="space-y-6">
        <div className="platform-surface-card p-6">
          <div className="text-foreground font-bold text-2xl">{p.name}</div>
          <div className="text-muted-foreground mt-1">
            Frozen review record: the final review that determined this project&apos;s
            acceptance, with each devlog&apos;s decision and deflation, plus every review
            comment over time.
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            Creator: <span className="text-foreground">{p.creatorName || "Unknown"}</span>
            {p.creatorEmail ? ` • ${p.creatorEmail}` : ""}
          </div>
        </div>

        <div className="platform-surface-card p-6 space-y-4">
          <div className="text-foreground font-semibold text-lg">Final review</div>

          {!finalReview ? (
            <div className="text-muted-foreground">
              No approving review yet — this project has not been accepted.
            </div>
          ) : (
            <>
              <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-foreground font-semibold truncate">
                      {finalReview.reviewerName || "Unknown reviewer"}
                      {finalReview.reviewerEmail ? ` • ${finalReview.reviewerEmail}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(finalReview.createdAt)} UTC
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${reviewDecisionBadgeClass(finalReview.decision)}`}
                    >
                      {finalReview.decision}
                    </span>
                    {finalReview.approvedHours !== null &&
                    finalReview.approvedHours !== undefined ? (
                      <span className="text-xs font-semibold text-foreground">
                        {finalReview.approvedHours}h approved
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="text-foreground mt-3 whitespace-pre-wrap">
                  {finalReview.reviewComment}
                </div>
                {finalJustification ? (
                  <ReviewJustificationSummary justification={finalJustification} />
                ) : null}
              </div>

              <div>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-foreground font-semibold">Devlog decisions</div>
                  {assessmentEntries.length > 0 ? (
                    <div className="text-sm text-muted-foreground">
                      Logged{" "}
                      <span className="text-foreground font-semibold">
                        {formatSeconds(totalLoggedSeconds)}
                      </span>{" "}
                      • Counted{" "}
                      <span className="text-foreground font-semibold">
                        {formatSeconds(totalCountedSeconds)}
                      </span>
                    </div>
                  ) : null}
                </div>

                {assessmentEntries.length === 0 ? (
                  <div className="text-muted-foreground mt-2">
                    This review has no per-devlog assessments (it predates the per-devlog
                    review flow).
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {assessmentEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-foreground font-semibold truncate">
                              {entry.devlogId ? (
                                <Link
                                  href={`/projects/${encodeURIComponent(p.id)}/devlogs/${encodeURIComponent(entry.devlogId)}`}
                                  className="hover:underline"
                                >
                                  {entry.title}
                                </Link>
                              ) : (
                                <>
                                  {entry.title}{" "}
                                  <span className="text-xs font-normal text-muted-foreground">
                                    (devlog since deleted)
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {formatDateTime(entry.startedAt)} → {formatDateTime(entry.endedAt)}{" "}
                              UTC
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${assessmentDecisionBadgeClass(entry.decision)}`}
                          >
                            {entry.decision}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                          <div>
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Logged
                            </div>
                            <div className="text-sm text-foreground font-semibold">
                              {formatSeconds(entry.loggedSeconds)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Counted
                            </div>
                            <div className="text-sm text-foreground font-semibold">
                              {formatSeconds(entry.countedSeconds)}
                            </div>
                          </div>
                          {entry.reviewedStartedAt && entry.reviewedEndedAt ? (
                            <div className="col-span-2 sm:col-span-1">
                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Reviewed window (trimmed)
                              </div>
                              <div className="text-sm text-foreground font-semibold">
                                {formatDateTime(entry.reviewedStartedAt)} →{" "}
                                {formatDateTime(entry.reviewedEndedAt)}
                                {typeof entry.reviewedWindowSeconds === "number"
                                  ? ` (${formatSeconds(entry.reviewedWindowSeconds)})`
                                  : ""}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        {entry.deflationReasons.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {entry.deflationReasons.map((reason) => (
                              <span
                                key={reason}
                                className="inline-flex rounded-full bg-carnival-red/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-200"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {entry.note ? (
                          <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                            {entry.note}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="platform-surface-card p-6 space-y-4">
          <div className="text-foreground font-semibold text-lg">Review comments over time</div>

          {reviews.length === 0 ? (
            <div className="text-muted-foreground">No reviews yet.</div>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-foreground font-semibold truncate">
                        {r.reviewerName || "Unknown reviewer"}
                        {r.reviewerEmail ? ` • ${r.reviewerEmail}` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(r.createdAt)} UTC
                        {finalReview && r.id === finalReview.id ? " • final review" : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${reviewDecisionBadgeClass(r.decision)}`}
                      >
                        {r.decision}
                      </span>
                      {r.approvedHours !== null && r.approvedHours !== undefined ? (
                        <span className="text-xs font-semibold text-foreground">
                          {r.approvedHours}h approved
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {r.rejectionCategory ? (
                    <div className="mt-2 text-xs uppercase tracking-wide text-red-200">
                      Rejection category: {r.rejectionCategory}
                    </div>
                  ) : null}
                  <div className="text-foreground mt-3 whitespace-pre-wrap">{r.reviewComment}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
