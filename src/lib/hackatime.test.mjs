import { describe, expect, mock, test } from "bun:test";

const dbState = {
  userRow: {
    hackatimeAccessToken: "token-1",
    hackatimeUserId: "123",
    slackId: "U123",
  },
  updateCalls: [],
};

mock.module("@/db", () => ({
  db: {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit: async () => [dbState.userRow],
              };
            },
          };
        },
      };
    },
    update() {
      return {
        set(values) {
          return {
            where: async () => {
              dbState.updateCalls.push(values);
              return [];
            },
          };
        },
      };
    },
  },
}));

const {
  buildHackatimeAuthenticatedProjectsUrl,
  disconnectHackatimeForUser,
  fetchHackatimeProjectsForConnectedUser,
  fetchHackatimeProjectsForUser,
  fetchHackatimeProjectTotalSecondsForInstantRange,
  getHackatimeConnectionStatusForUser,
  matchingProjectOverlapSeconds,
  refreshHackatimeProjectSnapshotForRange,
  toHackatimeHoursBreakdown,
  verifyHackatimeAccessTokenForUser,
} = await import("./hackatime.ts");
const { isHackatimeAuthError } = await import("./hackatime-errors.ts");

function unauthorizedResponse() {
  return new Response("unauthorized", { status: 401, statusText: "Unauthorized" });
}

async function captureError(run) {
  try {
    await run();
  } catch (error) {
    return error;
  }
  return null;
}

const originalFetch = global.fetch;

describe("hackatime", () => {
  test("converts total seconds into hours and minutes", () => {
    expect(toHackatimeHoursBreakdown(3660)).toEqual({ hours: 1, minutes: 1 });
  });

  test("builds authenticated projects URLs with range and project filters", () => {
    const url = new URL(
      buildHackatimeAuthenticatedProjectsUrl({
        projects: ["project-one"],
        start: "2026-03-10T00:00:00.000Z",
        end: "2026-03-20T23:59:59.999Z",
      }),
    );

    expect(url.origin).toBe("https://hackatime.hackclub.com");
    expect(url.pathname).toBe("/api/v1/authenticated/projects");
    expect(url.searchParams.get("include_archived")).toBe("false");
    expect(url.searchParams.get("projects")).toBe("project-one");
    expect(url.searchParams.get("start")).toBe("2026-03-10T00:00:00.000Z");
    expect(url.searchParams.get("start_date")).toBe("2026-03-10T00:00:00.000Z");
    expect(url.searchParams.get("end")).toBe("2026-03-20T23:59:59.999Z");
    expect(url.searchParams.get("end_date")).toBe("2026-03-20T23:59:59.999Z");
  });

  test("counts overlapping timeline span seconds for matching projects", () => {
    const seconds = matchingProjectOverlapSeconds({
      projectName: "project-one",
      startedAt: new Date("2026-03-10T10:15:00.000Z"),
      endedAt: new Date("2026-03-10T11:15:00.000Z"),
      spans: [
        {
          startTime: Date.parse("2026-03-10T10:00:00.000Z") / 1000,
          endTime: Date.parse("2026-03-10T10:30:00.000Z") / 1000,
          duration: 30 * 60,
          projectsEdited: [{ name: "Project-One", repoUrl: null }],
          editors: [],
          languages: [],
        },
        {
          startTime: Date.parse("2026-03-10T11:00:00.000Z") / 1000,
          endTime: Date.parse("2026-03-10T11:45:00.000Z") / 1000,
          duration: 45 * 60,
          projectsEdited: [{ name: "project-one", repoUrl: null }],
          editors: [],
          languages: [],
        },
        {
          startTime: Date.parse("2026-03-10T10:30:00.000Z") / 1000,
          endTime: Date.parse("2026-03-10T11:00:00.000Z") / 1000,
          duration: 30 * 60,
          projectsEdited: [{ name: "different-project", repoUrl: null }],
          editors: [],
          languages: [],
        },
      ],
    });

    expect(seconds).toBe(30 * 60);
  });

  test("uses timeline projectsEdited for instant project totals", async () => {
    const originalAdminToken = process.env.HACKATIME_ADMIN_API_TOKEN;
    try {
      process.env.HACKATIME_ADMIN_API_TOKEN = "admin-token";
      global.fetch = async (url) => {
        const href = String(url);
        if (href.includes("/stats")) {
          throw new Error("stats endpoint should not be called for devlog instant totals");
        }
        if (href.includes("/api/admin/v1/timeline")) {
          return new Response(
            JSON.stringify({
              date: "2026-03-10",
              users: [
                {
                  user: { id: 123, username: "user-one" },
                  total_coded_time: 3600,
                  spans: [
                    {
                      start_time: Date.parse("2026-03-10T10:00:00.000Z") / 1000,
                      end_time: Date.parse("2026-03-10T11:00:00.000Z") / 1000,
                      duration: 3600,
                      projects_edited_details: [{ name: "project-one", repo_url: null }],
                      editors: [],
                      languages: [],
                    },
                  ],
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("not found", { status: 404 });
      };

      const result = await fetchHackatimeProjectTotalSecondsForInstantRange("user-1", {
        projectName: "project-one",
        startedAt: new Date("2026-03-10T10:30:00.000Z"),
        endedAt: new Date("2026-03-10T11:30:00.000Z"),
      });

      expect(result.totalSeconds).toBe(30 * 60);
    } finally {
      if (originalAdminToken === undefined) {
        delete process.env.HACKATIME_ADMIN_API_TOKEN;
      } else {
        process.env.HACKATIME_ADMIN_API_TOKEN = originalAdminToken;
      }
      global.fetch = originalFetch;
    }
  });

  test("refreshes a canonical Hackatime snapshot for a considered range", async () => {
    try {
      global.fetch = async () =>
        new Response(
          JSON.stringify({
            projects: [
              {
                name: "project-one",
                total_seconds: 3660,
                most_recent_heartbeat_at: "2026-03-20T23:00:00.000Z",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );

      const snapshot = await refreshHackatimeProjectSnapshotForRange("user-1", {
        projectName: "project-one",
        range: {
          startDate: "2026-03-10",
          endDate: "2026-03-20",
        },
      });

      expect(snapshot.hackatimeStartedAt.toISOString()).toBe("2026-03-10T00:00:00.000Z");
      expect(snapshot.hackatimeStoppedAt.toISOString()).toBe("2026-03-20T23:59:59.999Z");
      expect(snapshot.hackatimeTotalSeconds).toBe(3660);
      expect(snapshot.hours).toEqual({ hours: 1, minutes: 1 });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("a 401 from Hackatime raises a revoked auth error and clears the stored token", async () => {
    dbState.updateCalls = [];
    try {
      global.fetch = async () => unauthorizedResponse();

      const caught = await captureError(() => fetchHackatimeProjectsForConnectedUser("user-1"));

      expect(isHackatimeAuthError(caught)).toBe(true);
      expect(caught.reason).toBe("revoked");
      // Token and scope go; the Hackatime user id and connected-at stay so
      // devlogs keep working and the UI can offer "reconnect".
      expect(dbState.updateCalls).toHaveLength(1);
      expect(dbState.updateCalls[0].hackatimeAccessToken).toBeNull();
      expect(dbState.updateCalls[0].hackatimeScope).toBeNull();
      expect("hackatimeUserId" in dbState.updateCalls[0]).toBe(false);
      expect("hackatimeConnectedAt" in dbState.updateCalls[0]).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("non-401 Hackatime failures stay generic and keep the token", async () => {
    dbState.updateCalls = [];
    try {
      global.fetch = async () => new Response("forbidden", { status: 403, statusText: "Forbidden" });

      const caught = await captureError(() => fetchHackatimeProjectsForConnectedUser("user-1"));

      expect(isHackatimeAuthError(caught)).toBe(false);
      expect(String(caught?.message)).toContain("403");
      expect(dbState.updateCalls).toHaveLength(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("a missing token raises not_connected without calling Hackatime", async () => {
    const previousRow = dbState.userRow;
    dbState.userRow = { ...previousRow, hackatimeAccessToken: null };
    dbState.updateCalls = [];
    try {
      global.fetch = async () => {
        throw new Error("Hackatime should not be called without a token");
      };

      const caught = await captureError(() => fetchHackatimeProjectsForConnectedUser("user-1"));

      expect(isHackatimeAuthError(caught)).toBe(true);
      expect(caught.reason).toBe("not_connected");
      expect(dbState.updateCalls).toHaveLength(0);
    } finally {
      dbState.userRow = previousRow;
      global.fetch = originalFetch;
    }
  });

  test("a missing token with a connected-at timestamp keeps reading as revoked", async () => {
    const previousRow = dbState.userRow;
    dbState.userRow = {
      ...previousRow,
      hackatimeAccessToken: null,
      hackatimeConnectedAt: new Date("2026-03-01T00:00:00.000Z"),
    };
    dbState.updateCalls = [];
    try {
      global.fetch = async () => {
        throw new Error("Hackatime should not be called without a token");
      };

      const caught = await captureError(() => fetchHackatimeProjectsForConnectedUser("user-1"));

      expect(isHackatimeAuthError(caught)).toBe(true);
      expect(caught.reason).toBe("revoked");
      expect(dbState.updateCalls).toHaveLength(0);
    } finally {
      dbState.userRow = previousRow;
      global.fetch = originalFetch;
    }
  });

  test("lenient project listing reads a revoked token as no projects", async () => {
    try {
      global.fetch = async () => unauthorizedResponse();
      expect(await fetchHackatimeProjectsForUser("user-1")).toEqual([]);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("range refresh surfaces the revoked error to callers", async () => {
    try {
      global.fetch = async () => unauthorizedResponse();

      const caught = await captureError(() =>
        refreshHackatimeProjectSnapshotForRange("user-1", {
          projectName: "project-one",
          range: { startDate: "2026-03-10", endDate: "2026-03-20" },
        }),
      );

      expect(isHackatimeAuthError(caught)).toBe(true);
      expect(caught.reason).toBe("revoked");
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("connection status is derived from stored state without calling Hackatime", async () => {
    const previousRow = dbState.userRow;
    try {
      global.fetch = async () => {
        throw new Error("status derivation must not call Hackatime");
      };

      expect(await getHackatimeConnectionStatusForUser("user-1")).toBe("connected");

      dbState.userRow = {
        ...previousRow,
        hackatimeAccessToken: null,
        hackatimeConnectedAt: new Date("2026-03-01T00:00:00.000Z"),
      };
      expect(await getHackatimeConnectionStatusForUser("user-1")).toBe("needs_reconnect");

      dbState.userRow = { ...previousRow, hackatimeAccessToken: null };
      expect(await getHackatimeConnectionStatusForUser("user-1")).toBe("not_connected");
    } finally {
      dbState.userRow = previousRow;
      global.fetch = originalFetch;
    }
  });

  test("token verification reports ok for a working token", async () => {
    dbState.updateCalls = [];
    try {
      global.fetch = async (url) => {
        expect(String(url)).toContain("/api/v1/authenticated/me");
        return new Response(JSON.stringify({ id: 123 }), { status: 200 });
      };

      expect(await verifyHackatimeAccessTokenForUser("user-1")).toBe("ok");
      expect(dbState.updateCalls).toHaveLength(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("token verification drops a revoked token", async () => {
    dbState.updateCalls = [];
    try {
      global.fetch = async () => unauthorizedResponse();

      expect(await verifyHackatimeAccessTokenForUser("user-1")).toBe("revoked");
      expect(dbState.updateCalls).toHaveLength(1);
      expect(dbState.updateCalls[0].hackatimeAccessToken).toBeNull();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("token verification treats Hackatime outages as unknown and keeps the token", async () => {
    dbState.updateCalls = [];
    try {
      global.fetch = async () => {
        throw new Error("network down");
      };
      expect(await verifyHackatimeAccessTokenForUser("user-1")).toBe("unknown");

      global.fetch = async () => new Response("oops", { status: 503 });
      expect(await verifyHackatimeAccessTokenForUser("user-1")).toBe("unknown");

      expect(dbState.updateCalls).toHaveLength(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("token verification without a token mirrors the stored state", async () => {
    const previousRow = dbState.userRow;
    try {
      global.fetch = async () => {
        throw new Error("no token means no Hackatime call");
      };

      dbState.userRow = { ...previousRow, hackatimeAccessToken: null };
      expect(await verifyHackatimeAccessTokenForUser("user-1")).toBe("not_connected");

      dbState.userRow = {
        ...previousRow,
        hackatimeAccessToken: null,
        hackatimeConnectedAt: new Date("2026-03-01T00:00:00.000Z"),
      };
      expect(await verifyHackatimeAccessTokenForUser("user-1")).toBe("revoked");
    } finally {
      dbState.userRow = previousRow;
      global.fetch = originalFetch;
    }
  });

  test("disconnect drops the OAuth grant but keeps the Hackatime user id", async () => {
    dbState.updateCalls = [];

    await disconnectHackatimeForUser("user-1");

    expect(dbState.updateCalls).toHaveLength(1);
    expect(dbState.updateCalls[0]).toMatchObject({
      hackatimeAccessToken: null,
      hackatimeScope: null,
      hackatimeConnectedAt: null,
    });
    // Reviewer tools and devlog hours for in-review projects key on this.
    expect("hackatimeUserId" in dbState.updateCalls[0]).toBe(false);
  });
});
