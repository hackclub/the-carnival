-- Persist reviewer justification/houring evidence and creator originality declaration.

ALTER TABLE "peer_review"
  ADD COLUMN IF NOT EXISTS "review_evidence_checklist" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "reviewed_hackatime_range_start" timestamp,
  ADD COLUMN IF NOT EXISTS "reviewed_hackatime_range_end" timestamp,
  ADD COLUMN IF NOT EXISTS "hour_adjustment_reason_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "project"
  ADD COLUMN IF NOT EXISTS "creator_declared_originality" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "creator_duplicate_explanation" text,
  ADD COLUMN IF NOT EXISTS "creator_originality_rationale" text;
