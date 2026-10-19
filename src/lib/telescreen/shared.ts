/**
 * Telescreen (Robert) fraud review — client-safe half: score bands, the shape
 * the staff UI reads, and the grant gate. No DB or env access here.
 *
 * Robert scores each submission 1–10 (https://telescreen.hackclub.com/robert/docs):
 *   1–4  Fraud     final rejection, Carnival dismisses the project
 *   5–7  Doubtful  usually a deduction; the granting admin must acknowledge it
 *   8–10 Clean
 */
import type { TelescreenOutcomeStatus, TelescreenState } from "@/db/schema";

export type TelescreenBand = "fraud" | "doubtful" | "clean";

export const TELESCREEN_FRAUD_MAX_SCORE = 4;
export const TELESCREEN_DOUBTFUL_MAX_SCORE = 7;

export function telescreenBandForScore(score: number | null | undefined): TelescreenBand | null {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  if (score <= TELESCREEN_FRAUD_MAX_SCORE) return "fraud";
  if (score <= TELESCREEN_DOUBTFUL_MAX_SCORE) return "doubtful";
  return "clean";
}

export const TELESCREEN_BAND_LABELS: Record<TelescreenBand, string> = {
  fraud: "Fraud",
  doubtful: "Doubtful",
  clean: "Clean",
};

/** What the staff Telescreen panel renders for a project's current submission. */
export type TelescreenSubmissionView = {
  id: string;
  externalId: string;
  robertProjectId: string | null;
  state: TelescreenState;
  trustScore: number | null;
  band: TelescreenBand | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  creditedSeconds: number | null;
  outcomeStatus: TelescreenOutcomeStatus | null;
  outcomeReason: string | null;
  carnivalOutcome: TelescreenOutcomeStatus | null;
  carnivalOutcomeSentAt: string | null;
  sentAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  createdAt: string;
};

export type TelescreenGate =
  | { ok: true; needsDoubtfulAck: boolean }
  | { ok: false; code: TelescreenGateBlock; message: string };

export type TelescreenGateBlock =
  | "telescreen_not_sent"
  | "telescreen_awaiting_review"
  | "telescreen_fraud"
  | "telescreen_outcome_conflict";

/**
 * May this project be granted, as far as fraud review goes? `submission` is the
 * project's current (latest) Telescreen row, or null when none exists.
 * When the integration is disabled (no API key) every project passes.
 */
export function evaluateTelescreenGrantGate(input: {
  enabled: boolean;
  submission: Pick<TelescreenSubmissionView, "state" | "trustScore" | "outcomeStatus"> | null;
}): TelescreenGate {
  if (!input.enabled) return { ok: true, needsDoubtfulAck: false };
  const s = input.submission;
  if (!s || s.state === "pending") {
    return {
      ok: false,
      code: "telescreen_not_sent",
      message: "This submission hasn't reached Telescreen yet. Send it, then wait for the fraud review.",
    };
  }
  if (s.state === "awaiting_review") {
    return {
      ok: false,
      code: "telescreen_awaiting_review",
      message: "Waiting on the Telescreen fraud review. Projects can only be granted once they're scored.",
    };
  }
  const band = telescreenBandForScore(s.trustScore);
  if (s.state === "rejected_fraud" || band === "fraud") {
    return {
      ok: false,
      code: "telescreen_fraud",
      message: "Telescreen rejected this submission as fraud. It can't be granted.",
    };
  }
  if (s.state === "decided" && s.outcomeStatus === "rejected") {
    return {
      ok: false,
      code: "telescreen_outcome_conflict",
      message: "This submission is already recorded as rejected in Telescreen.",
    };
  }
  return { ok: true, needsDoubtfulAck: band === "doubtful" };
}

/** Copy the creator sees when a fraud review dismisses their project. */
export const TELESCREEN_FRAUD_CREATOR_MESSAGE =
  "Your project didn't pass Hack Club's fraud review, so it has been rejected and can't be resubmitted. If you believe this is a mistake, contact an organizer.";
