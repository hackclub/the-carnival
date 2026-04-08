import { describe, expect, test } from "bun:test";
import {
  approvedHoursWithinSnapshot,
  isApprovedHourIncrement,
  maxApprovedHoursForSnapshot,
  normalizeApprovedHours,
  normalizeSnapshotSeconds,
} from "./review-rules.ts";

describe("review-rules", () => {
  test("accepts only 0.1-hour increments", () => {
    expect(isApprovedHourIncrement(0.1)).toBe(true);
    expect(isApprovedHourIncrement(1)).toBe(true);
    expect(isApprovedHourIncrement(2.5)).toBe(true);
    expect(isApprovedHourIncrement(3.1)).toBe(true);
    expect(isApprovedHourIncrement(1.25)).toBe(false);
    expect(isApprovedHourIncrement(3.17)).toBe(false);
  });

  test("normalizes approved hours to a persisted tenth-hour value", () => {
    expect(normalizeApprovedHours(3.1)).toBe(3.1);
    expect(normalizeApprovedHours(0)).toBeNull();
    expect(normalizeApprovedHours(1.25)).toBeNull();
  });

  test("normalizes invalid Hackatime snapshots to zero seconds", () => {
    expect(normalizeSnapshotSeconds(null)).toBe(0);
    expect(normalizeSnapshotSeconds(NaN)).toBe(0);
    expect(normalizeSnapshotSeconds(-10)).toBe(0);
    expect(normalizeSnapshotSeconds(3599.9)).toBe(3599);
  });

  test("computes max approvable hours from snapshot using tenth-hour granularity", () => {
    expect(maxApprovedHoursForSnapshot(0)).toBe(0);
    expect(maxApprovedHoursForSnapshot(359)).toBe(0);
    expect(maxApprovedHoursForSnapshot(360)).toBe(0.1);
    expect(maxApprovedHoursForSnapshot(5399)).toBe(1.4);
    expect(maxApprovedHoursForSnapshot(5400)).toBe(1.5);
  });

  test("enforces approved-hours <= snapshot-derived ceiling", () => {
    const snapshotSeconds = 5 * 3600 + 20 * 60;
    expect(approvedHoursWithinSnapshot(5.3, snapshotSeconds)).toBe(true);
    expect(approvedHoursWithinSnapshot(5.4, snapshotSeconds)).toBe(false);
  });
});
