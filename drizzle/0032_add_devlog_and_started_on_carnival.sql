CREATE TABLE "devlog" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "started_on_carnival_at" timestamp;--> statement-breakpoint
ALTER TABLE "devlog" ADD CONSTRAINT "devlog_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devlog" ADD CONSTRAINT "devlog_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "devlog_project_created_at_idx" ON "devlog" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "devlog_user_created_at_idx" ON "devlog" USING btree ("user_id","created_at");