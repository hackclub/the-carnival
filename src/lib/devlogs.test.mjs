import { describe, expect, test } from "bun:test";

const {
  resolveDevlogHackatimeProjectName,
} = await import("./devlogs.ts");

const {
  DEVLOG_AI_DESCRIPTION_MAX_LENGTH,
  DEVLOG_MAX_ATTACHMENTS,
  computeDevlogWindowCeiling,
  computeWindowCeiling,
  formatDurationHM,
  parseAttachmentUrls,
  parseDevlogWindow,
  parseOptionalTrimmedString,
} = await import("./devlog-shared.ts");

describe("resolveDevlogHackatimeProjectName", () => {
  test("uses an explicit devlog project selection", () => {
    expect(
      resolveDevlogHackatimeProjectName({
        requestedName: "  site-redesign  ",
        defaultName: "default-project",
        hasPriorDevlogs: false,
      }),
    ).toBe("site-redesign");
  });

  test("falls back to the project default", () => {
    expect(
      resolveDevlogHackatimeProjectName({
        requestedName: "",
        defaultName: "default-project",
        hasPriorDevlogs: true,
      }),
    ).toBe("default-project");
  });

  test("requires a selection for first devlog when no default exists", () => {
    expect(() =>
      resolveDevlogHackatimeProjectName({
        requestedName: "",
        defaultName: "",
        hasPriorDevlogs: false,
      }),
    ).toThrow("Select a Hackatime project for your first devlog.");
  });
});

describe("formatDurationHM", () => {
  test("formats zero", () => {
    expect(formatDurationHM(0).label).toBe("0h00m");
  });
  test("rounds seconds down to minutes", () => {
    expect(formatDurationHM(3659).label).toBe("1h00m");
  });
  test("formats hours + minutes", () => {
    expect(formatDurationHM(3 * 3600 + 45 * 60 + 15).label).toBe("3h45m");
  });
  test("guards negatives", () => {
    expect(formatDurationHM(-50).label).toBe("0h00m");
  });
});

describe("parseAttachmentUrls", () => {
  test("requires at least one attachment", () => {
    const r = parseAttachmentUrls([], { projectId: "p1" });
    expect(r.ok).toBe(false);
  });
  test("rejects non-http URLs", () => {
    const r = parseAttachmentUrls(["ftp://foo.example/bar.png"], { projectId: "p1" });
    expect(r.ok).toBe(false);
  });
  test("accepts https URLs and trims", () => {
    const r = parseAttachmentUrls(
      ["https://example.com/a.png", "  https://example.com/b.jpg  "],
      { projectId: "p1" },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual(["https://example.com/a.png", "https://example.com/b.jpg"]);
    }
  });
  test("rejects when too many attachments", () => {
    const urls = Array.from(
      { length: DEVLOG_MAX_ATTACHMENTS + 1 },
      (_, i) => `https://example.com/${i}.png`,
    );
    const r = parseAttachmentUrls(urls, { projectId: "p1" });
    expect(r.ok).toBe(false);
  });
});

describe("parseOptionalTrimmedString", () => {
  test("returns null for empty strings", () => {
    expect(parseOptionalTrimmedString("  ", 10)).toBe(null);
    expect(parseOptionalTrimmedString(null, 10)).toBe(null);
  });
  test("returns trimmed value within max", () => {
    expect(parseOptionalTrimmedString("  hi  ", DEVLOG_AI_DESCRIPTION_MAX_LENGTH)).toBe("hi");
  });
  test("returns undefined when over max", () => {
    expect(parseOptionalTrimmedString("a".repeat(20), 10)).toBe(undefined);
  });
});

describe("parseDevlogWindow", () => {
  const ceiling = new Date("2026-04-30T00:00:00.000Z");

  test("rejects non-date inputs", () => {
    const r = parseDevlogWindow({ startedAt: "nope", endedAt: null, ceiling });
    expect(r.ok).toBe(false);
  });
  test("rejects end before start", () => {
    const r = parseDevlogWindow({
      startedAt: "2026-04-10T12:00:00Z",
      endedAt: "2026-04-10T11:00:00Z",
      ceiling,
    });
    expect(r.ok).toBe(false);
  });
  test("accepts start before project creation or earlier devlogs", () => {
    const r = parseDevlogWindow({
      startedAt: "2026-03-30T00:00:00Z",
      endedAt: "2026-04-02T00:00:00Z",
      ceiling,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.startedAt.toISOString()).toBe("2026-03-30T00:00:00.000Z");
    }
  });
  test("keeps starts unchanged", () => {
    const r = parseDevlogWindow({
      startedAt: "2026-04-11T01:00:00Z",
      endedAt: "2026-04-11T02:00:00Z",
      ceiling,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.startedAt.toISOString()).toBe("2026-04-11T01:00:00.000Z");
    }
  });
  test("rejects end after ceiling", () => {
    const r = parseDevlogWindow({
      startedAt: "2026-04-10T00:00:00Z",
      endedAt: "2026-05-01T00:00:00Z",
      ceiling,
    });
    expect(r.ok).toBe(false);
  });
  test("accepts a valid window", () => {
    const r = parseDevlogWindow({
      startedAt: "2026-04-10T00:00:00Z",
      endedAt: "2026-04-11T00:00:00Z",
      ceiling,
    });
    expect(r.ok).toBe(true);
  });
});

describe("computeWindowCeiling", () => {
  test("returns now when no submittedAt", () => {
    const before = Date.now();
    const d = computeWindowCeiling(null);
    const after = Date.now();
    expect(d.getTime()).toBeGreaterThanOrEqual(before - 1);
    expect(d.getTime()).toBeLessThanOrEqual(after + 1);
  });
  test("returns submittedAt when it is in the past", () => {
    const past = new Date("2026-01-01T00:00:00Z");
    expect(computeWindowCeiling(past).getTime()).toBe(past.getTime());
  });
});

describe("computeDevlogWindowCeiling", () => {
  test("ignores historical submittedAt after a project returns to work-in-progress", () => {
    const past = new Date("2026-01-01T00:00:00Z");
    const before = Date.now();
    const d = computeDevlogWindowCeiling({
      projectStatus: "work-in-progress",
      submittedAt: past,
    });
    const after = Date.now();
    expect(d.getTime()).toBeGreaterThanOrEqual(before - 1);
    expect(d.getTime()).toBeLessThanOrEqual(after + 1);
  });

  test("uses submittedAt as the ceiling while the project is in review", () => {
    const submittedAt = new Date("2026-01-01T00:00:00Z");
    expect(
      computeDevlogWindowCeiling({
        projectStatus: "in-review",
        submittedAt,
      }).getTime(),
    ).toBe(submittedAt.getTime());
  });
});
