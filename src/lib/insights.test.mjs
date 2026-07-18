import { describe, expect, test } from "bun:test";

const {
  buildNudgeTemplates,
  firstNameOf,
  isRecentlyNudged,
  isSegmentKey,
  renderNudgeMessage,
  SEGMENT_KEYS,
} = await import("./insights.ts");

describe("firstNameOf", () => {
  test("returns the first word of a full name", () => {
    expect(firstNameOf("Josias Aurel")).toBe("Josias");
    expect(firstNameOf("  Ada   Lovelace  ")).toBe("Ada");
    expect(firstNameOf("Prince")).toBe("Prince");
  });

  test("falls back to 'there' for empty or missing names", () => {
    expect(firstNameOf("")).toBe("there");
    expect(firstNameOf("   ")).toBe("there");
    expect(firstNameOf(null)).toBe("there");
    expect(firstNameOf(undefined)).toBe("there");
  });
});

describe("renderNudgeMessage", () => {
  test("replaces every {firstName} placeholder", () => {
    expect(
      renderNudgeMessage("Hey {firstName}! Go {firstName}!", { name: "Ada Lovelace" }),
    ).toBe("Hey Ada! Go Ada!");
  });

  test("uses the fallback when the user has no name", () => {
    expect(renderNudgeMessage("Hey {firstName}!", { name: null })).toBe("Hey there!");
  });

  test("leaves messages without placeholders untouched", () => {
    expect(renderNudgeMessage("No placeholders here.", { name: "Ada" })).toBe(
      "No placeholders here.",
    );
  });
});

describe("isRecentlyNudged", () => {
  const now = new Date("2026-07-18T12:00:00.000Z");

  test("true when the last nudge is within the window", () => {
    expect(isRecentlyNudged("2026-07-15T12:00:00.000Z", now, 7)).toBe(true);
  });

  test("false when the last nudge is outside the window", () => {
    expect(isRecentlyNudged("2026-07-01T12:00:00.000Z", now, 7)).toBe(false);
  });

  test("false when never nudged, window is zero, or timestamp is invalid", () => {
    expect(isRecentlyNudged(null, now, 7)).toBe(false);
    expect(isRecentlyNudged("2026-07-17T12:00:00.000Z", now, 0)).toBe(false);
    expect(isRecentlyNudged("not-a-date", now, 7)).toBe(false);
  });

  test("boundary: a nudge exactly `days` old is no longer recent", () => {
    expect(isRecentlyNudged("2026-07-11T12:00:00.000Z", now, 7)).toBe(false);
  });
});

describe("isSegmentKey", () => {
  test("accepts every known segment key", () => {
    for (const key of SEGMENT_KEYS) expect(isSegmentKey(key)).toBe(true);
  });

  test("rejects unknown values", () => {
    expect(isSegmentKey("everyone")).toBe(false);
    expect(isSegmentKey(42)).toBe(false);
    expect(isSegmentKey(null)).toBe(false);
  });
});

describe("buildNudgeTemplates", () => {
  test("provides a template for every segment and strips trailing slashes from the base URL", () => {
    const templates = buildNudgeTemplates("https://carnival.hackclub.com///");
    for (const key of SEGMENT_KEYS) {
      expect(templates[key].key).toBe(key);
      expect(templates[key].template.length).toBeGreaterThan(20);
    }
    expect(templates.never_activated.template).toContain("https://carnival.hackclub.com/account");
    expect(templates.never_activated.template).not.toContain(".com//");
  });
});
