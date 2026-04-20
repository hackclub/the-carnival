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
  isApprovedHourIncrement,
  normalizeSnapshotSeconds,
  normalizeApprovedHours,
  validateRequiredReviewJustification,
  type ReviewJustificationPayload,
} from "@/lib/review-rules";
import {
  parseConsideredHackatimeRange,
  toUtcBoundaryDate,
  type ConsideredHackatimeRange,
} from "@/lib/hackatime-range";
import { refreshHackatimeProjectSnapshotForRange } from "@/lib/hackatime";
import { notifyReviewDM } from "@/lib/slack";

type ReviewBody = {
  decision?: unknown;
  comment?: unknown;
  approvedHours?: unknown;
  reviewJustification?: unknown;
  consideredHackatimeRange?: unknown;
  dismiss?: unknown;
  dismissReason?: unknown;
};

const DISMISS_REASON_MAX_LENGTH = 2000;

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

function mapReviewJustificationToStructuredColumns(
  justification: ReviewJustificationPayload | null,
) {
  return {
    reviewEvidenceChecklist: justification?.evidence ?? {},
    reviewedHackatimeRangeStart: justification
      ? toUtcBoundaryDate(justification.reviewDateRange.startDate, "start")
      : null,
    reviewedHackatimeRangeEnd: justification
      ? toUtcBoundaryDate(justification.reviewDateRange.endDate, "end")
      : null,
    hourAdjustmentReasonMetadata: justification
      ? {
          decision: justification.decision,
          hackatimeProjectName: justification.hackatimeProjectName,
          reduced: justification.deflation.reduced,
          hoursReducedBy: justification.deflation.hoursReducedBy,
          reasons: justification.deflation.reasons,
          note: justification.deflation.note,
          reasonRequired: justification.deflation.reasonRequired,
        }
      : {},
  };
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
  let approvedHours =
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
    if (!isApprovedHourIncrement(approvedHours!)) {
      return NextResponse.json(
        { error: "Approved hours must be in 0.1-hour increments" },
        { status: 400 },
      );
    }
    approvedHours = normalizeApprovedHours(approvedHours);
  }

  const dismiss = body.dismiss === true;
  let dismissReason: string | null = null;
  if (dismiss) {
    if (decision !== "rejected") {
      return NextResponse.json(
        { error: "Dismiss is only available when rejecting a project.", code: "dismiss_requires_rejection" },
        { status: 400 },
      );
    }
    if (role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can dismiss a project.", code: "dismiss_requires_admin" },
        { status: 403 },
      );
    }
    const rawReason = toCleanString(body.dismissReason);
    if (!rawReason) {
      return NextResponse.json(
        {
          error: "Please provide a reason that will be shown to the creator.",
          code: "dismiss_requires_reason",
        },
        { status: 400 },
      );
    }
    if (rawReason.length > DISMISS_REASON_MAX_LENGTH) {
      return NextResponse.json(
        {
          error: `Dismissal reason is too long (max ${DISMISS_REASON_MAX_LENGTH} characters).`,
          code: "dismiss_reason_too_long",
        },
        { status: 400 },
      );
    }
    dismissReason = rawReason;
  }

  const now = new Date();
  const reviewId = randomUUID();
  const statusUpdate = nextStatusForDecision(decision);
  const requestedRangeOverride = body.consideredHackatimeRange;

  let consideredHackatimeRange: ConsideredHackatimeRange | null = null;
  if (requestedRangeOverride !== undefined && requestedRangeOverride !== null) {
    if (role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can override the considered Hackatime range on approval." },
        { status: 403 },
      );
    }
    if (decision !== "approved") {
      return NextResponse.json(
        { error: "Considered Hackatime range overrides are only supported on approvals." },
        { status: 400 },
      );
    }
    const parsedRange = parseConsideredHackatimeRange(requestedRangeOverride);
    if (!parsedRange.ok) {
      return NextResponse.json({ error: parsedRange.error }, { status: 400 });
    }
    consideredHackatimeRange = parsedRange.value;
  }

  const txResult = await db
    .transaction(async (tx) => {
      const rows = await tx
        .select({
          id: project.id,
          name: project.name,
          hackatimeProjectName: project.hackatimeProjectName,
          status: project.status,
          creatorId: project.creatorId,
          hackatimeStartedAt: project.hackatimeStartedAt,
          hackatimeStoppedAt: project.hackatimeStoppedAt,
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

      let hackatimeSnapshotSeconds = normalizeSnapshotSeconds(current.hackatimeTotalSeconds ?? null);
      const projectRangeUpdate: Partial<{
        hackatimeStartedAt: Date | null;
        hackatimeStoppedAt: Date | null;
        hackatimeTotalSeconds: number | null;
      }> = {};

      if (decision === "approved" && consideredHackatimeRange) {
        if (!current.creatorId) {
          throw new ReviewSubmitError(
            "validation",
            "Project has no creator; cannot refresh the considered Hackatime range.",
            409,
          );
        }

        try {
          const refreshed = await refreshHackatimeProjectSnapshotForRange(current.creatorId, {
            projectName: current.hackatimeProjectName,
            range: consideredHackatimeRange,
          });
          hackatimeSnapshotSeconds = normalizeSnapshotSeconds(refreshed.hackatimeTotalSeconds);
          projectRangeUpdate.hackatimeStartedAt = refreshed.hackatimeStartedAt;
          projectRangeUpdate.hackatimeStoppedAt = refreshed.hackatimeStoppedAt;
          projectRangeUpdate.hackatimeTotalSeconds = hackatimeSnapshotSeconds;
        } catch (error) {
          const message =
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : "Failed to refresh Hackatime for the selected range.";
          throw new ReviewSubmitError(
            "validation",
            `Could not refresh the considered Hackatime range. ${message}`,
            400,
          );
        }
      }

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
          : decision === "rejected" && (body.reviewJustification === null || body.reviewJustification === undefined)
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

      const structuredReviewColumns =
        mapReviewJustificationToStructuredColumns(normalizedReviewJustification);

      const reviewInsertValues: typeof peerReview.$inferInsert = {
        id: reviewId,
        projectId,
        reviewerId: userId,
        decision,
        reviewComment: comment,
        approvedHours: decision === "approved" ? (approvedHours as number) : null,
        hackatimeSnapshotSeconds,
        createdAt: now,
        updatedAt: now,
        reviewEvidenceChecklist: structuredReviewColumns.reviewEvidenceChecklist,
        reviewedHackatimeRangeStart: structuredReviewColumns.reviewedHackatimeRangeStart,
        reviewedHackatimeRangeEnd: structuredReviewColumns.reviewedHackatimeRangeEnd,
        hourAdjustmentReasonMetadata: structuredReviewColumns.hourAdjustmentReasonMetadata,
      };

      const inserted = (await tx
        .insert(peerReview)
        .values(reviewInsertValues)
        .returning({
          id: peerReview.id,
          decision: peerReview.decision,
          reviewComment: peerReview.reviewComment,
          approvedHours: peerReview.approvedHours,
          hackatimeSnapshotSeconds: peerReview.hackatimeSnapshotSeconds,
          createdAt: peerReview.createdAt,
        })) as Array<{
        id: string;
        decision: ReviewDecision;
        reviewComment: string;
        approvedHours: number | null;
        hackatimeSnapshotSeconds: number;
        createdAt: Date;
      }>;

      const updateSet =
        decision === "approved"
          ? ({
              status: "shipped",
              approvedHours: approvedHours as number,
              updatedAt: now,
              ...projectRangeUpdate,
            } as const)
          : decision === "rejected"
            ? ({
                status: "work-in-progress",
                approvedHours: null,
                updatedAt: now,
                ...(dismiss
                  ? {
                      resubmissionBlocked: true,
                      resubmissionBlockedAt: now,
                      resubmissionBlockedBy: userId,
                      resubmissionBlockedReason: dismissReason,
                    }
                  : {}),
              } as const)
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
          approvedHours: project.approvedHours,
          hackatimeStartedAt: project.hackatimeStartedAt,
          hackatimeStoppedAt: project.hackatimeStoppedAt,
          hackatimeTotalSeconds: project.hackatimeTotalSeconds,
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
            consideredHackatimeRange,
            reviewJustification: normalizedReviewJustification,
            dismissed: dismiss,
            ...(dismiss ? { dismissReason } : {}),
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
              : dismiss
                ? "Rejected and dismissed: "
                : "Rejected: ";

        const dismissNote = dismiss
          ? `\n\nAn admin has dismissed this project, so it cannot be resubmitted for review.${
              dismissReason ? `\n\nReason from admin: ${dismissReason}` : ""
            }\n\nIf you believe this was a mistake, contact an organizer.`
          : "";
        const updates = `${decisionPrefix}${comment}${dismissNote}`;

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
          const statusLabel: "submitted" | "approved" | "rejected" | "comment" | "shipped" =
            decision === "comment" ? "comment" : decision;
          const slackComment = dismiss
            ? `${comment}\n\nAn admin has dismissed this project, so it cannot be resubmitted for review.${
                dismissReason ? `\n\nReason from admin: ${dismissReason}` : ""
              }`
            : comment;
          await notifyReviewDM({
            slackId: creatorSlackId,
            projectName: txResult.project.name,
            status: statusLabel,
            comment: slackComment,
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
    project: {
      status: txResult.project.status,
      approvedHours: txResult.project.approvedHours ?? null,
      hackatimeStartedAt: txResult.project.hackatimeStartedAt
        ? txResult.project.hackatimeStartedAt.toISOString()
        : null,
      hackatimeStoppedAt: txResult.project.hackatimeStoppedAt
        ? txResult.project.hackatimeStoppedAt.toISOString()
        : null,
      hackatimeTotalSeconds: txResult.project.hackatimeTotalSeconds ?? null,
    },
    review: {
      id: txResult.review.id ?? reviewId,
      decision: txResult.review.decision ?? decision,
      reviewComment: txResult.review.reviewComment ?? comment,
      approvedHours:
        txResult.review.approvedHours ?? (decision === "approved" ? (approvedHours as number) : null),
      hackatimeSnapshotSeconds: txResult.review.hackatimeSnapshotSeconds,
      reviewJustification: txResult.reviewJustification ?? null,
      createdAt: (txResult.review.createdAt ?? now).toISOString(),
      reviewerName: (session?.user as { name?: string | null } | undefined)?.name ?? "Reviewer",
      reviewerEmail: (session?.user as { email?: string | null } | undefined)?.email ?? "",
    },
  });
}
