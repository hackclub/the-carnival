DO $$ BEGIN
  CREATE TYPE "public"."bounty_project_status" AS ENUM('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "bounty_project"
  ADD COLUMN IF NOT EXISTS "status" "public"."bounty_project_status" NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS "preview_image_url" text,
  ADD COLUMN IF NOT EXISTS "requirements" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "examples" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "reviewed_by_id" text,
  ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp,
  ADD COLUMN IF NOT EXISTS "rejection_reason" text;

DO $$ BEGIN
  ALTER TABLE "bounty_project"
    ADD CONSTRAINT "bounty_project_reviewed_by_id_user_id_fk"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "bounty_project_status_created_at_idx"
  ON "bounty_project" ("status", "created_at");
