import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { tokenLedger, user } from "@/db/schema";
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
  const userId = toCleanString(url.searchParams.get("userId"));
  const kind = toCleanString(url.searchParams.get("kind"));
  const referenceType = toCleanString(url.searchParams.get("referenceType"));
  const limit = parseAuditLimit(url.searchParams.get("limit"));
  const fromDate = toOptionalDate(url.searchParams.get("from"));
  const toDate = toOptionalDate(url.searchParams.get("to"));

  if (kind && kind !== "issue" && kind !== "deduct") {
    return NextResponse.json({ error: "kind must be either issue or deduct" }, { status: 400 });
  }

  const conditions: SQL<unknown>[] = [];
  if (userId) conditions.push(eq(tokenLedger.issuedToUserId, userId));
  if (kind === "issue" || kind === "deduct") conditions.push(eq(tokenLedger.kind, kind));
  if (referenceType) conditions.push(eq(tokenLedger.referenceType, referenceType));
  if (fromDate) conditions.push(gte(tokenLedger.createdAt, fromDate));
  if (toDate) conditions.push(lte(tokenLedger.createdAt, toDate));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const baseQuery = db
    .select({
      id: tokenLedger.id,
      kind: tokenLedger.kind,
      tokens: tokenLedger.tokens,
      reason: tokenLedger.reason,
      issuedToUserId: tokenLedger.issuedToUserId,
      byUserId: tokenLedger.byUserId,
      referenceType: tokenLedger.referenceType,
      referenceId: tokenLedger.referenceId,
      createdAt: tokenLedger.createdAt,
    })
    .from(tokenLedger);

  const totalsQuery = db
    .select({
      issued: sql<number>`coalesce(sum(case when ${tokenLedger.kind} = 'issue' then ${tokenLedger.tokens} else 0 end), 0)`,
      deducted: sql<number>`coalesce(sum(case when ${tokenLedger.kind} = 'deduct' then ${tokenLedger.tokens} else 0 end), 0)`,
      entryCount: sql<number>`count(*)`,
    })
    .from(tokenLedger);

  const [rows, totalsRows] = await Promise.all([
    (whereClause ? baseQuery.where(whereClause) : baseQuery)
      .orderBy(desc(tokenLedger.createdAt))
      .limit(limit),
    whereClause ? totalsQuery.where(whereClause) : totalsQuery,
  ]);

  const issued = +(totalsRows[0]?.issued ?? 0);
  const deducted = +(totalsRows[0]?.deducted ?? 0);
  const entryCount = +(totalsRows[0]?.entryCount ?? 0);

  const userIds = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.issuedToUserId, row.byUserId])
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

  const usersById = new Map(userRows.map((row) => [row.id, row]));

  return NextResponse.json({
    entries: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      tokens: row.tokens,
      reason: row.reason,
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      createdAt: row.createdAt.toISOString(),
      issuedTo: usersById.get(row.issuedToUserId) ?? { id: row.issuedToUserId },
      by: row.byUserId ? usersById.get(row.byUserId) ?? { id: row.byUserId } : null,
    })),
    totals: {
      issued,
      deducted,
      net: issued - deducted,
      entryCount,
    },
    filters: {
      userId: userId || null,
      kind: kind || null,
      referenceType: referenceType || null,
      from: fromDate ? fromDate.toISOString() : null,
      to: toDate ? toDate.toISOString() : null,
      limit,
    },
  });
}
