-- Track whether an admin has dismissed a project so its creator cannot resubmit it for review.

ALTER TABLE "project"
  ADD COLUMN IF NOT EXISTS "resubmission_blocked" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "resubmission_blocked_at" timestamp,
  ADD COLUMN IF NOT EXISTS "resubmission_blocked_by" text;

ALTER TABLE "project"
  DROP CONSTRAINT IF EXISTS "project_resubmission_blocked_by_user_id_fk";

ALTER TABLE "project"
  ADD CONSTRAINT "project_resubmission_blocked_by_user_id_fk"
    FOREIGN KEY ("resubmission_blocked_by") REFERENCES "user"("id") ON DELETE SET NULL;
