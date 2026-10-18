-- Admin outreach: exclusion list, admin-triggered sends, per-recipient results.
CREATE TYPE "public"."outreach_send_kind" AS ENUM('custom', 'automated');--> statement-breakpoint
CREATE TYPE "public"."outreach_send_status" AS ENUM('running', 'completed', 'failed', 'interrupted');--> statement-breakpoint
CREATE TYPE "public"."outreach_recipient_status" AS ENUM('pending', 'sent', 'skipped', 'failed');--> statement-breakpoint
CREATE TABLE "nudge_exclusion" (
	"slack_id" text PRIMARY KEY NOT NULL,
	"note" text,
	"added_by_user_id" text,
	"created_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE TABLE "outreach_send" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "outreach_send_kind" NOT NULL,
	"channel" "nudge_channel" NOT NULL,
	"message" text,
	"created_by_user_id" text,
	"status" "outreach_send_status" DEFAULT 'running' NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"finished_at" timestamp
);--> statement-breakpoint
CREATE TABLE "outreach_recipient" (
	"id" text PRIMARY KEY NOT NULL,
	"send_id" text NOT NULL,
	"user_id" text,
	"name" text,
	"slack_id" text,
	"email" text,
	"status" "outreach_recipient_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"sent_at" timestamp,
	"created_at" timestamp NOT NULL
);--> statement-breakpoint
ALTER TABLE "nudge_exclusion" ADD CONSTRAINT "nudge_exclusion_added_by_user_id_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_send" ADD CONSTRAINT "outreach_send_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_recipient" ADD CONSTRAINT "outreach_recipient_send_id_outreach_send_id_fk" FOREIGN KEY ("send_id") REFERENCES "public"."outreach_send"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_recipient" ADD CONSTRAINT "outreach_recipient_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outreach_send_created_at_idx" ON "outreach_send" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "outreach_recipient_send_status_idx" ON "outreach_recipient" USING btree ("send_id","status");
