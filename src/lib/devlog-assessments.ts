import type { DevlogAssessmentDecision, DevlogHackatimeProjectAdjustment } from "@/db/schema";

export type DevlogAssessmentDraft = {
  devlogId: string;
  decision: DevlogAssessmentDecision;
  adjustedSeconds?: number | null;
  // Per-linked-Hackatime-project seconds when the reviewer adjusted individual
  // contributions. Sums to adjustedSeconds.
  hackatimeAdjustments?: DevlogHackatimeProjectAdjustment[] | null;
  comment?: string | null;
};

export type DevlogAssessmentInput = {
  devlogId: string;
  durationSeconds: number;
  // Total seconds all linked Hackatime projects contribute within the devlog
  // window (from the admin timeline breakdown). When present and larger than
  // durationSeconds, it raises the ceiling for adjusted assessments so the
  // reviewer can count contributions beyond the project the devlog recorded.
  hackatimeBreakdownTotalSeconds?: number | null;
};

function safeSeconds(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/**
 * The maximum seconds a reviewer may count for this devlog when adjusting: the
 * devlog's recorded duration, or the multi-project breakdown total when that is
 * larger (all linked Hackatime projects contribute to the devlog's time).
 */
export function maxAdjustableSeconds(devlog: DevlogAssessmentInput): number {
  return Math.max(
    safeSeconds(devlog.durationSeconds),
    safeSeconds(devlog.hackatimeBreakdownTotalSeconds),
  );
}

export function sumHackatimeAdjustmentSeconds(
  entries: DevlogHackatimeProjectAdjustment[] | null | undefined,
): number {
  if (!Array.isArray(entries)) return 0;
  return entries.reduce((acc, e) => acc + safeSeconds(e.seconds), 0);
}

/**
 * Returns the effective seconds this devlog contributes to approvedHours given the
 * reviewer's decision.
 *  - accepted: the devlog's full durationSeconds count.
 *  - rejected: contributes 0.
 *  - adjusted: contributes min(adjustedSeconds, maxAdjustableSeconds), never negative.
 */
export function effectiveSecondsForAssessment(
  devlog: DevlogAssessmentInput,
  assessment: { decision: DevlogAssessmentDecision; adjustedSeconds?: number | null },
): number {
  switch (assessment.decision) {
    case "accepted":
      return safeSeconds(devlog.durationSeconds);
    case "rejected":
      return 0;
    case "adjusted": {
      const adj = assessment.adjustedSeconds;
      if (typeof adj !== "number" || !Number.isFinite(adj)) return 0;
      return Math.min(Math.max(0, Math.floor(adj)), maxAdjustableSeconds(devlog));
    }
    default:
      return 0;
  }
}

/**
 * Sums the effective seconds across every devlog assessment. Devlogs without an
 * assessment entry are treated as pending and contribute 0 here — callers should
 * enforce coverage separately before using the result for approvedHours.
 */
export function sumAssessedSeconds(input: {
  devlogs: DevlogAssessmentInput[];
  assessments: Map<string, { decision: DevlogAssessmentDecision; adjustedSeconds?: number | null }>;
}): number {
  let total = 0;
  for (const d of input.devlogs) {
    const a = input.assessments.get(d.devlogId);
    if (!a) continue;
    total += effectiveSecondsForAssessment(d, a);
  }
  return total;
}

/**
 * Converts an assessed total in seconds to approvedHours, snapped down to the
 * nearest 0.1 hour to line up with the existing isApprovedHourIncrement check.
 */
export function assessmentSecondsToApprovedHours(totalSeconds: number): number {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const rawHours = safe / 3600;
  // snap down to 0.1h increments
  return Math.floor(rawHours * 10) / 10;
}

export function isValidAssessmentDecision(value: unknown): value is DevlogAssessmentDecision {
  return value === "accepted" || value === "rejected" || value === "adjusted";
}
