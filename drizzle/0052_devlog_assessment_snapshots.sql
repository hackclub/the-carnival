-- Freeze reviews in time: per-devlog assessments must survive devlog
-- deletion and must not drift when a devlog is later edited.
-- 1) devlog_id becomes nullable with ON DELETE SET NULL (was CASCADE).
ALTER TABLE "peer_review_devlog_assessment" DROP CONSTRAINT "peer_review_devlog_assessment_devlog_id_devlog_id_fk";--> statement-breakpoint
ALTER TABLE "peer_review_devlog_assessment" ALTER COLUMN "devlog_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "peer_review_devlog_assessment" ADD CONSTRAINT "peer_review_devlog_assessment_devlog_id_devlog_id_fk" FOREIGN KEY ("devlog_id") REFERENCES "public"."devlog"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- 2) Snapshot of the devlog as the reviewer saw it, captured at review-submit time.
ALTER TABLE "peer_review_devlog_assessment" ADD COLUMN "devlog_title_snapshot" text;--> statement-breakpoint
ALTER TABLE "peer_review_devlog_assessment" ADD COLUMN "devlog_duration_seconds_snapshot" integer;--> statement-breakpoint
ALTER TABLE "peer_review_devlog_assessment" ADD COLUMN "devlog_started_at_snapshot" timestamp;--> statement-breakpoint
ALTER TABLE "peer_review_devlog_assessment" ADD COLUMN "devlog_ended_at_snapshot" timestamp;--> statement-breakpoint
-- 3) Backfill existing assessments from the current devlog rows (best available data).
UPDATE "peer_review_devlog_assessment" a
SET
  "devlog_title_snapshot" = d."title",
  "devlog_duration_seconds_snapshot" = d."duration_seconds",
  "devlog_started_at_snapshot" = d."started_at",
  "devlog_ended_at_snapshot" = d."ended_at"
FROM "devlog" d
WHERE a."devlog_id" = d."id";
