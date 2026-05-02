import { randomUUID } from "crypto";
import { and, asc, desc, eq, ne, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { devlog, project, projectHackatimeProject } from "@/db/schema";

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

type ProjectHackatimeRunner = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

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
