-- Guard databases that were stamped past earlier bounty repair migrations
-- while still missing helpful_links.
ALTER TABLE "bounty_project"
  ADD COLUMN IF NOT EXISTS "helpful_links" jsonb NOT NULL DEFAULT '[]'::jsonb;
