-- Store the admin-authored reason shown to the creator when a project is dismissed.

ALTER TABLE "project"
  ADD COLUMN IF NOT EXISTS "resubmission_blocked_reason" text;
