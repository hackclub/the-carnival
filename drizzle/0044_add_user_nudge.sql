CREATE TYPE "public"."nudge_channel" AS ENUM('slack', 'email');--> statement-breakpoint
CREATE TABLE "user_nudge" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"channel" "nudge_channel" NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"sent_by_user_id" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_nudge" ADD CONSTRAINT "user_nudge_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_nudge" ADD CONSTRAINT "user_nudge_sent_by_user_id_user_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_nudge_user_created_at_idx" ON "user_nudge" USING btree ("user_id","created_at");
