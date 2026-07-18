import { describe, expect, test } from "bun:test";

const {
  formatDeadlineMonthDay,
  formatDeadlineMonthDayYear,
  isSiteSettingKey,
  parseIsoDeadline,
  SITE_SETTING_DEFAULTS,
  SITE_SETTING_KEYS,
  SITE_SETTING_LABELS,
} = await import("./site-settings-shared.ts");

describe("parseIsoDeadline", () => {
  test("accepts ISO UTC datetimes with and without seconds/millis", () => {
    expect(parseIsoDeadline("2026-07-31T23:59:59.000Z")?.toISOString()).toBe(
      "2026-07-31T23:59:59.000Z",
    );
    expect(parseIsoDeadline("2026-07-31T23:59:59Z")?.toISOString()).toBe(
      "2026-07-31T23:59:59.000Z",
    );
    expect(parseIsoDeadline("2026-07-31T23:59Z")?.toISOString()).toBe("2026-07-31T23:59:00.000Z");
  });

  test("rejects non-UTC, date-only, garbage, and non-string values", () => {
    expect(parseIsoDeadline("2026-07-31T23:59:59+01:00")).toBe(null);
    expect(parseIsoDeadline("2026-07-31")).toBe(null);
    expect(parseIsoDeadline("July 31, 2026")).toBe(null);
    expect(parseIsoDeadline("2026-13-45T99:99:99Z")).toBe(null);
    expect(parseIsoDeadline(null)).toBe(null);
    expect(parseIsoDeadline(1784332800000)).toBe(null);
    expect(parseIsoDeadline({ iso: "2026-07-31T23:59:59Z" })).toBe(null);
  });
});

describe("deadline formatting", () => {
  test("formats month + day in UTC", () => {
    expect(formatDeadlineMonthDay("2026-07-31T23:59:59.000Z")).toBe("July 31");
    // 23:59 UTC must not roll over to the next day in any server timezone.
    expect(formatDeadlineMonthDay("2026-12-31T23:59:59.000Z")).toBe("December 31");
  });

  test("formats month + day + year in UTC", () => {
    expect(formatDeadlineMonthDayYear("2026-07-31T23:59:59.000Z")).toBe("July 31, 2026");
  });

  test("returns empty string for invalid input", () => {
    expect(formatDeadlineMonthDay("not-a-date")).toBe("");
    expect(formatDeadlineMonthDayYear("")).toBe("");
  });
});

describe("setting keys", () => {
  test("every key has a label and a valid default", () => {
    for (const key of SITE_SETTING_KEYS) {
      expect(isSiteSettingKey(key)).toBe(true);
      expect(SITE_SETTING_LABELS[key].label.length).toBeGreaterThan(0);
      expect(parseIsoDeadline(SITE_SETTING_DEFAULTS[key])).not.toBe(null);
    }
  });

  test("rejects unknown keys", () => {
    expect(isSiteSettingKey("event_deadline")).toBe(false);
    expect(isSiteSettingKey(undefined)).toBe(false);
  });
});
