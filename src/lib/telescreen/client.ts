/**
 * Thin client for Robert's YSWS API (Telescreen's fraud review desk).
 * Docs: https://telescreen.hackclub.com/robert/docs
 *
 * The API key belongs to exactly one Robert event, so no path names an event.
 * Keys are server-side secrets: never import this from a client component.
 */
import type { TelescreenOutcomeStatus } from "@/db/schema";

const DEFAULT_BASE_URL = "https://telescreen.hackclub.com";
const REQUEST_TIMEOUT_MS = 15_000;

export function getTelescreenBaseUrl(): string {
  return (process.env.ROBERT_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function getApiKey(): string | null {
  const key = process.env.ROBERT_API_KEY?.trim();
  return key ? key : null;
}

/** The integration is on only when an API key is set (mirrors Slack's gating). */
export function isTelescreenEnabled(): boolean {
  return getApiKey() !== null;
}

export class RobertApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RobertApiError";
  }
}

export type RobertState = "awaiting_review" | "awaiting_outcome" | "rejected_fraud" | "decided";

export type RobertProject = {
  id: string;
  externalId: string | null;
  state: RobertState;
  creditedSeconds: number | null;
  trustScore: number | null;
  review: { trustScore: number; note: string | null; at: string } | null;
  outcome: { status: TelescreenOutcomeStatus; reason: string | null; at: string } | null;
};

export type RobertSubmitInput = {
  name: string;
  codeUrl: string;
  demoUrl?: string;
  submitter: { slackId?: string; hackatimeId?: number };
  hackatimeProjects: string[];
  externalId: string;
};

async function robertFetch<T>(path: string, init: { method: string; body?: unknown }): Promise<T> {
  const key = getApiKey();
  if (!key) throw new RobertApiError("ROBERT_API_KEY is not set", 0);

  let res: Response;
  try {
    res = await fetch(`${getTelescreenBaseUrl()}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new RobertApiError(`Telescreen is unreachable: ${reason}`, 0);
  }

  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    // Every Robert error is JSON with a human `message`.
    const message =
      data && typeof data === "object" && typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : `HTTP ${res.status}`;
    throw new RobertApiError(`Telescreen ${init.method} ${path} failed: ${message}`, res.status);
  }
  return data as T;
}

/** Submit (or idempotently resubmit, by externalId) a Hackatime project. */
export function submitRobertProject(input: RobertSubmitInput) {
  return robertFetch<{ id: string; state: RobertState; created: boolean }>("/api/v1/ysws/projects", {
    method: "POST",
    body: { kind: "hackatime", ...input },
  });
}

export function getRobertProject(robertProjectId: string) {
  return robertFetch<RobertProject>(`/api/v1/ysws/projects/${encodeURIComponent(robertProjectId)}`, {
    method: "GET",
  });
}

/** One page of the event's projects in `state`, newest submission first. */
export function listRobertProjects(input: { state: RobertState; limit?: number; offset?: number }) {
  const params = new URLSearchParams({
    state: input.state,
    limit: String(input.limit ?? 100),
    offset: String(input.offset ?? 0),
  });
  return robertFetch<{ total: number; projects: RobertProject[] }>(`/api/v1/ysws/projects?${params}`, {
    method: "GET",
  });
}

/** Carnival's final decision. Only valid while the project is awaiting_outcome. */
export function recordRobertOutcome(
  robertProjectId: string,
  input: { status: TelescreenOutcomeStatus; reason?: string | null },
) {
  return robertFetch<{ id: string; state: RobertState; outcome: RobertProject["outcome"] }>(
    `/api/v1/ysws/projects/${encodeURIComponent(robertProjectId)}/outcome`,
    {
      method: "POST",
      body: { status: input.status, ...(input.reason ? { reason: input.reason } : {}) },
    },
  );
}

/** Withdraw a submission nobody has fraud-reviewed yet (Robert refuses once scored). */
export function deleteRobertProject(robertProjectId: string, signedOffBy: string) {
  return robertFetch<{ id: string; deleted: boolean }>(
    `/api/v1/ysws/projects/${encodeURIComponent(robertProjectId)}`,
    { method: "DELETE", body: { signedOffBy } },
  );
}
