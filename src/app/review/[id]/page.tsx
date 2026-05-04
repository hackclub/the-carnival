import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import type { ReviewDevlogFull } from "@/components/DevlogAssessmentPanel";
import ReviewHackatimeTools from "@/components/ReviewHackatimeTools";
import ReviewProjectClient from "@/components/ReviewProjectClient";
import { db } from "@/db";
import {
  bountyProject,
  devlog,
  peerReview,
  project,
  projectReviewerAssignment,
  user,
  type ReviewDecision,
  type UserRole,
} from "@/db/schema";
import { hydrateReviewJustification } from "@/lib/review-justification";
import { getServerSession } from "@/lib/server-session";

function canReview(role: unknown): role is Extract<UserRole, "reviewer" | "admin"> {
  return role === "reviewer" || role === "admin";
}

export default async function ReviewProjectPage(props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession({ disableCookieCache: true });
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/review`);
  }

  const role = (session.user as { role?: unknown } | undefined)?.role;
  if (!canReview(role)) {
    redirect("/projects");
  }
  const isAdmin = role === "admin";

  const { id } = await props.params;

  const projectRows = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      editor: project.editor,
      editorOther: project.editorOther,
      hackatimeProjectName: project.hackatimeProjectName,
      hackatimeStartedAt: project.hackatimeStartedAt,
      hackatimeStoppedAt: project.hackatimeStoppedAt,
      hackatimeTotalSeconds: project.hackatimeTotalSeconds,
      hoursSpentSeconds: project.hoursSpentSeconds,
      videoUrl: project.videoUrl,
      playableDemoUrl: project.playableDemoUrl,
      codeUrl: project.codeUrl,
      screenshots: project.screenshots,
      submissionChecklist: project.submissionChecklist,
      creatorDeclaredOriginality: project.creatorDeclaredOriginality,
      creatorDuplicateExplanation: project.creatorDuplicateExplanation,
      creatorOriginalityRationale: project.creatorOriginalityRationale,
      status: project.status,
      approvedHours: project.approvedHours,
      createdAt: project.createdAt,
      submittedAt: project.submittedAt,
      startedOnCarnivalAt: project.startedOnCarnivalAt,
      updatedAt: project.updatedAt,
      creatorId: project.creatorId,
      bountyProjectId: project.bountyProjectId,
      bountyProjectName: bountyProject.name,
      creatorName: user.name,
      creatorEmail: user.email,
      creatorHackatimeUserId: user.hackatimeUserId,
    })
    .from(project)
    .leftJoin(user, eq(project.creatorId, user.id))
    .leftJoin(bountyProject, eq(project.bountyProjectId, bountyProject.id))
    .where(eq(project.id, id))
    .limit(1);

  const p = projectRows[0];
  if (!p) notFound();

  const devlogSeconds =
    typeof p.hoursSpentSeconds === "number" && Number.isFinite(p.hoursSpentSeconds)
      ? Math.max(0, Math.floor(p.hoursSpentSeconds))
      : 0;
  const legacySeconds =
    typeof p.hackatimeTotalSeconds === "number" && Number.isFinite(p.hackatimeTotalSeconds)
      ? Math.max(0, Math.floor(p.hackatimeTotalSeconds))
      : 0;
  const totalSeconds = devlogSeconds > 0 ? devlogSeconds : legacySeconds;
  const hackatimeHours = { hours: Math.floor(totalSeconds / 3600), minutes: Math.floor(totalSeconds / 60) % 60 };
  const reviewJustificationColumn = (
    peerReview as unknown as { reviewJustification?: typeof peerReview.id }
  ).reviewJustification;
  type ReviewRow = {
    id: string;
    decision: ReviewDecision;
    reviewComment: string;
    approvedHours: number | null;
    hackatimeSnapshotSeconds: number;
    reviewEvidenceChecklist: unknown;
    reviewedHackatimeRangeStart: Date | null;
    reviewedHackatimeRangeEnd: Date | null;
    hourAdjustmentReasonMetadata: unknown;
    reviewJustification?: unknown;
    createdAt: Date;
    reviewerName: string | null;
    reviewerEmail: string | null;
  };

  const reviews = (await db
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
      ...(reviewJustificationColumn ? { reviewJustification: reviewJustificationColumn } : {}),
      createdAt: peerReview.createdAt,
      reviewerName: user.name,
      reviewerEmail: user.email,
    })
    .from(peerReview)
    .leftJoin(user, eq(peerReview.reviewerId, user.id))
    .where(eq(peerReview.projectId, id))
    .orderBy(asc(peerReview.createdAt), asc(peerReview.id))) as unknown as ReviewRow[];

  const assignments = await db
    .select({
      reviewerId: projectReviewerAssignment.reviewerId,
      reviewerName: user.name,
      reviewerEmail: user.email,
      createdAt: projectReviewerAssignment.createdAt,
    })
    .from(projectReviewerAssignment)
    .leftJoin(user, eq(projectReviewerAssignment.reviewerId, user.id))
    .where(eq(projectReviewerAssignment.projectId, id))
    .orderBy(asc(projectReviewerAssignment.createdAt), asc(projectReviewerAssignment.reviewerId));

  const devlogRows = await db
    .select({
      id: devlog.id,
      title: devlog.title,
      content: devlog.content,
      startedAt: devlog.startedAt,
      endedAt: devlog.endedAt,
      durationSeconds: devlog.durationSeconds,
      attachments: devlog.attachments,
      usedAi: devlog.usedAi,
      aiUsageDescription: devlog.aiUsageDescription,
      hackatimeProjectNameSnapshot: devlog.hackatimeProjectNameSnapshot,
      createdAt: devlog.createdAt,
      authorName: user.name,
    })
    .from(devlog)
    .leftJoin(user, eq(devlog.userId, user.id))
    .where(eq(devlog.projectId, id))
    .orderBy(asc(devlog.startedAt), asc(devlog.id));

  const devlogsForReview: ReviewDevlogFull[] = devlogRows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt.toISOString(),
    durationSeconds: row.durationSeconds ?? 0,
    attachments: row.attachments ?? [],
    usedAi: row.usedAi,
    aiUsageDescription: row.aiUsageDescription ?? null,
    hackatimeProjectNameSnapshot: row.hackatimeProjectNameSnapshot ?? "",
    authorName: row.authorName || "Unknown",
  }));

  return (
    <AppShell title="Review project">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/review" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to review queue
        </Link>
        <Link href={`/projects/${p.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          View in projects
        </Link>
      </div>

      <div className="mb-6">
        <ReviewHackatimeTools
          projectId={p.id}
          hackatimeUserId={
            typeof p.creatorHackatimeUserId === "string" ? p.creatorHackatimeUserId : null
          }
          projectStartedAtIso={p.startedOnCarnivalAt ? p.startedOnCarnivalAt.toISOString() : null}
          submittedAtIso={p.submittedAt ? p.submittedAt.toISOString() : null}
          projectCreatedAtIso={p.createdAt.toISOString()}
        />
      </div>

      <ReviewProjectClient
        initial={{
          isAdmin,
          viewerUserId: session.user.id,
          project: {
            id: p.id,
            name: p.name,
            description: p.description,
            editor: p.editor,
            editorOther: p.editorOther ?? "",
            hackatimeProjectName: p.hackatimeProjectName,
            videoUrl: p.videoUrl,
            playableDemoUrl: p.playableDemoUrl,
            codeUrl: p.codeUrl,
            screenshots: p.screenshots,
            submissionChecklist: p.submissionChecklist ?? null,
            creatorDeclaredOriginality: p.creatorDeclaredOriginality,
            creatorDuplicateExplanation: p.creatorDuplicateExplanation ?? null,
            creatorOriginalityRationale: p.creatorOriginalityRationale ?? null,
            status: p.status,
            approvedHours: p.approvedHours ?? null,
            creatorName: p.creatorName || "Unknown creator",
            creatorEmail: p.creatorEmail || "",
            hackatimeUserId:
              typeof p.creatorHackatimeUserId === "string" ? p.creatorHackatimeUserId : null,
            hackatimeHours: hackatimeHours ? { hours: hackatimeHours.hours, minutes: hackatimeHours.minutes } : null,
            hackatimeStartedAt: p.hackatimeStartedAt ? p.hackatimeStartedAt.toISOString() : null,
            hackatimeStoppedAt: p.hackatimeStoppedAt ? p.hackatimeStoppedAt.toISOString() : null,
            createdAt: p.createdAt.toISOString(),
            submittedAt: p.submittedAt ? p.submittedAt.toISOString() : null,
            bountyProjectId: p.bountyProjectId ?? null,
            bountyProjectName: p.bountyProjectName ?? null,
          },
          reviews: reviews.map((r) => ({
            id: r.id,
            decision: r.decision as ReviewDecision,
            reviewComment: r.reviewComment,
            approvedHours: r.approvedHours ?? null,
            hackatimeSnapshotSeconds: r.hackatimeSnapshotSeconds ?? 0,
            reviewJustification: hydrateReviewJustification({
              decision: r.decision as ReviewDecision,
              fallbackHackatimeProjectName: p.hackatimeProjectName,
              reviewEvidenceChecklist: r.reviewEvidenceChecklist,
              reviewedHackatimeRangeStart: r.reviewedHackatimeRangeStart,
              reviewedHackatimeRangeEnd: r.reviewedHackatimeRangeEnd,
              hourAdjustmentReasonMetadata: r.hourAdjustmentReasonMetadata,
              reviewJustification: (r as { reviewJustification?: unknown }).reviewJustification,
            }),
            createdAt: r.createdAt.toISOString(),
            reviewerName: r.reviewerName || "Unknown reviewer",
            reviewerEmail: r.reviewerEmail || "",
          })),
          assignments: assignments.map((a) => ({
            reviewerId: a.reviewerId,
            reviewerName: a.reviewerName || "Unknown reviewer",
            reviewerEmail: a.reviewerEmail || "",
            createdAt: a.createdAt.toISOString(),
          })),
          devlogs: devlogsForReview,
        }}
      />
    </AppShell>
  );
}
