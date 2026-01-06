import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { peerReview, project, type ProjectStatus, type ReviewDecision, type UserRole } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

type ReviewBody = {
  decision?: unknown;
  comment?: unknown;
};

function canReview(role: unknown): role is Extract<UserRole, "reviewer" | "admin"> {
  return role === "reviewer" || role === "admin";
}

function isDecision(value: unknown): value is ReviewDecision {
  return value === "approved" || value === "rejected" || value === "comment";
}

function toCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nextStatusForDecision(decision: ReviewDecision): ProjectStatus | null {
  if (decision === "approved") return "shipped";
  if (decision === "rejected") return "work-in-progress";
  return null; // comment: keep current status
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canReview(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: projectId } = await ctx.params;

  let body: ReviewBody;
  try {
    body = (await req.json()) as ReviewBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const decision = body.decision;
  if (!isDecision(decision)) {
    return NextResponse.json(
      { error: "Invalid decision. Allowed: approved, rejected, comment" },
      { status: 400 },
    );
  }

  const comment = toCleanString(body.comment);
  if (!comment) {
    return NextResponse.json({ error: "Comment is required" }, { status: 400 });
  }

  const rows = await db
    .select({ id: project.id, status: project.status })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  const p = rows[0];
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only allow review actions when the project is in the review queue.
  if (p.status !== "in-review") {
    return NextResponse.json(
      { error: "Project is not in review" },
      { status: 409 },
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
      decision,
      reviewComment: comment,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: peerReview.id, decision: peerReview.decision, reviewComment: peerReview.reviewComment, createdAt: peerReview.createdAt });

  const statusUpdate = nextStatusForDecision(decision);
  if (statusUpdate) {
    await db
      .update(project)
      .set({ status: statusUpdate, updatedAt: now })
      .where(and(eq(project.id, projectId), eq(project.status, "in-review")));
  }

  return NextResponse.json({
    project: { status: statusUpdate ?? "in-review" },
    review: {
      id: inserted[0]?.id ?? reviewId,
      decision: inserted[0]?.decision ?? decision,
      reviewComment: inserted[0]?.reviewComment ?? comment,
      createdAt: (inserted[0]?.createdAt ?? now).toISOString(),
      reviewerName: (session?.user as { name?: string | null } | undefined)?.name ?? "Reviewer",
      reviewerEmail: (session?.user as { email?: string | null } | undefined)?.email ?? "",
    },
  });
}


