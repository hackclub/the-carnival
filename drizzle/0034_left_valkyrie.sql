-- Idempotent replay: safe when objects already exist (partial apply / drift / empty migrations journal).
DO $$ BEGIN
  CREATE TYPE "public"."devlog_assessment_decision" AS ENUM('accepted', 'rejected', 'adjusted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "peer_review_devlog_assessment" (
	"id" text PRIMARY KEY NOT NULL,
	"review_id" text NOT NULL,
	"devlog_id" text NOT NULL,
	"decision" "devlog_assessment_decision" NOT NULL,
	"adjusted_seconds" integer,
	"comment" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "devlog" ADD COLUMN IF NOT EXISTS "started_at" timestamp NOT NULL;
--> statement-breakpoint
ALTER TABLE "devlog" ADD COLUMN IF NOT EXISTS "ended_at" timestamp NOT NULL;
--> statement-breakpoint
ALTER TABLE "devlog" ADD COLUMN IF NOT EXISTS "duration_seconds" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "devlog" ADD COLUMN IF NOT EXISTS "attachments" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "devlog" ADD COLUMN IF NOT EXISTS "used_ai" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "devlog" ADD COLUMN IF NOT EXISTS "ai_usage_description" text;
--> statement-breakpoint
ALTER TABLE "devlog" ADD COLUMN IF NOT EXISTS "hackatime_project_name_snapshot" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "devlog" ADD COLUMN IF NOT EXISTS "hackatime_pulled_at" timestamp;
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "resubmission_blocked" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "resubmission_blocked_at" timestamp;
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "resubmission_blocked_by" text;
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "resubmission_blocked_reason" text;
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "hours_spent_seconds" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "bounty_project_id" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "peer_review_devlog_assessment" ADD CONSTRAINT "peer_review_devlog_assessment_review_id_peer_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."peer_review"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "peer_review_devlog_assessment" ADD CONSTRAINT "peer_review_devlog_assessment_devlog_id_devlog_id_fk" FOREIGN KEY ("devlog_id") REFERENCES "public"."devlog"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "peer_review_devlog_assessment_review_devlog_uniq" ON "peer_review_devlog_assessment" USING btree ("review_id","devlog_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "peer_review_devlog_assessment_review_created_at_idx" ON "peer_review_devlog_assessment" USING btree ("review_id","created_at");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "project" ADD CONSTRAINT "project_resubmission_blocked_by_user_id_fk" FOREIGN KEY ("resubmission_blocked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "project" ADD CONSTRAINT "project_bounty_project_id_bounty_project_id_fk" FOREIGN KEY ("bounty_project_id") REFERENCES "public"."bounty_project"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "devlog_project_ended_at_idx" ON "devlog" USING btree ("project_id","ended_at");
