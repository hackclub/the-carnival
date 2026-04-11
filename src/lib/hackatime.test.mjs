import { describe, expect, mock, test } from "bun:test";

mock.module("@/db", () => ({
  db: {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit: async () => [{ hackatimeAccessToken: "token-1" }],
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
