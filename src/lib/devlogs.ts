import { and, desc, eq, ne, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { devlog, project } from "@/db/schema";

/**
 * Returns the latest devlog.endedAt for a project (excluding `excludeDevlogId` when editing).
 * Falls back to project.startedOnCarnivalAt (or createdAt) if no prior devlog exists.
 */
export async function getDevlogWindowFloor(
  projectId: string,
  fallbackStart: Date,
  excludeDevlogId?: string,
): Promise<Date> {
  const whereClause = excludeDevlogId
    ? and(eq(devlog.projectId, projectId), ne(devlog.id, excludeDevlogId))
    : eq(devlog.projectId, projectId);

  const rows = await db
    .select({ endedAt: devlog.endedAt })
    .from(devlog)
    .where(whereClause)
    .orderBy(desc(devlog.endedAt))
    .limit(1);

  const prior = rows[0]?.endedAt;
  if (prior instanceof Date && !Number.isNaN(prior.getTime())) {
    if (prior.getTime() > fallbackStart.getTime()) return prior;
  }
  return fallbackStart;
}

export async function recomputeProjectHoursSpentSeconds(
  projectId: string,
  tx?: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  const runner = tx ?? db;
  const rows = await runner
    .select({ total: sum(devlog.durationSeconds) })
    .from(devlog)
    .where(eq(devlog.projectId, projectId));
  const raw = rows[0]?.total ?? 0;
  const total =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10) || 0
        : 0;
  const safe = Math.max(0, Math.floor(total));
  await runner
    .update(project)
    .set({ hoursSpentSeconds: safe, updatedAt: new Date() })
    .where(eq(project.id, projectId));
  return safe;
}

/**
 * Raw SQL expression for the "legacy hours fallback": use project.hoursSpentSeconds when > 0,
 * otherwise fall back to project.hackatimeTotalSeconds (which drove hours pre-devlogs-v2).
 */
export function displayHoursSecondsSql() {
  return sql<number>`COALESCE(NULLIF(${project.hoursSpentSeconds}, 0), COALESCE(${project.hackatimeTotalSeconds}, 0))`;
}
