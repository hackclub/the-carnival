CREATE TABLE IF NOT EXISTS "bounty_project" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "prize_usd" integer NOT NULL,
  "created_by_id" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "bounty_claim" (
  "id" text PRIMARY KEY NOT NULL,
  "bounty_project_id" text NOT NULL REFERENCES "bounty_project"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "slot" integer NOT NULL,
  "created_at" timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "bounty_claim_project_slot_uniq"
  ON "bounty_claim" ("bounty_project_id", "slot");

CREATE UNIQUE INDEX IF NOT EXISTS "bounty_claim_project_user_uniq"
  ON "bounty_claim" ("bounty_project_id", "user_id");


