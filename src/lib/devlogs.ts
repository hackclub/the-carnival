import { randomUUID } from "crypto";
import { and, asc, desc, eq, gt, gte, lt, lte, ne, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { devlog, project, projectHackatimeProject } from "@/db/schema";
import { isValidDate } from "@/lib/devlog-shared";

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
  if (isValidDate(prior) && prior > fallbackStart) return prior;
  return fallbackStart;
}

/**
 * Devlog windows may touch (one ends exactly when the next starts) but must
 * never overlap. Returns the first conflicting devlog, or null.
 */
export async function findOverlappingDevlog(
  projectId: string,
  window: { startedAt: Date; endedAt: Date },
  opts?: { excludeDevlogId?: string },
): Promise<{ id: string; title: string; startedAt: Date; endedAt: Date } | null> {
  const overlap = and(
    eq(devlog.projectId, projectId),
    lt(devlog.startedAt, window.endedAt),
    gt(devlog.endedAt, window.startedAt),
  );
  const whereClause = opts?.excludeDevlogId
    ? and(overlap, ne(devlog.id, opts.excludeDevlogId))
    : overlap;

  const rows = await db
    .select({
      id: devlog.id,
      title: devlog.title,
      startedAt: devlog.startedAt,
      endedAt: devlog.endedAt,
    })
    .from(devlog)
    .where(whereClause)
    .orderBy(asc(devlog.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * All devlogs of a project whose windows stick out of the given range —
 * used to refuse considered-range changes that would orphan existing devlogs.
 */
export async function listDevlogsOutsideRange(
  projectId: string,
  range: { start: Date; end: Date },
): Promise<Array<{ id: string; title: string; startedAt: Date; endedAt: Date }>> {
  const rows = await db
    .select({
      id: devlog.id,
      title: devlog.title,
      startedAt: devlog.startedAt,
      endedAt: devlog.endedAt,
    })
    .from(devlog)
    .where(eq(devlog.projectId, projectId))
    .orderBy(asc(devlog.startedAt));
  return rows.filter(
    (d) => d.startedAt.getTime() < range.start.getTime() || d.endedAt.getTime() > range.end.getTime(),
  );
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

type ProjectHackatimeRunner = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ReviewableDevlogRange = {
  start: Date | null | undefined;
  end: Date | null | undefined;
};

export function devlogWindowOverlapsRange(input: {
  devlogStart: Date;
  devlogEnd: Date;
  rangeStart: Date | null | undefined;
  rangeEnd: Date | null | undefined;
}) {
  if (!isValidDate(input.rangeStart) || !isValidDate(input.rangeEnd)) return true;
  if (input.rangeStart.getTime() > input.rangeEnd.getTime()) return true;
  return (
    input.devlogStart.getTime() <= input.rangeEnd.getTime() &&
    input.devlogEnd.getTime() >= input.rangeStart.getTime()
  );
}

export function reviewableDevlogWhere(projectId: string, range: ReviewableDevlogRange) {
  const base = eq(devlog.projectId, projectId);
  if (!isValidDate(range.start) || !isValidDate(range.end)) return base;
  if (range.start.getTime() > range.end.getTime()) return base;
  return and(base, lte(devlog.startedAt, range.end), gte(devlog.endedAt, range.start));
}

export type LinkedHackatimeProject = {
  id: string;
  name: string;
  isDefault: boolean;
  firstDevlogId: string | null;
};

export async function listProjectHackatimeProjects(
  projectId: string,
  runner: ProjectHackatimeRunner = db,
): Promise<LinkedHackatimeProject[]> {
  const rows = await runner
    .select({
      id: projectHackatimeProject.id,
      name: projectHackatimeProject.name,
      isDefault: projectHackatimeProject.isDefault,
      firstDevlogId: projectHackatimeProject.firstDevlogId,
    })
    .from(projectHackatimeProject)
    .where(eq(projectHackatimeProject.projectId, projectId))
    .orderBy(desc(projectHackatimeProject.isDefault), asc(projectHackatimeProject.name));
  return rows;
}

export async function countProjectDevlogs(
  projectId: string,
  runner: ProjectHackatimeRunner = db,
): Promise<number> {
  const rows = await runner
    .select({ count: sql<number>`count(*)::int` })
    .from(devlog)
    .where(eq(devlog.projectId, projectId));
  return rows[0]?.count ?? 0;
}

export function resolveDevlogHackatimeProjectName(input: {
  requestedName?: unknown;
  defaultName: string | null | undefined;
  hasPriorDevlogs: boolean;
}) {
  const requestedName = typeof input.requestedName === "string" ? input.requestedName.trim() : "";
  if (requestedName) return requestedName;

  const defaultName = input.defaultName?.trim() ?? "";
  if (defaultName) return defaultName;

  if (!input.hasPriorDevlogs) {
    throw new Error("Select a Hackatime project for your first devlog.");
  }
  throw new Error("Select a Hackatime project before posting this devlog.");
}

export async function upsertProjectHackatimeProject(
  input: {
    projectId: string;
    name: string;
    firstDevlogId?: string | null;
    makeDefault?: boolean;
  },
  runner: ProjectHackatimeRunner = db,
) {
  const name = input.name.trim();
  if (!name) throw new Error("Hackatime project name is required.");

  const now = new Date();

  if (input.makeDefault) {
    await runner
      .update(projectHackatimeProject)
      .set({ isDefault: false, updatedAt: now })
      .where(eq(projectHackatimeProject.projectId, input.projectId));
  }

  await runner
    .insert(projectHackatimeProject)
    .values({
      id: randomUUID(),
      projectId: input.projectId,
      name,
      isDefault: input.makeDefault === true,
      firstDevlogId: input.firstDevlogId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [projectHackatimeProject.projectId, projectHackatimeProject.name],
      set: {
        isDefault: input.makeDefault === true ? true : sql`${projectHackatimeProject.isDefault}`,
        firstDevlogId: input.firstDevlogId
          ? sql`COALESCE(${projectHackatimeProject.firstDevlogId}, ${input.firstDevlogId})`
          : sql`${projectHackatimeProject.firstDevlogId}`,
        updatedAt: now,
      },
    });

  if (input.makeDefault) {
    await runner
      .update(project)
      .set({ hackatimeProjectName: name, updatedAt: now })
      .where(eq(project.id, input.projectId));
  }
}

/**
 * Raw SQL expression for the "legacy hours fallback": use project.hoursSpentSeconds when > 0,
 * otherwise fall back to project.hackatimeTotalSeconds (which drove hours pre-devlogs-v2).
 */
export function displayHoursSecondsSql() {
  return sql<number>`COALESCE(NULLIF(${project.hoursSpentSeconds}, 0), COALESCE(${project.hackatimeTotalSeconds}, 0))`;
}
