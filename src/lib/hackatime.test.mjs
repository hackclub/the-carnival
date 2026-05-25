import { describe, expect, mock, test } from "bun:test";

mock.module("@/db", () => ({
  db: {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit: async () => [
                  {
                    hackatimeAccessToken: "token-1",
                    hackatimeUserId: "123",
                    slackId: "U123",
                  },
                ],
              };
            },
          };
        },
      };
    },
  },
}));

const {
  buildHackatimeAuthenticatedProjectsUrl,
  fetchHackatimeProjectTotalSecondsForInstantRange,
  matchingProjectOverlapSeconds,
  refreshHackatimeProjectSnapshotForRange,
  toHackatimeHoursBreakdown,
} = await import("./hackatime.ts");

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
});
