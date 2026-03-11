import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";

type HackatimeProjectsResponse = {
  projects?: {
    name?: string;
    total_seconds?: number;
    most_recent_heartbeat?: string;
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
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function toIsoOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function deriveStartIso(stoppedIso: string | null, totalSeconds: number) {
  if (!stoppedIso || totalSeconds <= 0) return null;
  const stoppedMs = new Date(stoppedIso).getTime();
  if (!Number.isFinite(stoppedMs)) return null;
  return new Date(stoppedMs - totalSeconds * 1000).toISOString();
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
    .filter((p) => !p.archived)
    .map((p) => {
      const name = typeof p.name === "string" ? p.name.trim() : "";
      const totalSeconds = toSafeSeconds(p.total_seconds);
      const stoppedAt = toIsoOrNull(p.most_recent_heartbeat);
      const startedAt = deriveStartIso(stoppedAt, totalSeconds);
      return { name, totalSeconds, startedAt, stoppedAt };
    })
    .filter((p) => p.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
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