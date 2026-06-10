ALTER TABLE "peer_review_devlog_assessment" ADD COLUMN "hackatime_project_adjustments" jsonb DEFAULT '[]'::jsonb NOT NULL;
