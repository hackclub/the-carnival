import { describe, expect, test } from "bun:test";
import { buildHackatimeAuthenticatedProjectsUrl } from "./hackatime.ts";

describe("hackatime", () => {
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
});
