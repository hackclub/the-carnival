import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { toUtcBoundaryDate, type ConsideredHackatimeRange } from "@/lib/hackatime-range";

type HackatimeProjectsResponse = {
  projects?: {
    name?: string;
    total_seconds?: number | string;
    seconds?: number | string;
    totalSeconds?: number | string;
    most_recent_heartbeat?: string | { time?: string; created_at?: string; timestamp?: string } | null;
    most_recent_heartbeat_at?: string;
    last_heartbeat_at?: string;
    last_heartbeat?: string;
    archived?: boolean;
  }[];
};

type HackatimeMeResponse = {
  id?: string | number;
};

export type HackatimeProjectSummary = {
  name: string;
  totalSeconds: number;
  startedAt: string | null;
  stoppedAt: string | null;
};

export type HackatimeHoursBreakdown = {
  hours: number;
  minutes: number;
};

export type RefreshedHackatimeSnapshot = {
  hackatimeStartedAt: Date;
  hackatimeStoppedAt: Date;
  hackatimeTotalSeconds: number;
  hours: HackatimeHoursBreakdown;
};

type AuthenticatedProjectsQuery = {
  includeArchived?: boolean;
  projects?: string[];
  since?: string;
  until?: string;
  start?: string;
  end?: string;
};

async function makeHackatimeAuthedRequest(uri: string, accessToken: string) {
  return fetch(uri, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
}

export function buildHackatimeAuthenticatedProjectsUrl(query: AuthenticatedProjectsQuery = {}) {
  const url = new URL("https://hackatime.hackclub.com/api/v1/authenticated/projects");

  url.searchParams.set("include_archived", query.includeArchived ? "true" : "false");

  if (query.projects && query.projects.length > 0) {
    url.searchParams.set("projects", query.projects.join(","));
  }
  if (query.since) {
    url.searchParams.set("since", query.since);
  }
  if (query.until) {
    url.searchParams.set("until", query.until);
    url.searchParams.set("until_date", query.until);
  }
  if (query.start) {
    url.searchParams.set("start", query.start);
    url.searchParams.set("start_date", query.start);
  }
  if (query.end) {
    url.searchParams.set("end", query.end);
    url.searchParams.set("end_date", query.end);
  }

  return url.toString();
}

function toSafeSeconds(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}

function toIsoOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function pickHeartbeatIso(value: unknown): string | null {
  if (typeof value === "string") return toIsoOrNull(value);
  if (!value || typeof value !== "object") return null;
  const row = value as { time?: unknown; created_at?: unknown; timestamp?: unknown };
  return toIsoOrNull(row.time ?? row.created_at ?? row.timestamp ?? null);
}

function deriveStartIso(stoppedIso: string | null, totalSeconds: number) {
  if (!stoppedIso || totalSeconds <= 0) return null;
  const stoppedMs = new Date(stoppedIso).getTime();
  if (!Number.isFinite(stoppedMs)) return null;
  return new Date(stoppedMs - totalSeconds * 1000).toISOString();
}

function toEpochMsOrZero(value: string | null) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function toHackatimeHoursBreakdown(totalSeconds: number): HackatimeHoursBreakdown {
  const safeTotalSeconds =
    typeof totalSeconds === "number" && Number.isFinite(totalSeconds)
      ? Math.max(0, Math.floor(totalSeconds))
      : 0;
  return {
    hours: Math.floor(safeTotalSeconds / 3600),
    minutes: Math.floor(safeTotalSeconds / 60) % 60,
  };
}

export async function getHackatimeAccessTokenForUser(userId: string): Promise<string | null> {
  const rows = await db
    .select({ hackatimeAccessToken: user.hackatimeAccessToken })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  const token = rows[0]?.hackatimeAccessToken;
  return typeof token === "string" && token.trim() ? token : null;
}

/**
 * Public Hackatime identifier for a user. Preferred for the /users/{uid}/stats
 * endpoint which does not require OAuth. Falls back to slack_id when hackatime
 * has not yet been OAuth-connected but the user is known by Slack.
 */
export async function getHackatimePublicUidForUser(userId: string): Promise<string | null> {
  const rows = await db
    .select({ hackatimeUserId: user.hackatimeUserId, slackId: user.slackId })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  const hackatimeUid =
    typeof rows[0]?.hackatimeUserId === "string" ? rows[0].hackatimeUserId.trim() : "";
  if (hackatimeUid) return hackatimeUid;
  const slackId = typeof rows[0]?.slackId === "string" ? rows[0].slackId.trim() : "";
  return slackId || null;
}

type HackatimeStatsTotalsResponse = {
  data?: {
    total_seconds?: number | string;
    projects?: { name?: string; total_seconds?: number | string }[];
  };
};

/**
 * Query Hackatime's public /users/{uid}/stats endpoint for the total seconds
 * coded on a given project within an arbitrary time window. Mirrors the call
 * flavortown makes from HackatimeService.sync_devlog_duration.
 *
 * Notes:
 * - `start_date` / `end_date` accept ISO-8601 timestamps (not only YYYY-MM-DD).
 * - `filter_by_project` narrows totals to a single project key.
 * - No bearer token required; keyed off the user's Slack/Hackatime UID.
 */
export async function fetchHackatimeStatsProjectTotalSeconds(input: {
  hackatimeUid: string;
  projectName: string;
  start: string;
  end: string;
}): Promise<number> {
  const hackatimeUid = input.hackatimeUid.trim();
  const projectName = input.projectName.trim();
  if (!hackatimeUid || !projectName) return 0;

  const url = new URL(`https://hackatime.hackclub.com/api/v1/users/${encodeURIComponent(hackatimeUid)}/stats`);
  url.searchParams.set("features", "projects");
  url.searchParams.set("start_date", input.start);
  url.searchParams.set("end_date", input.end);
  url.searchParams.set("filter_by_project", projectName);
  url.searchParams.set("total_seconds", "true");
  url.searchParams.set("test_param", "true");

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Hackatime stats request failed (${response.status} ${response.statusText})${body ? `: ${body}` : ""}`,
    );
  }

  const raw = (await response.json().catch(() => ({}))) as HackatimeStatsTotalsResponse;
  const topLevel = toSafeSeconds(raw.data?.total_seconds);
  if (topLevel > 0) return topLevel;

  const projects = Array.isArray(raw.data?.projects) ? raw.data!.projects! : [];
  const wanted = projectName.toLowerCase();
  const matched = projects.find((p) => typeof p.name === "string" && p.name.trim().toLowerCase() === wanted);
  return toSafeSeconds(matched?.total_seconds);
}

export async function fetchHackatimeIdentityFromToken(accessToken: string): Promise<{ userId: string | null }> {
  const response = await makeHackatimeAuthedRequest(
    "https://hackatime.hackclub.com/api/v1/authenticated/me",
    accessToken,
  );
  if (!response.ok) return { userId: null };

  const raw = (await response.json().catch(() => ({}))) as HackatimeMeResponse;
  const id =
    typeof raw.id === "number"
      ? String(raw.id)
      : typeof raw.id === "string"
        ? raw.id.trim()
        : "";
  return { userId: id || null };
}

export async function fetchHackatimeProjectsByAccessToken(
  accessToken: string,
  query: AuthenticatedProjectsQuery = {},
): Promise<HackatimeProjectSummary[]> {
  const response = await makeHackatimeAuthedRequest(
    buildHackatimeAuthenticatedProjectsUrl(query),
    accessToken,
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Hackatime request failed (${response.status} ${response.statusText})${body ? `: ${body}` : ""}`,
    );
  }

  const raw = (await response.json().catch(() => ({}))) as HackatimeProjectsResponse;
  const projects = Array.isArray(raw.projects) ? raw.projects : [];

  return projects
    .filter((p) => p.archived !== true)
    .map((p) => {
      const name = typeof p.name === "string" ? p.name.trim() : "";
      const totalSeconds = toSafeSeconds(p.total_seconds ?? p.seconds ?? p.totalSeconds);
      const stoppedAt =
        pickHeartbeatIso(
          p.most_recent_heartbeat ??
            p.most_recent_heartbeat_at ??
            p.last_heartbeat_at ??
            p.last_heartbeat ??
            null,
        ) ?? null;
      const startedAt = deriveStartIso(stoppedAt, totalSeconds);
      return { name, totalSeconds, startedAt, stoppedAt };
    })
    .filter((p) => p.name.length > 0)
    .sort((a, b) => {
      const recencyDiff = toEpochMsOrZero(b.stoppedAt) - toEpochMsOrZero(a.stoppedAt);
      if (recencyDiff !== 0) return recencyDiff;
      return a.name.localeCompare(b.name);
    });
}

export async function fetchHackatimeProjectsForUser(userId: string): Promise<HackatimeProjectSummary[]> {
  const token = await getHackatimeAccessTokenForUser(userId);
  if (!token) return [];

  try {
    return await fetchHackatimeProjectsByAccessToken(token);
  } catch {
    return [];
  }
}

export async function fetchHackatimeProjectTotalSecondsForRange(
  userId: string,
  input: { projectName: string; range: ConsideredHackatimeRange },
) {
  const token = await getHackatimeAccessTokenForUser(userId);
  if (!token) {
    throw new Error("Connect your Hackatime account to refresh the considered range.");
  }

  const start = `${input.range.startDate}T00:00:00.000Z`;
  const end = `${input.range.endDate}T23:59:59.999Z`;
  const projects = await fetchHackatimeProjectsByAccessToken(token, {
    includeArchived: false,
    projects: [input.projectName],
    start,
    end,
  });

  const wanted = input.projectName.trim().toLowerCase();
  const matched = projects.find((project) => project.name.trim().toLowerCase() === wanted);

  return {
    totalSeconds: matched?.totalSeconds ?? 0,
  };
}

/**
 * Precise (ISO-timestamp) variant of fetchHackatimeProjectTotalSecondsForRange
 * used for devlog-sized windows. Hits the public /users/{uid}/stats endpoint
 * (the same one flavortown uses from sync_devlog_duration) with full ISO
 * timestamps for start_date/end_date.
 */
export async function fetchHackatimeProjectTotalSecondsForInstantRange(
  userId: string,
  input: { projectName: string; startedAt: Date; endedAt: Date },
) {
  const projectName = input.projectName.trim();
  if (!projectName) {
    throw new Error("Select a Hackatime project before pulling devlog hours.");
  }
  if (
    !(input.startedAt instanceof Date) ||
    !(input.endedAt instanceof Date) ||
    Number.isNaN(input.startedAt.getTime()) ||
    Number.isNaN(input.endedAt.getTime())
  ) {
    throw new Error("Invalid devlog time window.");
  }
  if (input.endedAt.getTime() <= input.startedAt.getTime()) {
    throw new Error("Devlog end must be after start.");
  }

  const hackatimeUid = await getHackatimePublicUidForUser(userId);
  if (!hackatimeUid) {
    throw new Error("Connect your Hackatime account to post a devlog.");
  }

  const totalSeconds = await fetchHackatimeStatsProjectTotalSeconds({
    hackatimeUid,
    projectName,
    start: input.startedAt.toISOString(),
    end: input.endedAt.toISOString(),
  });

  return { totalSeconds };
}

export async function refreshHackatimeProjectSnapshotForRange(
  userId: string,
  input: { projectName: string; range: ConsideredHackatimeRange },
): Promise<RefreshedHackatimeSnapshot> {
  const projectName = input.projectName.trim();
  if (!projectName) {
    throw new Error("Select a Hackatime project before refreshing the considered range.");
  }

  const hackatimeStartedAt = toUtcBoundaryDate(input.range.startDate, "start");
  const hackatimeStoppedAt = toUtcBoundaryDate(input.range.endDate, "end");
  if (!hackatimeStartedAt || !hackatimeStoppedAt) {
    throw new Error("Choose a valid considered Hackatime range before refreshing.");
  }

  const refreshed = await fetchHackatimeProjectTotalSecondsForRange(userId, {
    projectName,
    range: input.range,
  });

  return {
    hackatimeStartedAt,
    hackatimeStoppedAt,
    hackatimeTotalSeconds: refreshed.totalSeconds,
    hours: toHackatimeHoursBreakdown(refreshed.totalSeconds),
  };
}

export async function fetchHackatimeProjectHoursByName(
  userId: string,
): Promise<Record<string, { hours: number; minutes: number }>> {
  const projects = await fetchHackatimeProjectsForUser(userId);
  const out: Record<string, { hours: number; minutes: number }> = {};
  for (const p of projects) {
    const totalMinutes = Math.floor(p.totalSeconds / 60);
    out[p.name] = {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    };
  }
  return out;
}
