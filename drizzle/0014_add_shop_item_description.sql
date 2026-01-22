-- Shop item short description (optional)
ALTER TABLE "shop_item"
  ADD COLUMN IF NOT EXISTS "description" text;

