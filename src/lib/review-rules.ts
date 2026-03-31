const HALF_HOUR_EPSILON = 1e-9;
const HALF_HOUR_SECONDS = 30 * 60;

export function isHalfHourIncrement(value: number) {
  const doubled = value * 2;
  return Math.abs(doubled - Math.round(doubled)) < HALF_HOUR_EPSILON;
}

export function normalizeSnapshotSeconds(value: number | null) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value as number));
}

export function maxApprovedHoursForSnapshot(snapshotSeconds: number) {
  return Math.floor(snapshotSeconds / HALF_HOUR_SECONDS) / 2;
}

export function approvedHoursWithinSnapshot(approvedHours: number, snapshotSeconds: number) {
  return approvedHours <= maxApprovedHoursForSnapshot(snapshotSeconds) + HALF_HOUR_EPSILON;
}
