import { randomUUID } from "crypto";
import { db } from "@/db";
import { reviewAuditLog, type UserRole } from "@/db/schema";

export const REVIEW_AUDIT_ACTIONS = [
  "review_submitted",
  "review_assignment_added",
  "review_assignment_removed",
  "review_comment_deleted",
] as const;

export type ReviewAuditAction = (typeof REVIEW_AUDIT_ACTIONS)[number];

type AuditDb = Pick<typeof db, "insert">;

export async function appendReviewAudit(
  input: {
    projectId: string;
    reviewId?: string | null;
    actorId: string;
    actorRole: Extract<UserRole, "reviewer" | "admin">;
    action: ReviewAuditAction;
    details?: Record<string, unknown>;
    at?: Date;
  },
  auditDb: AuditDb = db,
) {
  await auditDb.insert(reviewAuditLog).values({
    id: randomUUID(),
    projectId: input.projectId,
    reviewId: input.reviewId ?? null,
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    details: input.details ?? {},
    createdAt: input.at ?? new Date(),
  });
}
