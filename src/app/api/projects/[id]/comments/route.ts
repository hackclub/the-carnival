import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { peerReview, project } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

type CommentBody = {
  comment?: unknown;
};

function toCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * POST /api/projects/[id]/comments
 * Allows project owners to comment on their own project when it's in review.
 * Unlike reviewer comments, owner comments are always "comment" decision (no approve/reject).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await ctx.params;

  let body: CommentBody;
  try {
    body = (await req.json()) as CommentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const comment = toCleanString(body.comment);
  if (!comment) {
    return NextResponse.json({ error: "Comment is required" }, { status: 400 });
  }

  // Verify the user owns this project and it's in review
  const rows = await db
    .select({ id: project.id, status: project.status, creatorId: project.creatorId })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);

  const p = rows[0];
  if (!p) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (p.creatorId !== userId) {
    return NextResponse.json({ error: "You can only comment on your own projects" }, { status: 403 });
  }

  if (p.status !== "in-review") {
    return NextResponse.json(
      { error: "You can only comment when your project is in review" },
      { status: 409 }
    );
  }

  const now = new Date();
  const reviewId = randomUUID();

  const inserted = await db
    .insert(peerReview)
    .values({
      id: reviewId,
      projectId,
      reviewerId: userId,
      decision: "comment", // Owner comments are always just comments
      reviewComment: comment,
      createdAt: now,
      updatedAt: now,
    })
    .returning({
      id: peerReview.id,
      decision: peerReview.decision,
      reviewComment: peerReview.reviewComment,
      createdAt: peerReview.createdAt,
    });

  return NextResponse.json({
    review: {
      id: inserted[0]?.id ?? reviewId,
      decision: inserted[0]?.decision ?? "comment",
      reviewComment: inserted[0]?.reviewComment ?? comment,
      createdAt: (inserted[0]?.createdAt ?? now).toISOString(),
      reviewerName: (session?.user as { name?: string | null } | undefined)?.name ?? "Owner",
      reviewerEmail: (session?.user as { email?: string | null } | undefined)?.email ?? "",
    },
  });
}

