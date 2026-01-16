-- Track when a creator submits their project for review (status transitions to in-review)
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "submitted_at" timestamp;

