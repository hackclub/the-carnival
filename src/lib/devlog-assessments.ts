import type { DevlogAssessmentDecision } from "@/db/schema";

export type DevlogAssessmentDraft = {
  devlogId: string;
  decision: DevlogAssessmentDecision;
  adjustedSeconds?: number | null;
  comment?: string | null;
};

export type DevlogAssessmentInput = {
  devlogId: string;
  durationSeconds: number;
};

/**
 * Returns the effective seconds this devlog contributes to approvedHours given the
 * reviewer's decision.
 *  - accepted: the devlog's full durationSeconds count.
 *  - rejected: contributes 0.
 *  - adjusted: contributes min(adjustedSeconds, devlog.durationSeconds), never negative.
 */
export function effectiveSecondsForAssessment(
  devlog: DevlogAssessmentInput,
  assessment: { decision: DevlogAssessmentDecision; adjustedSeconds?: number | null },
): number {
  const base = Math.max(0, Math.floor(devlog.durationSeconds || 0));
  switch (assessment.decision) {
    case "accepted":
      return base;
    case "rejected":
      return 0;
    case "adjusted": {
      const adj = assessment.adjustedSeconds;
      if (typeof adj !== "number" || !Number.isFinite(adj)) return 0;
      const safe = Math.max(0, Math.floor(adj));
      return Math.min(safe, base);
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
