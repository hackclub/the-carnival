import { beforeEach, describe, expect, mock, test } from "bun:test";
import { HackatimeAuthError } from "@/lib/hackatime-errors";

const state = {
  session: { user: { id: "user-1" } },
  outcome: { type: "ok", projects: [] },
};

function resetState() {
  state.session = { user: { id: "user-1" } };
  state.outcome = { type: "ok", projects: [] };
}

mock.module("@/lib/server-session", () => ({
  getServerSession: async () => state.session,
}));
mock.module("@/lib/hackatime", () => ({
  fetchHackatimeProjectsForConnectedUser: async () => {
    if (state.outcome.type === "throw") throw state.outcome.error;
    return state.outcome.projects;
  },
}));

const { GET } = await import("./route.ts");

function request(returnTo) {
  const suffix = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
  return new Request(`http://localhost/api/hackatime/projects${suffix}`);
}

describe("GET /api/hackatime/projects", () => {
  beforeEach(() => {
    resetState();
  });

  test("rejects signed-out callers without a connect URL", async () => {
    state.session = null;

    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(body.code).toBeUndefined();
  });

  test("returns the user's projects when the token works", async () => {
    state.outcome = {
      type: "ok",
      projects: [{ name: "project-one", totalSeconds: 60, startedAt: null, stoppedAt: null }],
    };

    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0].name).toBe("project-one");
  });

  test("asks a never-connected user to connect, preserving returnTo", async () => {
    state.outcome = { type: "throw", error: new HackatimeAuthError("not_connected") };

    const res = await GET(request("/projects/abc?tab=hackatime"));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("oauth_required");
    expect(body.reason).toBe("not_connected");
    expect(body.projects).toEqual([]);
    expect(body.connectUrl).toBe(
      `/api/hackatime/oauth/start?returnTo=${encodeURIComponent("/projects/abc?tab=hackatime")}`,
    );
  });

  test("asks a revoked user to reconnect instead of returning an empty list", async () => {
    state.outcome = { type: "throw", error: new HackatimeAuthError("revoked") };

    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("oauth_required");
    expect(body.reason).toBe("revoked");
    expect(body.error).toContain("Reconnect");
    expect(body.connectUrl).toBe("/api/hackatime/oauth/start?returnTo=%2Fprojects");
  });

  test("other Hackatime failures are reported as upstream errors", async () => {
    state.outcome = {
      type: "throw",
      error: new Error("Hackatime request failed (503 Service Unavailable)"),
    };

    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.code).toBeUndefined();
    expect(body.error).toContain("503");
  });
});
