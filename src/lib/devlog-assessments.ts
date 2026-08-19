import type { DevlogAssessmentDecision, DevlogHackatimeProjectAdjustment } from "@/db/schema";

export type DevlogAssessmentDraft = {
  devlogId: string;
  decision: DevlogAssessmentDecision;
  adjustedSeconds?: number | null;
  // Per-linked-Hackatime-project seconds when the reviewer adjusted individual
  // contributions. Sums to adjustedSeconds.
  hackatimeAdjustments?: DevlogHackatimeProjectAdjustment[] | null;
  // Required whenever the assessment deflates the devlog's time (see
  // assessmentDeflatesHours). Keys from REVIEW_DEFLATION_REASON_OPTIONS.
  deflationReasons?: string[] | null;
  // Reviewer-overridden considered window (ISO strings), inside the devlog's
  // own window — e.g. trimming days already counted by an overlapping devlog.
  // The server re-pulls Hackatime for this range itself; reviewedWindowSeconds
  // is only the client-side preview of that pull.
  reviewedWindow?: { startedAt: string; endedAt: string } | null;
  reviewedWindowSeconds?: number | null;
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
 * Whether an assessment DEFLATES this devlog: it counts fewer seconds than
 * the devlog's logged time (its recorded duration, or the multi-project
 * breakdown total when larger). Deflation is always tied to the devlog's
 * time range — a deflating assessment must carry deflation reasons and a
 * comment, which flow into the per-devlog breakdown of the Airtable hours
 * justification (YSWS Handbook "Deflation Justification").
 */
// The reviewer's hour/minute inputs have minute granularity, so an adjusted
// value can sit up to 59 seconds below the devlog's exact logged seconds from
// rounding alone. That is NOT a deflation — without this tolerance, merely
// touching the hours inputs would demand deflation reasons for a sub-minute
// "reduction" the reviewer never intended.
const DEFLATION_TOLERANCE_SECONDS = 59;

export function assessmentDeflatesHours(
  devlog: DevlogAssessmentInput,
  assessment: { decision: DevlogAssessmentDecision; adjustedSeconds?: number | null },
): boolean {
  // Accepting counts the devlog exactly as it logged its time — never a deflation.
  if (assessment.decision === "accepted") return false;
  const logged = maxAdjustableSeconds(devlog);
  if (logged <= 0) return false;
  return (
    effectiveSecondsForAssessment(devlog, assessment) < logged - DEFLATION_TOLERANCE_SECONDS
  );
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
