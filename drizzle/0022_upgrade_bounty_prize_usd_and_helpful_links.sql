-- Move bounty prize storage back to USD and preserve existing values.
ALTER TABLE "bounty_project"
  RENAME COLUMN "prize_tokens" TO "prize_usd";

-- Helpful links are stored as label + URL pairs in JSON.
ALTER TABLE "bounty_project"
  ADD COLUMN "helpful_links" jsonb NOT NULL DEFAULT '[]'::jsonb;
