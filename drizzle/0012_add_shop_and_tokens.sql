-- Shop items
CREATE TABLE IF NOT EXISTS "shop_item" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "image_url" text NOT NULL,
  "approved_hours_needed" integer NOT NULL,
  "token_cost" integer NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- Token ledger
DO $$ BEGIN
  CREATE TYPE "token_update_kind" AS ENUM ('issue', 'deduct');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "token_ledger" (
  "id" text PRIMARY KEY NOT NULL,
  "kind" "token_update_kind" NOT NULL,
  "tokens" integer NOT NULL,
  "reason" text NOT NULL,
  "issued_to_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "reference_type" text,
  "reference_id" text,
  "created_at" timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "token_ledger_ref_kind_uniq"
  ON "token_ledger" ("reference_type", "reference_id", "kind");

-- Shop orders
DO $$ BEGIN
  CREATE TYPE "shop_order_status" AS ENUM ('pending', 'fulfilled', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "shop_order" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "status" "shop_order_status" NOT NULL DEFAULT 'pending',
  "shop_item_id" text NOT NULL REFERENCES "shop_item"("id") ON DELETE RESTRICT,
  "item_name_snapshot" text NOT NULL,
  "item_image_snapshot" text NOT NULL,
  "token_cost_snapshot" integer NOT NULL,
  "fulfillment_link" text,
  "fulfilled_by_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "fulfilled_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

