DO $$ BEGIN
  CREATE TYPE "user_role" AS ENUM ('user', 'reviewer', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "role" "user_role" NOT NULL DEFAULT 'user';

DO $$ BEGIN
  CREATE TYPE "review_decision" AS ENUM ('approved', 'rejected', 'comment');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "peer_review"
  ADD COLUMN IF NOT EXISTS "decision" "review_decision" NOT NULL DEFAULT 'comment';


