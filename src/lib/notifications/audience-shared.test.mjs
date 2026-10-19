import { describe, expect, test } from "bun:test";

const { AUDIENCE_FILTER_KEYS, AUDIENCE_PRESETS, defaultFilter, describeFilter, parseAudienceFilter, parseAudienceFilters } =
  await import("./audience-shared.ts");

describe("parseAudienceFilter", () => {
  test("accepts each kind of filter", () => {
    expect(parseAudienceFilter({ key: "projects_submitted", op: "gt", value: 3 })).toEqual({
      key: "projects_submitted",
      op: "gt",
      value: 3,
    });
    expect(parseAudienceFilter({ key: "approved_hours", op: "gte", value: "2.5" })).toEqual({
      key: "approved_hours",
      op: "gte",
      value: 2.5,
    });
    expect(parseAudienceFilter({ key: "hackatime_connected", value: false })).toEqual({
      key: "hackatime_connected",
      value: false,
    });
    expect(parseAudienceFilter({ key: "verification", values: ["pending", "pending", "bogus", "none"] })).toEqual({
      key: "verification",
      values: ["pending", "none"],
    });
    expect(parseAudienceFilter({ key: "signed_up", op: "after", date: "2026-10-01" })).toEqual({
      key: "signed_up",
      op: "after",
      date: "2026-10-01",
    });
  });

  test("rejects unknown keys, bad operators and bad values", () => {
    expect(parseAudienceFilter({ key: "drop_table", op: "gt", value: 1 })).toBeNull();
    expect(parseAudienceFilter({ key: "projects_created", op: ">=", value: 1 })).toBeNull();
    expect(parseAudienceFilter({ key: "projects_created", op: "gte", value: -1 })).toBeNull();
    expect(parseAudienceFilter({ key: "projects_created", op: "gte", value: "lots" })).toBeNull();
    expect(parseAudienceFilter({ key: "in_review", value: "yes" })).toBeNull();
    expect(parseAudienceFilter({ key: "verification", values: [] })).toBeNull();
    expect(parseAudienceFilter({ key: "signed_up", op: "after", date: "Oct 1" })).toBeNull();
    expect(parseAudienceFilter({ key: "signed_up", op: "during", date: "2026-10-01" })).toBeNull();
    expect(parseAudienceFilter({ key: "toString", value: true })).toBeNull();
    expect(parseAudienceFilter(null)).toBeNull();
  });
});

describe("parseAudienceFilters", () => {
  test("no filters means everyone", () => {
    expect(parseAudienceFilters(undefined)).toEqual({ ok: true, filters: [] });
    expect(parseAudienceFilters([])).toEqual({ ok: true, filters: [] });
  });

  test("one bad filter fails the whole list", () => {
    const parsed = parseAudienceFilters([{ key: "in_review", value: true }, { key: "nope" }]);
    expect(parsed.ok).toBe(false);
  });
});

describe("presets and defaults", () => {
  test("every preset and default filter round-trips through the parser", () => {
    for (const preset of AUDIENCE_PRESETS) {
      expect(parseAudienceFilters(preset.filters)).toEqual({ ok: true, filters: preset.filters });
    }
    for (const key of AUDIENCE_FILTER_KEYS) {
      expect(parseAudienceFilter(defaultFilter(key))).toEqual(defaultFilter(key));
    }
  });

  test("describes filters in words", () => {
    expect(describeFilter({ key: "projects_submitted", op: "gt", value: 3 })).toBe("Projects submitted more than 3");
    expect(describeFilter({ key: "unsubmitted_hours", op: "gte", value: 2 })).toBe("Unsubmitted hours at least 2 h");
    expect(describeFilter({ key: "hackatime_connected", value: false })).toBe("Hackatime connected: no");
    expect(describeFilter({ key: "signed_up", op: "after", date: "2026-10-01" })).toBe("Signed up on or after 2026-10-01");
  });
});
