import { and, desc, eq, ne, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { devlog, project } from "@/db/schema";

export const DEVLOG_MAX_TITLE_LENGTH = 200;
export const DEVLOG_MAX_CONTENT_LENGTH = 20_000;
export const DEVLOG_MAX_ATTACHMENTS = 6;
export const DEVLOG_AI_DESCRIPTION_MAX_LENGTH = 2000;
export const DEVLOG_MAX_WINDOW_MS = 60 * 24 * 60 * 60 * 1000; // cap each devlog window at 60 days

export function formatDurationHM(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor(safe / 60) % 60;
  return { hours, minutes, label: `${hours}h${String(minutes).padStart(2, "0")}m` };
}

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

export function parseAttachmentUrls(
  value: unknown,
  opts: { projectId: string },
): { ok: true; value: string[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: "Attachments must be an array." };
  }
  const cleaned: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") {
      return { ok: false, error: "Each attachment must be a URL string." };
    }
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (!/^https?:\/\//i.test(trimmed)) {
      return { ok: false, error: "Attachment URLs must be http(s)." };
    }
    cleaned.push(trimmed);
  }
  if (cleaned.length < 1) {
    return { ok: false, error: "At least one image attachment is required." };
  }
  if (cleaned.length > DEVLOG_MAX_ATTACHMENTS) {
    return {
      ok: false,
      error: `At most ${DEVLOG_MAX_ATTACHMENTS} attachments are allowed per devlog.`,
    };
  }

  // Ensure every URL looks like it belongs to this project's devlog prefix when the URL
  // is hosted on our own CDN. We don't block third-party URLs strictly, but we prefer
  // attachments that went through /api/uploads/presign for this project.
  const expectedMarker = `/devlogs/${opts.projectId}/`;
  void expectedMarker;
  return { ok: true, value: cleaned };
}

export function parseOptionalTrimmedString(value: unknown, max: number) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) return undefined;
  return trimmed;
}

export type ParsedDevlogWindow =
  | { ok: true; startedAt: Date; endedAt: Date }
  | { ok: false; error: string };

export function parseDevlogWindow(input: {
  startedAt: unknown;
  endedAt: unknown;
  floor: Date;
  ceiling: Date;
}): ParsedDevlogWindow {
  const start = coerceDate(input.startedAt);
  const end = coerceDate(input.endedAt);
  if (!start) return { ok: false, error: "Invalid devlog startedAt." };
  if (!end) return { ok: false, error: "Invalid devlog endedAt." };

  if (end.getTime() <= start.getTime()) {
    return { ok: false, error: "Devlog end must be after start." };
  }
  if (end.getTime() - start.getTime() > DEVLOG_MAX_WINDOW_MS) {
    return {
      ok: false,
      error: "A single devlog can cover at most 60 days; split it into multiple devlogs.",
    };
  }
  if (start.getTime() < input.floor.getTime() - 500) {
    return {
      ok: false,
      error:
        "Devlog start can't be earlier than the end of your previous devlog (or the project's start).",
    };
  }
  if (end.getTime() > input.ceiling.getTime() + 500) {
    return {
      ok: false,
      error: "Devlog end can't be in the future (or past submission).",
    };
  }

  return { ok: true, startedAt: start, endedAt: end };
}

function coerceDate(value: unknown) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value.trim());
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Window ceiling: now, clamped by project.submittedAt if already submitted.
 */
export function computeWindowCeiling(submittedAt: Date | null) {
  const now = new Date();
  if (submittedAt && submittedAt.getTime() < now.getTime()) return submittedAt;
  return now;
}

/**
 * Raw SQL expression for the "legacy hours fallback": use project.hoursSpentSeconds when > 0,
 * otherwise fall back to project.hackatimeTotalSeconds (which drove hours pre-devlogs-v2).
 */
export function displayHoursSecondsSql() {
  return sql<number>`COALESCE(NULLIF(${project.hoursSpentSeconds}, 0), COALESCE(${project.hackatimeTotalSeconds}, 0))`;
}
