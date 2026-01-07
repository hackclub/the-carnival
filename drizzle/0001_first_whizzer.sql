CREATE TABLE "peer_review" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"review_comment" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"hackatime_project_name" text NOT NULL,
	"playable_url" text NOT NULL,
	"code_url" text NOT NULL,
	"screenshots" text[] NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "peer_review" ADD CONSTRAINT "peer_review_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peer_review" ADD CONSTRAINT "peer_review_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;