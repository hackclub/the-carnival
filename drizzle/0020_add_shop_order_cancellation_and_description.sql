-- Store item description on order and support denial metadata
ALTER TABLE "shop_order"
  ADD COLUMN IF NOT EXISTS "item_description_snapshot" text,
  ADD COLUMN IF NOT EXISTS "cancellation_reason" text,
  ADD COLUMN IF NOT EXISTS "cancelled_by_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp;

