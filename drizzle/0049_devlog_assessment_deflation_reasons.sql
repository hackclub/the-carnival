ALTER TABLE "peer_review_devlog_assessment" ADD COLUMN "deflation_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL;
