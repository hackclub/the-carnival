-- Add completed column to bounty_project table
ALTER TABLE "bounty_project" ADD COLUMN IF NOT EXISTS "completed" boolean NOT NULL DEFAULT false;

