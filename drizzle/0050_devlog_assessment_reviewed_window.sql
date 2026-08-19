ALTER TABLE "peer_review_devlog_assessment" ADD COLUMN "reviewed_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "peer_review_devlog_assessment" ADD COLUMN "reviewed_ended_at" timestamp;--> statement-breakpoint
ALTER TABLE "peer_review_devlog_assessment" ADD COLUMN "reviewed_window_seconds" integer;
