import { describe, expect, test } from "bun:test";
import { normalizeSnapshotSeconds } from "./review-rules.ts";

describe("review-rules", () => {
  test("normalizes invalid Hackatime snapshots to zero seconds", () => {
    expect(normalizeSnapshotSeconds(null)).toBe(0);
    expect(normalizeSnapshotSeconds(NaN)).toBe(0);
    expect(normalizeSnapshotSeconds(-10)).toBe(0);
    expect(normalizeSnapshotSeconds(3599.9)).toBe(3599);
  });
});
