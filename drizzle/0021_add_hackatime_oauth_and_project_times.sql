ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "hackatime_user_id" text,
  ADD COLUMN IF NOT EXISTS "hackatime_access_token" text,
  ADD COLUMN IF NOT EXISTS "hackatime_scope" text,
  ADD COLUMN IF NOT EXISTS "hackatime_connected_at" timestamp;

ALTER TABLE "project"
  ADD COLUMN IF NOT EXISTS "hackatime_started_at" timestamp,
  ADD COLUMN IF NOT EXISTS "hackatime_stopped_at" timestamp,
  ADD COLUMN IF NOT EXISTS "hackatime_total_seconds" integer;
