CREATE TYPE "public"."announcement_variant" AS ENUM('carnival', 'info', 'success', 'warning');--> statement-breakpoint
CREATE TABLE "announcement" (
	"id" text PRIMARY KEY NOT NULL,
	"message" text NOT NULL,
	"href" text,
	"link_label" text,
	"variant" "announcement_variant" DEFAULT 'carnival' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_by_user_id" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcement_active_created_at_idx" ON "announcement" USING btree ("is_active","created_at");
