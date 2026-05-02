CREATE TYPE "public"."shop_item_suggestion_status" AS ENUM('pending', 'approved', 'rejected');
--> statement-breakpoint
CREATE TABLE "shop_item_suggestion" (
  "id" text PRIMARY KEY NOT NULL,
  "submitted_by_user_id" text NOT NULL,
  "status" "shop_item_suggestion_status" DEFAULT 'pending' NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "image_url" text,
  "reference_url" text,
  "order_note_required" boolean DEFAULT false NOT NULL,
  "approved_hours_needed" integer NOT NULL,
  "token_cost" integer NOT NULL,
  "reviewed_by_id" text,
  "reviewed_at" timestamp,
  "rejection_reason" text,
  "approved_shop_item_id" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shop_item_suggestion" ADD CONSTRAINT "shop_item_suggestion_submitted_by_user_id_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shop_item_suggestion" ADD CONSTRAINT "shop_item_suggestion_reviewed_by_id_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shop_item_suggestion" ADD CONSTRAINT "shop_item_suggestion_approved_shop_item_id_shop_item_id_fk" FOREIGN KEY ("approved_shop_item_id") REFERENCES "public"."shop_item"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "unit_token_cost_snapshot" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE "shop_order" SET "quantity" = 1 WHERE "quantity" IS NULL;
--> statement-breakpoint
UPDATE "shop_order" SET "unit_token_cost_snapshot" = "token_cost_snapshot" WHERE "unit_token_cost_snapshot" = 0;
