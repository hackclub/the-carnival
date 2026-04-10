import { describe, expect, test } from "bun:test";
import {
  formatConsideredHackatimeRangeLabel,
  getProjectConsideredHackatimeRange,
  parseConsideredHackatimeRange,
  toUtcBoundaryDate,
} from "./hackatime-range.ts";

describe("hackatime-range", () => {
  test("parses a valid considered Hackatime range", () => {
    expect(
      parseConsideredHackatimeRange({
        startDate: "2026-03-10",
        endDate: "2026-03-20",
      }),
    ).toEqual({
      ok: true,
      value: {
        startDate: "2026-03-10",
        endDate: "2026-03-20",
      },
    });
  });

  test("rejects invalid considered Hackatime ranges", () => {
    expect(
      parseConsideredHackatimeRange({
        startDate: "2026-03-20",
        endDate: "2026-03-10",
      }),
    ).toMatchObject({
      ok: false,
    });
  });

  test("derives a canonical project range from stored project timestamps and fallbacks", () => {
    expect(
      getProjectConsideredHackatimeRange({
        hackatimeStartedAt: null,
        hackatimeStoppedAt: null,
        submittedAt: "2026-03-15T18:22:00.000Z",
        createdAt: "2026-03-01T09:00:00.000Z",
      }),
    ).toEqual({
      startDate: "2026-03-15",
      endDate: "2026-03-15",
    });
  });

  test("normalizes UTC day boundaries for canonical ranges", () => {
    expect(toUtcBoundaryDate("2026-03-10", "start")?.toISOString()).toBe(
      "2026-03-10T00:00:00.000Z",
    );
    expect(toUtcBoundaryDate("2026-03-10", "end")?.toISOString()).toBe(
      "2026-03-10T23:59:59.999Z",
    );
  });

  test("formats canonical ranges as date-only labels", () => {
    expect(
      formatConsideredHackatimeRangeLabel({
        startDate: "2026-03-10",
        endDate: "2026-03-20",
      }),
    ).not.toBe("—");
  });
});
