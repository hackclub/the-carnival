-- Adds Hack Club Identity fields to the `user` table.
-- Safe to run multiple times.

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "slack_id" text,
  ADD COLUMN IF NOT EXISTS "verification_status" text,
  ADD COLUMN IF NOT EXISTS "identity_token" text,
  ADD COLUMN IF NOT EXISTS "refresh_token" text;




