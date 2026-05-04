CREATE TYPE "public"."devlog_assessment_decision" AS ENUM('accepted', 'rejected', 'adjusted');--> statement-breakpoint
ALTER TABLE "devlog" ADD COLUMN "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "devlog" ADD COLUMN "ended_at" timestamp;--> statement-breakpoint
ALTER TABLE "devlog" ADD COLUMN "duration_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "devlog" ADD COLUMN "attachments" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "devlog" ADD COLUMN "used_ai" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "devlog" ADD COLUMN "ai_usage_description" text;--> statement-breakpoint
ALTER TABLE "devlog" ADD COLUMN "hackatime_project_name_snapshot" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "devlog" ADD COLUMN "hackatime_pulled_at" timestamp;--> statement-breakpoint
-- Backfill started_at/ended_at for any legacy devlogs so the NOT NULL constraint can be enforced.
UPDATE "devlog" SET "started_at" = "created_at" WHERE "started_at" IS NULL;--> statement-breakpoint
UPDATE "devlog" SET "ended_at" = "created_at" WHERE "ended_at" IS NULL;--> statement-breakpoint
ALTER TABLE "devlog" ALTER COLUMN "started_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "devlog" ALTER COLUMN "ended_at" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "devlog_project_ended_at_idx" ON "devlog" USING btree ("project_id","ended_at");--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "hours_spent_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Seed project.hours_spent_seconds from any pre-existing devlog durations (all zero today, but safe).
UPDATE "project" p SET "hours_spent_seconds" = COALESCE((SELECT SUM(d.duration_seconds) FROM "devlog" d WHERE d.project_id = p.id), 0);--> statement-breakpoint
CREATE TABLE "peer_review_devlog_assessment" (
	"id" text PRIMARY KEY NOT NULL,
	"review_id" text NOT NULL,
	"devlog_id" text NOT NULL,
	"decision" "devlog_assessment_decision" NOT NULL,
	"adjusted_seconds" integer,
	"comment" text,
	"created_at" timestamp NOT NULL
);--> statement-breakpoint
ALTER TABLE "peer_review_devlog_assessment" ADD CONSTRAINT "peer_review_devlog_assessment_review_id_peer_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."peer_review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peer_review_devlog_assessment" ADD CONSTRAINT "peer_review_devlog_assessment_devlog_id_devlog_id_fk" FOREIGN KEY ("devlog_id") REFERENCES "public"."devlog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "peer_review_devlog_assessment_review_devlog_uniq" ON "peer_review_devlog_assessment" USING btree ("review_id","devlog_id");--> statement-breakpoint
CREATE INDEX "peer_review_devlog_assessment_review_created_at_idx" ON "peer_review_devlog_assessment" USING btree ("review_id","created_at");
