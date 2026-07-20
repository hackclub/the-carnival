import { describe, expect, test } from "bun:test";

const {
  ANNOUNCEMENT_VARIANTS,
  ANNOUNCEMENT_VARIANT_LABELS,
  isAnnouncementVariant,
  isAnnouncementVisible,
} = await import("./announcements-shared.ts");

const now = new Date("2026-07-18T12:00:00.000Z");

function announcement(overrides = {}) {
  return {
    isActive: true,
    startsAtIso: null,
    endsAtIso: null,
    ...overrides,
  };
}

describe("isAnnouncementVisible", () => {
  test("active with no window is always visible", () => {
    expect(isAnnouncementVisible(announcement(), now)).toBe(true);
  });

  test("inactive is never visible, even inside its window", () => {
    expect(
      isAnnouncementVisible(
        announcement({
          isActive: false,
          startsAtIso: "2026-07-01T00:00:00.000Z",
          endsAtIso: "2026-08-01T00:00:00.000Z",
        }),
        now,
      ),
    ).toBe(false);
  });

  test("respects startsAt (scheduled for the future is hidden)", () => {
    expect(
      isAnnouncementVisible(announcement({ startsAtIso: "2026-07-20T00:00:00.000Z" }), now),
    ).toBe(false);
    expect(
      isAnnouncementVisible(announcement({ startsAtIso: "2026-07-10T00:00:00.000Z" }), now),
    ).toBe(true);
  });

  test("respects endsAt (expired is hidden)", () => {
    expect(
      isAnnouncementVisible(announcement({ endsAtIso: "2026-07-17T00:00:00.000Z" }), now),
    ).toBe(false);
    expect(
      isAnnouncementVisible(announcement({ endsAtIso: "2026-07-31T23:59:59.000Z" }), now),
    ).toBe(true);
  });

  test("visible inside a bounded window; boundary instants are inclusive", () => {
    const windowed = announcement({
      startsAtIso: "2026-07-18T12:00:00.000Z",
      endsAtIso: "2026-07-19T12:00:00.000Z",
    });
    expect(isAnnouncementVisible(windowed, now)).toBe(true);
    expect(isAnnouncementVisible(windowed, new Date("2026-07-19T12:00:00.000Z"))).toBe(true);
    expect(isAnnouncementVisible(windowed, new Date("2026-07-19T12:00:01.000Z"))).toBe(false);
  });

  test("unparseable window bounds are ignored rather than hiding the banner", () => {
    expect(
      isAnnouncementVisible(announcement({ startsAtIso: "garbage", endsAtIso: "garbage" }), now),
    ).toBe(true);
  });
});

describe("variants", () => {
  test("guard accepts every variant and each has a label", () => {
    for (const variant of ANNOUNCEMENT_VARIANTS) {
      expect(isAnnouncementVariant(variant)).toBe(true);
      expect(ANNOUNCEMENT_VARIANT_LABELS[variant].length).toBeGreaterThan(0);
    }
  });

  test("guard rejects unknown values", () => {
    expect(isAnnouncementVariant("danger")).toBe(false);
    expect(isAnnouncementVariant(undefined)).toBe(false);
  });
});
