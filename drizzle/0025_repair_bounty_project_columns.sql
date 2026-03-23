-- Repair bounty_project schema drift on databases that were left on prize_tokens
-- or missed the helpful_links/completed additions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bounty_project'
      AND column_name = 'prize_usd'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bounty_project'
      AND column_name = 'prize_tokens'
  ) THEN
    RAISE EXCEPTION 'bounty_project is missing both prize_usd and prize_tokens';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bounty_project'
      AND column_name = 'prize_tokens'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bounty_project'
      AND column_name = 'prize_usd'
  ) THEN
    EXECUTE 'ALTER TABLE "bounty_project" RENAME COLUMN "prize_tokens" TO "prize_usd"';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bounty_project'
      AND column_name = 'helpful_links'
  ) THEN
    EXECUTE 'ALTER TABLE "bounty_project" ADD COLUMN "helpful_links" jsonb NOT NULL DEFAULT ''[]''::jsonb';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bounty_project'
      AND column_name = 'completed'
  ) THEN
    EXECUTE 'ALTER TABLE "bounty_project" ADD COLUMN "completed" boolean NOT NULL DEFAULT false';
  END IF;
END $$;
