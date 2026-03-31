import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { peerReview } from "@/db/schema";
import { appendReviewAudit } from "@/lib/review-audit";
import { getServerSession } from "@/lib/server-session";

function isAdmin(role: unknown): role is "admin" {
  return role === "admin";
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  const actorId = session?.user?.id;
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const deleted = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: peerReview.id, projectId: peerReview.projectId, decision: peerReview.decision })
      .from(peerReview)
      .where(eq(peerReview.id, id))
      .limit(1);
    const review = rows[0];
    if (!review) return null;

    await tx.delete(peerReview).where(eq(peerReview.id, id));
    await appendReviewAudit(
      {
        projectId: review.projectId,
        reviewId: review.id,
        actorId,
        actorRole: "admin",
        action: "review_comment_deleted",
        details: { deletedDecision: review.decision },
      },
      tx,
    );
    return review.id;
  });

  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

