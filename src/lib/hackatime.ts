import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";

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

async function makeHackatimeAuthedRequest(uri: string, accessToken: string) {
  return fetch(uri, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
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

export async function getHackatimeAccessTokenForUser(userId: string): Promise<string | null> {
  const rows = await db
    .select({ hackatimeAccessToken: user.hackatimeAccessToken })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  const token = rows[0]?.hackatimeAccessToken;
  return typeof token === "string" && token.trim() ? token : null;
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
): Promise<HackatimeProjectSummary[]> {
  const response = await makeHackatimeAuthedRequest(
    "https://hackatime.hackclub.com/api/v1/authenticated/projects?include_archived=false",
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