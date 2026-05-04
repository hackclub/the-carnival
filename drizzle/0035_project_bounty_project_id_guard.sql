-- Idempotent guard: some databases were baselined or migrated without 0034 applied fully,
-- leaving `project.bounty_project_id` missing while the app schema expects it.
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "bounty_project_id" text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'project'
      AND c.conname = 'project_bounty_project_id_bounty_project_id_fk'
  ) THEN
    ALTER TABLE "project"
      ADD CONSTRAINT "project_bounty_project_id_bounty_project_id_fk"
      FOREIGN KEY ("bounty_project_id") REFERENCES "public"."bounty_project"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;
