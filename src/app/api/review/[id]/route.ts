import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  peerReview,
  project,
  projectReviewerAssignment,
  user,
  type ProjectStatus,
  type ReviewDecision,
  type UserRole,
} from "@/db/schema";
import { getServerSession } from "@/lib/server-session";
import { sendReviewEmail } from "@/lib/loops";
import { appendReviewAudit } from "@/lib/review-audit";
import {
  approvedHoursWithinSnapshot,
  isHalfHourIncrement,
  normalizeSnapshotSeconds,
  validateRequiredReviewJustification,
  type ReviewJustificationPayload,
} from "@/lib/review-rules";
import { notifyReviewDM } from "@/lib/slack";

type ReviewBody = {
  decision?: unknown;
  comment?: unknown;
  approvedHours?: unknown;
  reviewJustification?: unknown;
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

class ReviewSubmitError extends Error {
  code: "not_found" | "stale" | "validation";
  status: number;

  constructor(code: "not_found" | "stale" | "validation", message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
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

  const approvedHoursRaw = body.approvedHours;
  const approvedHours =
    approvedHoursRaw === null || approvedHoursRaw === undefined
      ? null
      : typeof approvedHoursRaw === "number"
        ? approvedHoursRaw
        : typeof approvedHoursRaw === "string"
          ? Number(approvedHoursRaw)
          : NaN;

  if (decision === "approved") {
    if (!Number.isFinite(approvedHours)) {
      return NextResponse.json(
        { error: "Approved hours is required when approving" },
        { status: 400 },
      );
    }
    if (approvedHours! <= 0) {
      return NextResponse.json(
        { error: "Approved hours must be greater than 0" },
        { status: 400 },
      );
    }
    if (!isHalfHourIncrement(approvedHours!)) {
      return NextResponse.json(
        { error: "Approved hours must be in 0.5-hour increments" },
        { status: 400 },
      );
    }
  }

  const now = new Date();
  const reviewId = randomUUID();
  const statusUpdate = nextStatusForDecision(decision);
  const reviewJustificationColumn = (
    peerReview as unknown as { reviewJustification?: typeof peerReview.id }
  ).reviewJustification;
  const hasReviewJustificationColumn = Boolean(reviewJustificationColumn);

  const txResult = await db
    .transaction(async (tx) => {
      const rows = await tx
        .select({
          id: project.id,
          name: project.name,
          hackatimeProjectName: project.hackatimeProjectName,
          status: project.status,
          creatorId: project.creatorId,
          hackatimeTotalSeconds: project.hackatimeTotalSeconds,
        })
        .from(project)
        .where(eq(project.id, projectId))
        .limit(1);

      const current = rows[0];
      if (!current) {
        throw new ReviewSubmitError("not_found", "Not found", 404);
      }
      if (current.status !== "in-review") {
        throw new ReviewSubmitError("stale", "Project is no longer in review", 409);
      }

      const hackatimeSnapshotSeconds = normalizeSnapshotSeconds(current.hackatimeTotalSeconds ?? null);
      if (decision === "approved") {
        if (!approvedHoursWithinSnapshot(approvedHours as number, hackatimeSnapshotSeconds)) {
          throw new ReviewSubmitError(
            "validation",
            "Approved hours cannot exceed captured Hackatime at review time",
            400,
          );
        }
      }

      const normalizedReviewJustification =
        decision === "comment"
          ? null
          : (() => {
              const validated = validateRequiredReviewJustification({
                value: body.reviewJustification,
                decision,
                expectedHackatimeProjectName: current.hackatimeProjectName,
                approvedHours: decision === "approved" ? (approvedHours as number) : null,
                loggedHackatimeHours: hackatimeSnapshotSeconds / 3600,
              });
              if (!validated.ok) {
                throw new ReviewSubmitError("validation", validated.error, 400);
              }
              return validated.value;
            })();

      const reviewInsertValues: Record<string, unknown> = {
        id: reviewId,
        projectId,
        reviewerId: userId,
        decision,
        reviewComment: comment,
        approvedHours: decision === "approved" ? (approvedHours as number) : null,
        hackatimeSnapshotSeconds,
        createdAt: now,
        updatedAt: now,
      };
      if (hasReviewJustificationColumn) {
        reviewInsertValues.reviewJustification = normalizedReviewJustification;
      }

      const inserted = (await tx
        .insert(peerReview)
        .values(reviewInsertValues as typeof peerReview.$inferInsert)
        .returning({
          id: peerReview.id,
          decision: peerReview.decision,
          reviewComment: peerReview.reviewComment,
          approvedHours: peerReview.approvedHours,
          hackatimeSnapshotSeconds: peerReview.hackatimeSnapshotSeconds,
          createdAt: peerReview.createdAt,
          ...(hasReviewJustificationColumn && reviewJustificationColumn
            ? { reviewJustification: reviewJustificationColumn }
            : {}),
        } as any)) as Array<{
        id: string;
        decision: ReviewDecision;
        reviewComment: string;
        approvedHours: number | null;
        hackatimeSnapshotSeconds: number;
        createdAt: Date;
        reviewJustification?: ReviewJustificationPayload | null;
      }>;

      const updateSet =
        decision === "approved"
          ? ({ status: "shipped", approvedHours: approvedHours as number, updatedAt: now } as const)
          : decision === "rejected"
            ? ({ status: "work-in-progress", approvedHours: null, updatedAt: now } as const)
            : ({ updatedAt: now } as const);

      const updated = await tx
        .update(project)
        .set(updateSet)
        .where(and(eq(project.id, projectId), eq(project.status, "in-review")))
        .returning({
          id: project.id,
          name: project.name,
          creatorId: project.creatorId,
          status: project.status,
        });

      if (updated.length === 0) {
        throw new ReviewSubmitError(
          "stale",
          "Project changed while submitting review. Refresh and try again.",
          409,
        );
      }

      if (statusUpdate) {
        await tx.delete(projectReviewerAssignment).where(eq(projectReviewerAssignment.projectId, projectId));
      }

      await appendReviewAudit(
        {
          projectId,
          reviewId,
          actorId: userId,
          actorRole: role,
          action: "review_submitted",
          details: {
            decision,
            approvedHours: decision === "approved" ? (approvedHours as number) : null,
            statusAfter: updated[0]?.status ?? "in-review",
            hackatimeSnapshotSeconds,
            reviewJustification: normalizedReviewJustification,
          },
          at: now,
        },
        tx,
      );

      return {
        project: updated[0]!,
        review: inserted[0]!,
        reviewJustification: normalizedReviewJustification,
      };
    })
    .catch((error: unknown) => {
      if (error instanceof ReviewSubmitError) {
        return { handledError: error };
      }
      throw error;
    });

  if ("handledError" in txResult) {
    return NextResponse.json({ error: txResult.handledError.message }, { status: txResult.handledError.status });
  }

  // Best-effort: notify the project creator about the new reviewer comment.
  // Only reviewer/admin users can reach this route (enforced above by canReview()).
  try {
    if (txResult.project.creatorId) {
      const creatorRows = await db
        .select({ email: user.email, slackId: user.slackId })
        .from(user)
        .where(eq(user.id, txResult.project.creatorId))
        .limit(1);

      const creatorEmail = creatorRows[0]?.email;
      const creatorSlackId = creatorRows[0]?.slackId;
      if (creatorEmail) {
        const reviewerName = (session?.user as { name?: string | null } | undefined)?.name ?? "Reviewer";

        const decisionPrefix =
          decision === "comment"
            ? ""
            : decision === "approved"
              ? `Approved${Number.isFinite(approvedHours) ? ` (${approvedHours} hours)` : ""}: `
              : "Rejected: ";

        const updates = `${decisionPrefix}${comment}`;

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
        let project_link = `/projects/${projectId}`;
        if (appUrl) {
          try {
            project_link = new URL(`/projects/${projectId}`, appUrl).toString();
          } catch {
            // If appUrl isn't a valid absolute URL, fall back to relative.
          }
        }

        // Email is best-effort; failures shouldn’t block Slack DM.
        await sendReviewEmail(creatorEmail, updates, reviewerName, project_link).catch((err) => {
          console.warn("sendReviewEmail failed", err);
        });

        if (creatorSlackId) {
          const reviewerSlack = await db
            .select({ slackId: user.slackId })
            .from(user)
            .where(eq(user.id, userId))
            .limit(1);

          const reviewerSlackId = reviewerSlack[0]?.slackId ?? undefined;
          const statusLabel = decision === "comment" ? "comment" : decision;
          await notifyReviewDM({
            slackId: creatorSlackId,
            projectName: txResult.project.name,
            status: statusLabel,
            comment,
            projectUrl: project_link,
            reviewerSlackId,
            reviewerName: reviewerName,
            reviewerId: userId,
            creatorSlackId: creatorSlackId,
          });
        }
      }
    }
  } catch (err) {
    console.error("Failed to send review email/Slack DM", err);
  }

  return NextResponse.json({
    project: { status: txResult.project.status },
    review: {
      id: txResult.review.id ?? reviewId,
      decision: txResult.review.decision ?? decision,
      reviewComment: txResult.review.reviewComment ?? comment,
      approvedHours:
        txResult.review.approvedHours ?? (decision === "approved" ? (approvedHours as number) : null),
      hackatimeSnapshotSeconds: txResult.review.hackatimeSnapshotSeconds,
      reviewJustification:
        txResult.review.reviewJustification ?? txResult.reviewJustification ?? null,
      createdAt: (txResult.review.createdAt ?? now).toISOString(),
      reviewerName: (session?.user as { name?: string | null } | undefined)?.name ?? "Reviewer",
      reviewerEmail: (session?.user as { email?: string | null } | undefined)?.email ?? "",
    },
  });
}
