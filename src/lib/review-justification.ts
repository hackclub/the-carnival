import type { ReviewDecision } from "@/db/schema";
import { toIsoDateOnly as toIsoDateOnlyShared } from "@/lib/hackatime-range";
import {
  asRecord,
  normalizeDeflationReasons,
  toCleanString,
  REVIEW_EVIDENCE_ITEMS,
  type ReviewEvidenceChecklist,
  type ReviewJustificationPayload,
} from "@/lib/review-rules";

type StructuredReviewJustificationInput = {
  decision: ReviewDecision;
  fallbackHackatimeProjectName?: string | null;
  reviewJustification?: unknown;
  reviewEvidenceChecklist?: unknown;
  reviewedHackatimeRangeStart?: Date | string | null;
  reviewedHackatimeRangeEnd?: Date | string | null;
  hourAdjustmentReasonMetadata?: unknown;
};

function isReviewDecision(value: unknown): value is Exclude<ReviewDecision, "comment"> {
  return value === "approved" || value === "rejected";
}

function toReviewDateOnly(value: unknown) {
  if (value instanceof Date || typeof value === "string") {
    return toIsoDateOnlyShared(value);
  }
  return null;
}

function toNonNegativeNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value * 1000) / 1000);
}

function normalizeEvidence(value: unknown): ReviewEvidenceChecklist {
  const root = asRecord(value);
  const next = {} as ReviewEvidenceChecklist;
  for (const item of REVIEW_EVIDENCE_ITEMS) {
    next[item.key] = root?.[item.key] === true;
  }
  return next;
}

function hasStructuredJustificationValue(input: StructuredReviewJustificationInput) {
  const evidence = normalizeEvidence(input.reviewEvidenceChecklist);
  const hasAnyEvidence = REVIEW_EVIDENCE_ITEMS.some((item) => evidence[item.key]);
  const hasStart = Boolean(toReviewDateOnly(input.reviewedHackatimeRangeStart));
  const hasEnd = Boolean(toReviewDateOnly(input.reviewedHackatimeRangeEnd));
  const metadata = asRecord(input.hourAdjustmentReasonMetadata);
  const hasMetadata = Boolean(metadata && Object.keys(metadata).length > 0);
  return hasAnyEvidence || hasStart || hasEnd || hasMetadata;
}

export function coerceReviewJustificationPayload(
  value: unknown,
): ReviewJustificationPayload | null {
  const root = asRecord(value);
  if (!root) return null;

  const decision = toCleanString(root.decision);
  if (!isReviewDecision(decision)) return null;

  const hackatimeProjectName = toCleanString(root.hackatimeProjectName);
  if (!hackatimeProjectName) return null;

  const reviewDateRange = asRecord(root.reviewDateRange);
  const startDate = toReviewDateOnly(reviewDateRange?.startDate);
  const endDate = toReviewDateOnly(reviewDateRange?.endDate);
  if (!startDate || !endDate) return null;

  const deflationRoot = asRecord(root.deflation);
  const hoursReducedBy = toNonNegativeNumber(deflationRoot?.hoursReducedBy);
  const reduced = deflationRoot?.reduced === true || hoursReducedBy > 0;

  return {
    decision,
    hackatimeProjectName,
    evidence: normalizeEvidence(root.evidence),
    reviewDateRange: {
      startDate,
      endDate,
    },
    deflation: {
      reduced,
      hoursReducedBy: reduced ? hoursReducedBy : 0,
      reasons: reduced ? normalizeDeflationReasons(deflationRoot?.reasons) : [],
      note: toCleanString(deflationRoot?.note) || null,
      reasonRequired: deflationRoot?.reasonRequired === true,
    },
  };
}

export function hydrateReviewJustification(input: StructuredReviewJustificationInput) {
  const existing = coerceReviewJustificationPayload(input.reviewJustification);
  if (existing) return existing;

  if (!isReviewDecision(input.decision)) return null;
  if (!hasStructuredJustificationValue(input)) return null;

  const metadata = asRecord(input.hourAdjustmentReasonMetadata);
  const decision = isReviewDecision(metadata?.decision) ? metadata.decision : input.decision;
  const hackatimeProjectName =
    toCleanString(metadata?.hackatimeProjectName) ||
    toCleanString(input.fallbackHackatimeProjectName);
  const startDate = toReviewDateOnly(input.reviewedHackatimeRangeStart);
  const endDate = toReviewDateOnly(input.reviewedHackatimeRangeEnd);
  if (!hackatimeProjectName || !startDate || !endDate) return null;

  const hoursReducedBy = toNonNegativeNumber(metadata?.hoursReducedBy);
  const reduced = metadata?.reduced === true || hoursReducedBy > 0;

  return {
    decision,
    hackatimeProjectName,
    evidence: normalizeEvidence(input.reviewEvidenceChecklist),
    reviewDateRange: {
      startDate,
      endDate,
    },
    deflation: {
      reduced,
      hoursReducedBy: reduced ? hoursReducedBy : 0,
      reasons: reduced ? normalizeDeflationReasons(metadata?.reasons) : [],
      note: toCleanString(metadata?.note) || null,
      reasonRequired: metadata?.reasonRequired === true,
    },
  } satisfies ReviewJustificationPayload;
}
