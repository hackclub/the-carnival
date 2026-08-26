import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import AdminProjectNavCard from "@/components/AdminProjectNavCard";
import LinkChip from "@/components/LinkChip";
import ProjectEditorBadge from "@/components/ProjectEditorBadge";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import ReviewJustificationSummary from "@/components/ReviewJustificationSummary";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
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
import { buildJoeFraudUrl } from "@/lib/constants";
import {
  formatConsideredHackatimeRangeLabel,
  getProjectConsideredHackatimeRange,
} from "@/lib/hackatime-range";
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

const REVIEW_DECISION_VARIANT: Record<ReviewDecision, BadgeVariant> = {
  approved: "success",
  rejected: "error",
  // Not "default" — its bg-muted would vanish against the bg-muted card.
  comment: "info",
};

const ASSESSMENT_DECISION_VARIANT: Record<DevlogAssessmentDecision, BadgeVariant> = {
  accepted: "success",
  adjusted: "warning",
  rejected: "error",
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-foreground font-semibold truncate">{children}</div>
    </div>
  );
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
      description: project.description,
      status: project.status,
      editor: project.editor,
      editorOther: project.editorOther,
      hackatimeProjectName: project.hackatimeProjectName,
      hackatimeStartedAt: project.hackatimeStartedAt,
      hackatimeStoppedAt: project.hackatimeStoppedAt,
      hackatimeTotalSeconds: project.hackatimeTotalSeconds,
      hoursSpentSeconds: project.hoursSpentSeconds,
      approvedHours: project.approvedHours,
      codeUrl: project.codeUrl,
      playableDemoUrl: project.playableDemoUrl,
      videoUrl: project.videoUrl,
      screenshots: project.screenshots,
      grantTechnicalJustification: project.grantTechnicalJustification,
      airtableRecordId: project.airtableRecordId,
      airtableRecordIsPreview: project.airtableRecordIsPreview,
      createdAt: project.createdAt,
      submittedAt: project.submittedAt,
      creatorName: user.name,
      creatorEmail: user.email,
      creatorSlackId: user.slackId,
      creatorHackatimeUserId: user.hackatimeUserId,
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
  const acceptedCount = assessmentEntries.filter((e) => e.decision === "accepted").length;
  const adjustedCount = assessmentEntries.filter((e) => e.decision === "adjusted").length;
  const rejectedCount = assessmentEntries.filter((e) => e.decision === "rejected").length;

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

  const consideredRange = getProjectConsideredHackatimeRange({
    hackatimeStartedAt: p.hackatimeStartedAt,
    hackatimeStoppedAt: p.hackatimeStoppedAt,
    submittedAt: p.submittedAt,
    createdAt: p.createdAt,
  });
  const joeFraudUrl =
    p.creatorHackatimeUserId?.trim() && consideredRange
      ? buildJoeFraudUrl(
          p.creatorHackatimeUserId.trim(),
          consideredRange.startDate,
          consideredRange.endDate,
        )
      : null;

  const devlogSeconds = Math.max(0, Math.floor(p.hoursSpentSeconds ?? 0));
  const legacySeconds = Math.max(0, Math.floor(p.hackatimeTotalSeconds ?? 0));
  const loggedSeconds = devlogSeconds > 0 ? devlogSeconds : legacySeconds;

  const screenshots = p.screenshots ?? [];
  const grantJustification = p.grantTechnicalJustification?.trim() || null;
  const passOneDraft = finalReview?.specificTechnicalFeatures?.trim() || null;

  return (
    <AppShell title="Review record">
      <div className="mb-6">
        <Link
          href={`/admin/grants/${encodeURIComponent(p.id)}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to grant page
        </Link>
      </div>

      <div className="space-y-6">
        {/* 1 — What this project is. */}
        <div className="platform-surface-card p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-foreground font-bold text-2xl truncate">{p.name}</div>
              <div className="text-muted-foreground mt-1">
                Frozen review record — what was accepted, what was not, and why.
              </div>
            </div>
            <ProjectStatusBadge status={p.status} />
          </div>

          <div className="text-muted-foreground">{p.description}</div>

          <div className="flex flex-wrap items-center gap-2">
            {p.codeUrl ? <LinkChip label="GitHub" url={p.codeUrl} /> : null}
            {p.playableDemoUrl ? <LinkChip label="Demo / release" url={p.playableDemoUrl} /> : null}
            {p.videoUrl ? <LinkChip label="Video" url={p.videoUrl} /> : null}
            {!p.codeUrl && !p.playableDemoUrl && !p.videoUrl ? (
              <span className="text-sm text-muted-foreground">No project links submitted.</span>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Creator">
              {p.creatorName || "Unknown"}
              {p.creatorEmail ? (
                <span className="block text-xs font-normal text-muted-foreground font-mono truncate">
                  {p.creatorEmail}
                </span>
              ) : null}
            </Fact>
            <Fact label="Editor">
              <ProjectEditorBadge editor={p.editor} editorOther={p.editorOther ?? ""} />
            </Fact>
            <Fact label="Hackatime project">
              <span className="font-mono">{p.hackatimeProjectName || "—"}</span>
            </Fact>
            <Fact label="Hours logged">{formatSeconds(loggedSeconds)}</Fact>
            <Fact label="Approved hours">
              {p.approvedHours !== null && p.approvedHours !== undefined
                ? `${p.approvedHours}h`
                : "—"}
            </Fact>
            <Fact label="Considered Hackatime range">
              {formatConsideredHackatimeRangeLabel(consideredRange)}
            </Fact>
            <Fact label="Submitted">{formatDateTime(p.submittedAt)}</Fact>
            <Fact label="Airtable record">
              <span className="font-mono">{p.airtableRecordId || "—"}</span>
              {p.airtableRecordId && p.airtableRecordIsPreview ? (
                <span className="block text-xs font-normal text-amber-700">preview</span>
              ) : null}
            </Fact>
            <Fact label="Slack">
              <span className="font-mono">{p.creatorSlackId || "—"}</span>
            </Fact>
          </div>

          {screenshots.length > 0 ? (
            <div className="space-y-2">
              <div className="text-foreground font-semibold">Screenshots</div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {screenshots.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer noopener">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="w-full rounded-[var(--radius-2xl)] border border-border object-cover bg-muted hover:opacity-90 transition-opacity"
                      referrerPolicy="no-referrer"
                    />
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* 2 — Where else an admin can go from here. */}
        <AdminProjectNavCard projectId={p.id} current="record" joeFraudUrl={joeFraudUrl} />

        {/* 3 — The decision that granted the project. */}
        <div className="platform-surface-card p-6 space-y-4">
          <div>
            <div className="text-foreground font-semibold text-lg">Final review</div>
            <div className="text-sm text-muted-foreground mt-1">
              The approving review that determined this project&apos;s acceptance, with the
              per-devlog decisions behind its approved hours.
            </div>
          </div>

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
                    <Badge
                      variant={REVIEW_DECISION_VARIANT[finalReview.decision]}
                      className="uppercase"
                    >
                      {finalReview.decision}
                    </Badge>
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-foreground font-semibold">Devlog decisions</div>
                  {assessmentEntries.length > 0 ? (
                    <div className="text-sm text-muted-foreground">
                      {acceptedCount} accepted • {adjustedCount} adjusted • {rejectedCount} rejected
                      {" — "}
                      <span className="text-foreground font-semibold">
                        {formatSeconds(totalCountedSeconds)}
                      </span>{" "}
                      counted of {formatSeconds(totalLoggedSeconds)} logged
                    </div>
                  ) : null}
                </div>

                {assessmentEntries.length === 0 ? (
                  <div className="text-muted-foreground mt-2">
                    This review has no per-devlog assessments (it predates the per-devlog review
                    flow).
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
                          <Badge
                            variant={ASSESSMENT_DECISION_VARIANT[entry.decision]}
                            className="uppercase"
                          >
                            {entry.decision}
                          </Badge>
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
                            {/* Sentence case, not uppercase: these labels are full
                                phrases and read far better unshouted. */}
                            {entry.deflationReasons.map((reason) => (
                              <Badge key={reason} variant="error">
                                {reason}
                              </Badge>
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

        {/* 4 — The written rationale that justifies the approved hours. */}
        <div className="platform-surface-card p-6 space-y-3">
          <div>
            <div className="text-foreground font-semibold text-lg">
              Specific technical features (hours justification)
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              The human-written justification sent to the Unified Database. Read-only here — edit it
              on the{" "}
              <Link
                href={`/admin/grants/${encodeURIComponent(p.id)}`}
                className="font-semibold text-carnival-blue hover:underline"
              >
                grant page
              </Link>
              . Never shown to the creator.
            </div>
          </div>

          {grantJustification ? (
            <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Final justification
              </div>
              <div className="text-foreground mt-2 whitespace-pre-wrap">{grantJustification}</div>
            </div>
          ) : (
            <div className="text-muted-foreground">
              No justification saved yet — the grant is blocked until an admin writes one.
            </div>
          )}

          {passOneDraft && passOneDraft !== grantJustification ? (
            <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Pass-1 reviewer draft
              </div>
              <div className="text-muted-foreground mt-2 whitespace-pre-wrap">{passOneDraft}</div>
            </div>
          ) : null}
        </div>

        {/* 5 — The whole conversation, oldest first. */}
        <div className="platform-surface-card p-6 space-y-4">
          <div>
            <div className="text-foreground font-semibold text-lg">Review comments over time</div>
            <div className="text-sm text-muted-foreground mt-1">
              Every review left on this project, oldest first — including the rejections that sent
              it back.
            </div>
          </div>

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
                      <Badge variant={REVIEW_DECISION_VARIANT[r.decision]} className="uppercase">
                        {r.decision}
                      </Badge>
                      {r.approvedHours !== null && r.approvedHours !== undefined ? (
                        <span className="text-xs font-semibold text-foreground">
                          {r.approvedHours}h approved
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {r.rejectionCategory ? (
                    <div className="mt-2 text-xs font-semibold text-red-700">
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
