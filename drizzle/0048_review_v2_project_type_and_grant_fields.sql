CREATE TYPE "public"."project_type" AS ENUM('extension-plugin', 'website-webapp', 'game-web', 'game-downloadable', 'mobile-app', 'desktop-app', 'cli', 'library', 'hardware', 'other');--> statement-breakpoint
ALTER TYPE "public"."project_editor" ADD VALUE IF NOT EXISTS 'minecraft';--> statement-breakpoint
ALTER TYPE "public"."project_editor" ADD VALUE IF NOT EXISTS 'discord';--> statement-breakpoint
ALTER TYPE "public"."project_editor" ADD VALUE IF NOT EXISTS 'slack';--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "project_type" "project_type" DEFAULT 'extension-plugin' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "airtable_record_id" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "grant_technical_justification" text;--> statement-breakpoint
ALTER TABLE "peer_review" ADD COLUMN "specific_technical_features" text;--> statement-breakpoint
ALTER TABLE "peer_review" ADD COLUMN "rejection_category" text;
