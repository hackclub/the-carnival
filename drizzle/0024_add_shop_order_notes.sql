-- Add optional order notes and per-item note requirement settings
ALTER TABLE "shop_item"
  ADD COLUMN IF NOT EXISTS "order_note_required" boolean NOT NULL DEFAULT false;

ALTER TABLE "shop_order"
  ADD COLUMN IF NOT EXISTS "order_note" text;
