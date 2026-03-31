-- Wave 4: admin safety tooling and visibility
-- - frozen-account flags on user
-- - append-only admin audit log

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "is_frozen" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "frozen_reason" text,
  ADD COLUMN IF NOT EXISTS "frozen_at" timestamp,
  ADD COLUMN IF NOT EXISTS "frozen_by_user_id" text;

CREATE TABLE IF NOT EXISTS "admin_audit_log" (
  "id" text PRIMARY KEY NOT NULL,
  "actor_id" text,
  "actor_role" user_role NOT NULL,
  "action" text NOT NULL,
  "target_user_id" text,
  "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL,
  CONSTRAINT "admin_audit_log_actor_id_user_id_fk"
    FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "admin_audit_log_target_user_id_user_id_fk"
    FOREIGN KEY ("target_user_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "admin_audit_log_actor_created_at_idx"
  ON "admin_audit_log" ("actor_id", "created_at");

CREATE INDEX IF NOT EXISTS "admin_audit_log_target_created_at_idx"
  ON "admin_audit_log" ("target_user_id", "created_at");

CREATE INDEX IF NOT EXISTS "admin_audit_log_action_created_at_idx"
  ON "admin_audit_log" ("action", "created_at");
