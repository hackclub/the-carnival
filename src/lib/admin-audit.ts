import { randomUUID } from "crypto";
import { db } from "@/db";
import { adminAuditLog, type UserRole } from "@/db/schema";

export const ADMIN_AUDIT_ACTIONS = [
  "user_frozen",
  "user_unfrozen",
  "ledger_adjustment_created",
] as const;

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

type AuditDb = Pick<typeof db, "insert">;

export async function appendAdminAudit(
  input: {
    actorId: string;
    actorRole: Extract<UserRole, "admin" | "reviewer">;
    action: AdminAuditAction;
    targetUserId?: string | null;
    details?: Record<string, unknown>;
    at?: Date;
  },
  auditDb: AuditDb = db,
) {
  await auditDb.insert(adminAuditLog).values({
    id: randomUUID(),
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    targetUserId: input.targetUserId ?? null,
    details: input.details ?? {},
    createdAt: input.at ?? new Date(),
  });
}
