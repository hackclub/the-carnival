import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { project, projectReviewerAssignment, user, type UserRole } from "@/db/schema";
import { appendReviewAudit } from "@/lib/review-audit";
import { getServerSession } from "@/lib/server-session";

type AssignmentRow = {
  reviewerId: string;
  reviewerName: string;
  reviewerEmail: string;
  createdAt: string;
};

function canReview(role: unknown): role is Extract<UserRole, "reviewer" | "admin"> {
  return role === "reviewer" || role === "admin";
}

class ReviewAssignmentError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function listAssignments(
  projectId: string,
  selectDb: Pick<typeof db, "select"> = db,
): Promise<AssignmentRow[]> {
  const rows = await selectDb
    .select({
      reviewerId: projectReviewerAssignment.reviewerId,
      reviewerName: user.name,
      reviewerEmail: user.email,
      createdAt: projectReviewerAssignment.createdAt,
    })
    .from(projectReviewerAssignment)
    .leftJoin(user, eq(projectReviewerAssignment.reviewerId, user.id))
    .where(eq(projectReviewerAssignment.projectId, projectId))
    .orderBy(asc(projectReviewerAssignment.createdAt), asc(projectReviewerAssignment.reviewerId));

  return rows.map((row) => ({
    reviewerId: row.reviewerId,
    reviewerName: row.reviewerName || "Unknown reviewer",
    reviewerEmail: row.reviewerEmail || "",
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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
  const now = new Date();

  const result = await db
    .transaction(async (tx) => {
      const projectRows = await tx
        .select({ id: project.id, status: project.status })
        .from(project)
        .where(eq(project.id, projectId))
        .limit(1);
      const current = projectRows[0];
      if (!current) {
        throw new ReviewAssignmentError("Not found", 404);
      }
      if (current.status !== "in-review") {
        throw new ReviewAssignmentError("Project is no longer in review", 409);
      }

      const inserted = await tx
        .insert(projectReviewerAssignment)
        .values({
          id: randomUUID(),
          projectId,
          reviewerId: userId,
          createdAt: now,
        })
        .onConflictDoNothing({
          target: [projectReviewerAssignment.projectId, projectReviewerAssignment.reviewerId],
        })
        .returning({ id: projectReviewerAssignment.id });

      if (inserted.length > 0) {
        await appendReviewAudit(
          {
            projectId,
            actorId: userId,
            actorRole: role,
            action: "review_assignment_added",
            details: { reviewerId: userId },
            at: now,
          },
          tx,
        );
      }

      const assignments = await listAssignments(projectId, tx);
      return { assignments };
    })
    .catch((error: unknown) => {
      if (error instanceof ReviewAssignmentError) {
        return { handledError: error };
      }
      throw error;
    });

  if ("handledError" in result) {
    return NextResponse.json({ error: result.handledError.message }, { status: result.handledError.status });
  }

  return NextResponse.json({
    assigned: true,
    assignments: result.assignments,
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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
  const now = new Date();

  const result = await db
    .transaction(async (tx) => {
      const projectRows = await tx
        .select({ id: project.id, status: project.status })
        .from(project)
        .where(eq(project.id, projectId))
        .limit(1);
      const current = projectRows[0];
      if (!current) {
        throw new ReviewAssignmentError("Not found", 404);
      }
      if (current.status !== "in-review") {
        throw new ReviewAssignmentError("Project is no longer in review", 409);
      }

      const removed = await tx
        .delete(projectReviewerAssignment)
        .where(
          and(
            eq(projectReviewerAssignment.projectId, projectId),
            eq(projectReviewerAssignment.reviewerId, userId),
          ),
        )
        .returning({ id: projectReviewerAssignment.id });

      if (removed.length > 0) {
        await appendReviewAudit(
          {
            projectId,
            actorId: userId,
            actorRole: role,
            action: "review_assignment_removed",
            details: { reviewerId: userId },
            at: now,
          },
          tx,
        );
      }

      const assignments = await listAssignments(projectId, tx);
      return { assignments };
    })
    .catch((error: unknown) => {
      if (error instanceof ReviewAssignmentError) {
        return { handledError: error };
      }
      throw error;
    });

  if ("handledError" in result) {
    return NextResponse.json({ error: result.handledError.message }, { status: result.handledError.status });
  }

  return NextResponse.json({
    assigned: false,
    assignments: result.assignments,
  });
}
