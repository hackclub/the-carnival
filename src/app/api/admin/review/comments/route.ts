import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { peerReview, project, user, type ReviewDecision } from "@/db/schema";
import { getAuthUser } from "@/lib/api-utils";

type CommentViewMode = "flat" | "grouped";

type ReviewerCommentRow = {
  id: string;
  reviewerId: string;
  reviewerName: string | null;
  projectId: string;
  projectName: string | null;
  decision: ReviewDecision;
  reviewComment: string;
  createdAt: Date;
};

function parseViewMode(req: Request): CommentViewMode {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("mode") ?? searchParams.get("view");
  if (mode === "grouped") return "grouped";

  const groupBy = searchParams.get("groupBy");
  if (groupBy === "reviewer") return "grouped";

  const grouped = searchParams.get("grouped");
  if (grouped === "1" || grouped === "true") return "grouped";

  return "flat";
}

function toDisplayName(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function mapFlatComment(row: ReviewerCommentRow) {
  return {
    id: row.id,
    reviewerId: row.reviewerId,
    reviewerName: toDisplayName(row.reviewerName, "Unknown reviewer"),
    projectId: row.projectId,
    projectName: toDisplayName(row.projectName, "Unknown project"),
    decision: row.decision,
    reviewComment: row.reviewComment,
    createdAt: row.createdAt.toISOString(),
  };
}

function buildGroupedByReviewer(rows: ReviewerCommentRow[]) {
  const byReviewer = new Map<
    string,
    {
      reviewerId: string;
      reviewerName: string;
      projects: Map<string, { projectId: string; projectName: string }>;
    }
  >();

  for (const row of rows) {
    const reviewerName = toDisplayName(row.reviewerName, "Unknown reviewer");
    const projectName = toDisplayName(row.projectName, "Unknown project");

    let reviewer = byReviewer.get(row.reviewerId);
    if (!reviewer) {
      reviewer = {
        reviewerId: row.reviewerId,
        reviewerName,
        projects: new Map(),
      };
      byReviewer.set(row.reviewerId, reviewer);
    }

    if (!reviewer.projects.has(row.projectId)) {
      reviewer.projects.set(row.projectId, { projectId: row.projectId, projectName });
    }
  }

  return Array.from(byReviewer.values()).map((reviewer) => ({
    reviewerId: reviewer.reviewerId,
    reviewerName: reviewer.reviewerName,
    projects: Array.from(reviewer.projects.values()),
  }));
}

export async function GET(req: Request) {
  const currentUser = await getAuthUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!currentUser.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const mode = parseViewMode(req);

  const rows: ReviewerCommentRow[] = await db
    .select({
      id: peerReview.id,
      reviewerId: peerReview.reviewerId,
      reviewerName: user.name,
      projectId: peerReview.projectId,
      projectName: project.name,
      decision: peerReview.decision,
      reviewComment: peerReview.reviewComment,
      createdAt: peerReview.createdAt,
    })
    .from(peerReview)
    .leftJoin(user, eq(peerReview.reviewerId, user.id))
    .leftJoin(project, eq(peerReview.projectId, project.id))
    .orderBy(desc(peerReview.createdAt));

  if (mode === "grouped") {
    return NextResponse.json({
      mode,
      reviewers: buildGroupedByReviewer(rows),
    });
  }

  return NextResponse.json({
    mode: "flat" as const,
    comments: rows.map(mapFlatComment),
  });
}
