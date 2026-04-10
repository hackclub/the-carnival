import type { ReviewDecision } from "@/db/schema";
import { isIsoDateOnly } from "@/lib/hackatime-range";

const HALF_HOUR_EPSILON = 1e-9;
const APPROVED_HOUR_INCREMENT = 0.1;
const APPROVED_HOUR_MULTIPLIER = 1 / APPROVED_HOUR_INCREMENT;
const APPROVED_HOUR_SECONDS = 60 * 60 * APPROVED_HOUR_INCREMENT;
const DEFALTION_REASON_THRESHOLD_HOURS = 0.5;
export const REVIEW_EVIDENCE_ITEMS = [
  { key: "hackatimeProjectReviewed", label: "Hackatime project reviewed" },
  { key: "githubReviewed", label: "GitHub project and commit messages reviewed" },
  { key: "sourceCodeReviewed", label: "Source code reviewed" },
  { key: "demoReviewed", label: "Demo/video reviewed" },
  { key: "manualTestPerformed", label: "Manual test performed" },
] as const;

export type ReviewEvidenceKey = (typeof REVIEW_EVIDENCE_ITEMS)[number]["key"];
export type ReviewEvidenceChecklist = Record<ReviewEvidenceKey, boolean>;

export const REVIEW_DEFLATION_REASON_OPTIONS = [
  { key: "nonProjectOrIdleTime", label: "Hackatime included non-project or idle time" },
  { key: "scopeCouldNotBeVerified", label: "Some claimed work could not be verified" },
  { key: "lessSubstantiveWork", label: "Delivered work was less substantive than logged time" },
  { key: "qualityOrBreakages", label: "Quality issues reduced accepted hours" },
  { key: "other", label: "Other (add context in note)" },
] as const;

export type ReviewDeflationReason = (typeof REVIEW_DEFLATION_REASON_OPTIONS)[number]["key"];

export type ReviewDateRange = {
  startDate: string;
  endDate: string;
};

export type ReviewJustificationDraft = {
  hackatimeProjectName: string;
  evidence: ReviewEvidenceChecklist;
  reviewDateRange: ReviewDateRange;
  deflationReasons: ReviewDeflationReason[];
  deflationNote: string;
};

export type ReviewJustificationPayload = {
  decision: Exclude<ReviewDecision, "comment">;
  hackatimeProjectName: string;
  evidence: ReviewEvidenceChecklist;
  reviewDateRange: ReviewDateRange;
  deflation: {
    reduced: boolean;
    hoursReducedBy: number;
    reasons: ReviewDeflationReason[];
    note: string | null;
    reasonRequired: boolean;
  };
};

const DEFAULT_REVIEW_EVIDENCE: ReviewEvidenceChecklist = {
  hackatimeProjectReviewed: false,
  githubReviewed: false,
  sourceCodeReviewed: false,
  demoReviewed: false,
  manualTestPerformed: false,
};

const REVIEW_DEFLATION_REASON_SET = new Set<ReviewDeflationReason>(
  REVIEW_DEFLATION_REASON_OPTIONS.map((option) => option.key),
);

type ValidationResult =
  | { ok: true; value: ReviewJustificationPayload }
  | { ok: false; error: string };

export function isApprovedHourIncrement(value: number) {
  const scaled = value * APPROVED_HOUR_MULTIPLIER;
  return Math.abs(scaled - Math.round(scaled)) < HALF_HOUR_EPSILON;
}

export function normalizeApprovedHours(value: number | null) {
  if (!Number.isFinite(value)) return null;
  const raw = value as number;
  if (raw <= 0) return null;
  if (!isApprovedHourIncrement(raw)) return null;
  return Math.round(raw * APPROVED_HOUR_MULTIPLIER) / APPROVED_HOUR_MULTIPLIER;
}

export function normalizeSnapshotSeconds(value: number | null) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value as number));
}

export function maxApprovedHoursForSnapshot(snapshotSeconds: number) {
  return Math.floor(snapshotSeconds / APPROVED_HOUR_SECONDS) / APPROVED_HOUR_MULTIPLIER;
}

export function approvedHoursWithinSnapshot(approvedHours: number, snapshotSeconds: number) {
  return approvedHours <= maxApprovedHoursForSnapshot(snapshotSeconds) + HALF_HOUR_EPSILON;
}

export function buildDefaultReviewJustificationDraft(input: {
  hackatimeProjectName: string;
  startDate: string;
  endDate: string;
}): ReviewJustificationDraft {
  const startDate = isIsoDateOnly(input.startDate) ? input.startDate : "";
  const endDate = isIsoDateOnly(input.endDate) ? input.endDate : "";

  return {
    hackatimeProjectName: toCleanString(input.hackatimeProjectName),
    evidence: { ...DEFAULT_REVIEW_EVIDENCE },
    reviewDateRange: { startDate, endDate },
    deflationReasons: [],
    deflationNote: "",
  };
}

export function buildReviewJustificationRequest(
  draft: ReviewJustificationDraft,
  input?: { hackatimeProjectName?: string },
): ReviewJustificationDraft {
  const hackatimeProjectName =
    toCleanString(input?.hackatimeProjectName) || draft.hackatimeProjectName;

  return {
    hackatimeProjectName,
    evidence: { ...draft.evidence },
    reviewDateRange: { ...draft.reviewDateRange },
    deflationReasons: [...draft.deflationReasons],
    deflationNote: draft.deflationNote,
  };
}

export function calculateHoursReduction(loggedHackatimeHours: number | null, approvedHours: number | null) {
  if (!Number.isFinite(loggedHackatimeHours) || !Number.isFinite(approvedHours)) return 0;
  const reduction = (loggedHackatimeHours as number) - (approvedHours as number);
  if (reduction <= HALF_HOUR_EPSILON) return 0;
  return Math.round(reduction * 1000) / 1000;
}

export function requiresDeflationReason(loggedHackatimeHours: number | null, approvedHours: number | null) {
  return calculateHoursReduction(loggedHackatimeHours, approvedHours) + HALF_HOUR_EPSILON >= DEFALTION_REASON_THRESHOLD_HOURS;
}

export function validateRequiredReviewJustification(input: {
  value: unknown;
  decision: Exclude<ReviewDecision, "comment">;
  expectedHackatimeProjectName: string;
  approvedHours: number | null;
  loggedHackatimeHours: number | null;
}): ValidationResult {
  const root = asRecord(input.value);
  if (!root) {
    return {
      ok: false,
      error: "Complete the reviewer confirmation checklist before submitting.",
    };
  }

  const expectedHackatimeProjectName = toCleanString(input.expectedHackatimeProjectName);
  const hackatimeProjectName =
    toCleanString(root.hackatimeProjectName) || expectedHackatimeProjectName;
  if (!hackatimeProjectName) {
    return { ok: false, error: "Hackatime project name is required in reviewer confirmation." };
  }
  if (
    expectedHackatimeProjectName &&
    hackatimeProjectName.toLowerCase() !== expectedHackatimeProjectName.toLowerCase()
  ) {
    return {
      ok: false,
      error: "Hackatime project confirmation must include the exact project name reviewed.",
    };
  }

  const evidenceRoot = asRecord(root.evidence);
  if (!evidenceRoot) {
    return { ok: false, error: "Evidence checklist is required for approval/rejection." };
  }

  const missingEvidence: string[] = [];
  const evidence = { ...DEFAULT_REVIEW_EVIDENCE };
  for (const item of REVIEW_EVIDENCE_ITEMS) {
    const checked = evidenceRoot[item.key] === true;
    evidence[item.key] = checked;
    if (!checked) {
      missingEvidence.push(item.label);
    }
  }
  if (missingEvidence.length > 0) {
    return {
      ok: false,
      error: `Confirm all reviewer evidence checks before submitting. Missing: ${missingEvidence.join(", ")}.`,
    };
  }

  const dateRangeRoot = asRecord(root.reviewDateRange);
  if (!dateRangeRoot) {
    return { ok: false, error: "Review date range is required for approval/rejection." };
  }
  const startDate = toCleanString(dateRangeRoot.startDate);
  const endDate = toCleanString(dateRangeRoot.endDate);
  if (!isIsoDateOnly(startDate) || !isIsoDateOnly(endDate)) {
    return {
      ok: false,
      error: "Select both review start and end dates (YYYY-MM-DD).",
    };
  }
  if (startDate > endDate) {
    return {
      ok: false,
      error: "Review date range is invalid: start date must be before or equal to end date.",
    };
  }

  const { reasons, note } = resolveDeflationInput(root);

  const reduction =
    input.decision === "approved"
      ? calculateHoursReduction(input.loggedHackatimeHours, input.approvedHours)
      : 0;
  const reasonRequired =
    input.decision === "approved"
      ? requiresDeflationReason(input.loggedHackatimeHours, input.approvedHours)
      : false;
  if (reasonRequired && reasons.length === 0) {
    return {
      ok: false,
      error:
        "Approved hours are at least 0.5 lower than Hackatime hours. Select at least one deflation reason.",
    };
  }
  if (reduction > HALF_HOUR_EPSILON && reasons.includes("other") && !note) {
    return {
      ok: false,
      error: "Add a deflation note when selecting Other.",
    };
  }

  return {
    ok: true,
    value: {
      decision: input.decision,
      hackatimeProjectName,
      evidence,
      reviewDateRange: { startDate, endDate },
      deflation: {
        reduced: reduction > HALF_HOUR_EPSILON,
        hoursReducedBy: reduction > HALF_HOUR_EPSILON ? Math.round(reduction * 1000) / 1000 : 0,
        reasons: reduction > HALF_HOUR_EPSILON ? reasons : [],
        note,
        reasonRequired,
      },
    },
  };
}

function normalizeDeflationReasons(value: unknown): ReviewDeflationReason[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<ReviewDeflationReason>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    if (!REVIEW_DEFLATION_REASON_SET.has(item as ReviewDeflationReason)) continue;
    unique.add(item as ReviewDeflationReason);
  }
  return Array.from(unique);
}

function resolveDeflationInput(root: Record<string, unknown>) {
  const deflationRoot = asRecord(root.deflation);
  const hasDraftReasons = hasOwn(root, "deflationReasons");
  const hasDraftNote = hasOwn(root, "deflationNote");

  const reasons = hasDraftReasons
    ? normalizeDeflationReasons(root.deflationReasons)
    : normalizeDeflationReasons(deflationRoot?.reasons);
  const noteValue = hasDraftNote ? root.deflationNote : deflationRoot?.note;

  return {
    reasons,
    note: toCleanString(noteValue) || null,
  };
}

function toCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}
