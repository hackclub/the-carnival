import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import ManageProjectClient from "@/components/ManageProjectClient";
import ProjectDevlogsSummary, {
  type DevlogSummary,
} from "@/components/ProjectDevlogsSummary";
import { db } from "@/db";
import { devlog, peerReview, project, user, type ReviewDecision } from "@/db/schema";
import { hydrateReviewJustification } from "@/lib/review-justification";
import { buildCategorySuggestions, buildTagSuggestions } from "@/lib/project-taxonomy";
import { getServerSession } from "@/lib/server-session";

export default async function ManageProjectPage(props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession({ disableCookieCache: true });
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/projects`);
  }

  const { id } = await props.params;

  const rows = await db
    .select({
      id: project.id,
      creatorId: project.creatorId,
      name: project.name,
      description: project.description,
      category: project.category,
      tags: project.tags,
      editor: project.editor,
      editorOther: project.editorOther,
      hackatimeProjectName: project.hackatimeProjectName,
      hackatimeStartedAt: project.hackatimeStartedAt,
      hackatimeStoppedAt: project.hackatimeStoppedAt,
      hackatimeTotalSeconds: project.hackatimeTotalSeconds,
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
      resubmissionBlocked: project.resubmissionBlocked,
      resubmissionBlockedReason: project.resubmissionBlockedReason,
      startedOnCarnivalAt: project.startedOnCarnivalAt,
      submittedAt: project.submittedAt,
      createdAt: project.createdAt,
    })
    .from(project)
    .where(and(eq(project.id, id), eq(project.creatorId, session.user.id)))
    .limit(1);

  const p = rows[0];
  if (!p) notFound();
  const reviewJustificationColumn = (
    peerReview as unknown as { reviewJustification?: typeof peerReview.id }
  ).reviewJustification;

  const reviews = await db
    .select({
      id: peerReview.id,
      decision: peerReview.decision,
      reviewComment: peerReview.reviewComment,
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
    .orderBy(asc(peerReview.createdAt), asc(peerReview.id));

  const taxonomyRows = await db
    .select({
      category: project.category,
      tags: project.tags,
    })
    .from(project);
  const categorySuggestions = buildCategorySuggestions(taxonomyRows.map((row) => row.category));
  const tagSuggestions = buildTagSuggestions(taxonomyRows.map((row) => row.tags));

  const recentDevlogs = await db
    .select({
      id: devlog.id,
      title: devlog.title,
      content: devlog.content,
      createdAt: devlog.createdAt,
      authorName: user.name,
    })
    .from(devlog)
    .leftJoin(user, eq(devlog.userId, user.id))
    .where(eq(devlog.projectId, id))
    .orderBy(desc(devlog.createdAt), asc(devlog.id))
    .limit(3);

  const devlogCountRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(devlog)
    .where(eq(devlog.projectId, id));
  const devlogTotalCount = devlogCountRows[0]?.count ?? 0;

  const devlogSummaries: DevlogSummary[] = recentDevlogs.map((row) => {
    const text = row.content ?? "";
    const excerpt = text.length > 240 ? `${text.slice(0, 240).trimEnd()}…` : text;
    return {
      id: row.id,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      authorName: row.authorName || "Unknown",
      excerpt,
    };
  });

  const canWriteDevlog = p.status !== "granted";

  return (
    <AppShell title="Manage project">
      <div className="mb-6">
        <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to projects
        </Link>
      </div>

      <div className="mb-6">
        <ProjectDevlogsSummary
          projectId={p.id}
          devlogs={devlogSummaries}
          totalCount={devlogTotalCount}
          canWrite={canWriteDevlog}
          projectStartedAtIso={(p.startedOnCarnivalAt ?? p.createdAt).toISOString()}
          submittedAtIso={p.submittedAt ? p.submittedAt.toISOString() : null}
        />
      </div>

      <ManageProjectClient
        initial={{
          id: p.id,
          name: p.name,
          description: p.description,
          category: p.category,
          tags: p.tags ?? [],
          editor: p.editor,
          editorOther: p.editorOther ?? "",
          hackatimeProjectName: p.hackatimeProjectName,
          hackatimeStartedAt: p.hackatimeStartedAt ? p.hackatimeStartedAt.toISOString() : null,
          hackatimeStoppedAt: p.hackatimeStoppedAt ? p.hackatimeStoppedAt.toISOString() : null,
          hackatimeTotalSeconds: p.hackatimeTotalSeconds ?? null,
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
          resubmissionBlocked: p.resubmissionBlocked,
          resubmissionBlockedReason: p.resubmissionBlockedReason ?? null,
          reviews: reviews.map((r) => ({
            id: r.id,
            decision: r.decision,
            reviewComment: r.reviewComment,
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
        }}
        categorySuggestions={categorySuggestions}
        tagSuggestions={tagSuggestions}
      />
    </AppShell>
  );
}
