-- Rename bounty prize from USD to tokens
-- Keep existing integer values as-is (just a semantic rename).
ALTER TABLE "bounty_project"
  RENAME COLUMN "prize_usd" TO "prize_tokens";

