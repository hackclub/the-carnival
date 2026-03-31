import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLog, user } from "@/db/schema";
import { parseAuditLimit } from "@/lib/admin-safety";
import { getAuthUser, toCleanString } from "@/lib/api-utils";

function toOptionalDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(req: Request) {
  const currentUser = await getAuthUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!currentUser.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const action = toCleanString(url.searchParams.get("action"));
  const actorId = toCleanString(url.searchParams.get("actorId"));
  const targetUserId = toCleanString(url.searchParams.get("targetUserId"));
  const limit = parseAuditLimit(url.searchParams.get("limit"));
  const fromDate = toOptionalDate(url.searchParams.get("from"));
  const toDate = toOptionalDate(url.searchParams.get("to"));

  const conditions: SQL<unknown>[] = [];
  if (action) conditions.push(eq(adminAuditLog.action, action));
  if (actorId) conditions.push(eq(adminAuditLog.actorId, actorId));
  if (targetUserId) conditions.push(eq(adminAuditLog.targetUserId, targetUserId));
  if (fromDate) conditions.push(gte(adminAuditLog.createdAt, fromDate));
  if (toDate) conditions.push(lte(adminAuditLog.createdAt, toDate));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const baseQuery = db
    .select({
      id: adminAuditLog.id,
      actorId: adminAuditLog.actorId,
      actorRole: adminAuditLog.actorRole,
      action: adminAuditLog.action,
      targetUserId: adminAuditLog.targetUserId,
      details: adminAuditLog.details,
      createdAt: adminAuditLog.createdAt,
    })
    .from(adminAuditLog);

  const rows = await (whereClause ? baseQuery.where(whereClause) : baseQuery)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit);

  const userIds = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.actorId, row.targetUserId])
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );

  const userRows = userIds.length
    ? await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        })
        .from(user)
        .where(inArray(user.id, userIds))
    : [];

  const usersById = new Map(
    userRows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
      },
    ]),
  );

  return NextResponse.json({
    logs: rows.map((row) => ({
      id: row.id,
      action: row.action,
      actorRole: row.actorRole,
      details: row.details,
      createdAt: row.createdAt.toISOString(),
      actor: row.actorId ? usersById.get(row.actorId) ?? { id: row.actorId } : null,
      targetUser: row.targetUserId
        ? usersById.get(row.targetUserId) ?? { id: row.targetUserId }
        : null,
    })),
    filters: {
      action: action || null,
      actorId: actorId || null,
      targetUserId: targetUserId || null,
      from: fromDate ? fromDate.toISOString() : null,
      to: toDate ? toDate.toISOString() : null,
      limit,
    },
  });
}
