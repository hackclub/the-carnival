-- Wave 2 review workflow persistence updates:
-- - decimal approved hours (0.5 increments)
-- - persisted Hackatime snapshot on peer review
-- - non-exclusive reviewer self-assignment table
-- - append-only review audit log

ALTER TABLE "project"
  ALTER COLUMN "approved_hours" TYPE numeric(6,1)
  USING "approved_hours"::numeric;

ALTER TABLE "peer_review"
  ALTER COLUMN "approved_hours" TYPE numeric(6,1)
  USING "approved_hours"::numeric;

ALTER TABLE "peer_review"
  ADD COLUMN IF NOT EXISTS "hackatime_snapshot_seconds" integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "project_reviewer_assignment" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "project"("id") ON DELETE cascade,
  "reviewer_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "created_at" timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_reviewer_assignment_project_reviewer_uniq"
  ON "project_reviewer_assignment" ("project_id", "reviewer_id");

CREATE INDEX IF NOT EXISTS "project_reviewer_assignment_project_created_at_idx"
  ON "project_reviewer_assignment" ("project_id", "created_at");

CREATE TABLE IF NOT EXISTS "review_audit_log" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "project"("id") ON DELETE cascade,
  "review_id" text REFERENCES "peer_review"("id") ON DELETE set null,
  "actor_id" text REFERENCES "user"("id") ON DELETE set null,
  "actor_role" "user_role" NOT NULL,
  "action" text NOT NULL,
  "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "review_audit_log_project_created_at_idx"
  ON "review_audit_log" ("project_id", "created_at");

CREATE INDEX IF NOT EXISTS "review_audit_log_actor_created_at_idx"
  ON "review_audit_log" ("actor_id", "created_at");
