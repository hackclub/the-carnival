import { describe, expect, test } from "bun:test";
import {
  approvedHoursWithinSnapshot,
  isHalfHourIncrement,
  maxApprovedHoursForSnapshot,
  normalizeSnapshotSeconds,
} from "./review-rules.ts";

describe("review-rules", () => {
  test("accepts only 0.5-hour increments", () => {
    expect(isHalfHourIncrement(0.5)).toBe(true);
    expect(isHalfHourIncrement(1)).toBe(true);
    expect(isHalfHourIncrement(2.5)).toBe(true);
    expect(isHalfHourIncrement(1.25)).toBe(false);
    expect(isHalfHourIncrement(3.1)).toBe(false);
  });

  test("normalizes invalid Hackatime snapshots to zero seconds", () => {
    expect(normalizeSnapshotSeconds(null)).toBe(0);
    expect(normalizeSnapshotSeconds(NaN)).toBe(0);
    expect(normalizeSnapshotSeconds(-10)).toBe(0);
    expect(normalizeSnapshotSeconds(3599.9)).toBe(3599);
  });

  test("computes max approvable hours from snapshot using half-hour granularity", () => {
    expect(maxApprovedHoursForSnapshot(0)).toBe(0);
    expect(maxApprovedHoursForSnapshot(1799)).toBe(0);
    expect(maxApprovedHoursForSnapshot(1800)).toBe(0.5);
    expect(maxApprovedHoursForSnapshot(5399)).toBe(1);
    expect(maxApprovedHoursForSnapshot(5400)).toBe(1.5);
  });

  test("enforces approved-hours <= snapshot-derived ceiling", () => {
    const snapshotSeconds = 5 * 3600 + 20 * 60;
    expect(approvedHoursWithinSnapshot(5, snapshotSeconds)).toBe(true);
    expect(approvedHoursWithinSnapshot(5.5, snapshotSeconds)).toBe(false);
  });
});
