-- Telescreen (Robert) fraud review: one row per creator submission sent to
-- Robert, plus the webhook deliveries already handled. See src/lib/telescreen/.
CREATE TABLE "telescreen_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"external_id" text NOT NULL,
	"robert_project_id" text,
	"state" text DEFAULT 'pending' NOT NULL,
	"trust_score" integer,
	"review_note" text,
	"reviewed_at" timestamp,
	"credited_seconds" integer,
	"outcome_status" text,
	"outcome_reason" text,
	"outcome_at" timestamp,
	"carnival_outcome" text,
	"carnival_outcome_reason" text,
	"carnival_outcome_sent_at" timestamp,
	"fraud_applied_at" timestamp,
	"sent_at" timestamp,
	"last_synced_at" timestamp,
	"last_error" text,
	"last_error_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "telescreen_submission" ADD CONSTRAINT "telescreen_submission_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "telescreen_submission_external_id_uniq" ON "telescreen_submission" USING btree ("external_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "telescreen_submission_robert_project_id_uniq" ON "telescreen_submission" USING btree ("robert_project_id");
--> statement-breakpoint
CREATE INDEX "telescreen_submission_project_created_at_idx" ON "telescreen_submission" USING btree ("project_id","created_at");
--> statement-breakpoint
CREATE INDEX "telescreen_submission_state_idx" ON "telescreen_submission" USING btree ("state");
--> statement-breakpoint
CREATE TABLE "telescreen_webhook_delivery" (
	"delivery_id" text PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"robert_project_id" text,
	"received_at" timestamp NOT NULL
);
